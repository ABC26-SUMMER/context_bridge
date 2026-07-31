import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { ContextItem, ContextProfile, QueryAuditLog } from '../types.js';
import { env } from '../config/env.js';

const url = env.supabaseUrl;
const anonKey = env.supabasePublicKey;
export const supabaseConfigured = Boolean(url && anonKey);

const localUsers = new Map<string, { id: string; email: string; profiles: ContextProfile[] }>([
  ['guest', {
    id: 'guest',
    email: 'guest@local.session',
    profiles: [{
      id: 'guest-profile',
      displayName: '게스트',
      personaType: 'custom',
      name: '임시 프로필',
      icon: '💬',
      description: '로그인 전 임시로 사용하는 채팅 프로필',
      contexts: [],
    }],
  }],
]);

if (process.env.NODE_ENV === 'test') {
  localUsers.set('demo-student', {
    id: 'demo-student',
    email: 'test@contextbridge.local',
    profiles: [{
      id: 'student-profile',
      displayName: '테스트 사용자',
      personaType: 'custom',
      name: '테스트 프로필',
      icon: '🧪',
      description: '자동 테스트에서만 생성되는 임시 프로필',
      contexts: [{
        id: 'test-goal',
        title: '학습 목표',
        category: 'goal',
        content: '클라우드 자격증 준비',
        tags: ['학습', '자격증'],
        isActive: true,
        privacyLevel: 'normal',
        updatedAt: new Date().toISOString(),
      }],
    }],
  });
}

function tokenFrom(header?: string) {
  return header?.startsWith('Bearer ') ? header.slice(7) : '';
}

export function userClient(token: string): SupabaseClient {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticate(header?: string) {
  const token = tokenFrom(header);

  // 테스트는 실제 Supabase 설정 여부와 무관하게 결정적이어야 한다.
  // demo-* 토큰은 NODE_ENV=test에서만 로컬 fixture로 인증하며,
  // 개발·운영 환경에서는 절대 우회 토큰으로 인정하지 않는다.
  const isTestFixture = process.env.NODE_ENV === 'test' && localUsers.has(token);
  if (token === 'guest' || isTestFixture || !supabaseConfigured) {
    const local = localUsers.get(token);
    if (!local) throw new Error('로그인이 필요합니다.');
    return { id: local.id, email: local.email, token, local: true };
  }
  if (!token) throw new Error('로그인이 필요합니다.');
  const client = userClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('세션이 만료됐습니다.');
  return { id: data.user.id, email: data.user.email || '', token, local: false };
}

export async function loadProfiles(user: Awaited<ReturnType<typeof authenticate>>) {
  if (user.local) return structuredClone(localUsers.get(user.id)!.profiles);
  const client = userClient(user.token);
  const { data: profiles, error: profileError } = await client
    .from('account_profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at');
  if (profileError) throw profileError;
  const { data: cards, error: cardError } = await client
    .from('context_cards')
    .select('*')
    .eq('user_id', user.id);
  if (cardError) throw cardError;
  return (profiles || []).map((profile: any) => ({
    id: profile.id,
    displayName: profile.display_name,
    personaType: profile.persona_type,
    name: profile.profile_name,
    icon: profile.icon,
    description: profile.description,
    contexts: (cards || [])
      .filter((item: any) => item.profile_id === profile.id)
      .map(fromCardRow),
  })) as ContextProfile[];
}

export async function loadAuditLogs(user: Awaited<ReturnType<typeof authenticate>>) {
  if (user.local) return [];
  const client = userClient(user.token);
  const { data, error } = await client
    .from('audit_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    timestamp: row.created_at,
    userQuery: row.question,
    evaluations: [],
    contextBridgeAnswer: row.answer,
    rawAnswer: row.raw_answer,
    totalVaultCount: row.used_contexts?.length || 0,
    usedContextCount: row.used_contexts?.length || 0,
    privacySavedCount: 0,
    snapshotHash: row.snapshot_hash,
    profileId: row.profile_id,
    usedContexts: row.used_contexts || [],
  })) as QueryAuditLog[];
}

export async function saveContext(
  user: Awaited<ReturnType<typeof authenticate>>,
  profileId: string,
  context: ContextItem,
) {
  if (user.local) {
    const profile = localUsers.get(user.id)!.profiles.find((item) => item.id === profileId);
    if (!profile) throw new Error('프로필을 찾을 수 없습니다.');
    const index = profile.contexts.findIndex((item) => item.id === context.id);
    if (index >= 0) profile.contexts[index] = context;
    else profile.contexts.unshift(context);
    return context;
  }
  const client = userClient(user.token);
  const row = toCardRow(user.id, profileId, context);
  const { data, error } = await client
    .from('context_cards')
    .upsert(row)
    .select()
    .single();
  if (error) throw error;
  return fromCardRow(data);
}

export async function createProfile(
  user: Awaited<ReturnType<typeof authenticate>>,
  input: Pick<ContextProfile, 'name' | 'icon' | 'description'> & {
    displayName?: string;
    personaType?: ContextProfile['personaType'];
  },
) {
  if (user.local) {
    const profile: ContextProfile = {
      id: randomUUID(),
      displayName: input.displayName || user.email.split('@')[0],
      personaType: input.personaType || 'custom',
      ...input,
      contexts: [],
    };
    localUsers.get(user.id)!.profiles.push(profile);
    return profile;
  }
  const client = userClient(user.token);
  const { data, error } = await client
    .from('account_profiles')
    .insert({
      user_id: user.id,
      display_name: input.displayName?.trim() || user.email.split('@')[0],
      persona_type: input.personaType || 'custom',
      profile_name: input.name,
      icon: input.icon,
      description: input.description,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    displayName: data.display_name,
    personaType: data.persona_type,
    name: data.profile_name,
    icon: data.icon,
    description: data.description,
    contexts: [],
  } as ContextProfile;
}

export async function updateProfile(
  user: Awaited<ReturnType<typeof authenticate>>,
  profileId: string,
  input: Pick<ContextProfile, 'displayName' | 'personaType' | 'name' | 'icon' | 'description'>,
) {
  if (user.local) {
    const profile = localUsers.get(user.id)!.profiles.find((item) => item.id === profileId);
    if (!profile) throw new Error('프로필을 찾을 수 없습니다.');
    Object.assign(profile, input);
    return structuredClone(profile);
  }

  const client = userClient(user.token);
  const { data, error } = await client
    .from('account_profiles')
    .update({
      display_name: input.displayName,
      persona_type: input.personaType,
      profile_name: input.name,
      icon: input.icon,
      description: input.description,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .eq('user_id', user.id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('프로필을 찾을 수 없습니다.');
  const contexts = (await loadProfiles(user)).find((item) => item.id === profileId)?.contexts || [];
  return {
    id: data.id,
    displayName: data.display_name,
    personaType: data.persona_type,
    name: data.profile_name,
    icon: data.icon,
    description: data.description,
    contexts,
  } as ContextProfile;
}

export async function deleteContext(
  user: Awaited<ReturnType<typeof authenticate>>,
  profileId: string,
  contextId: string,
) {
  if (user.local) {
    const profile = localUsers.get(user.id)!.profiles.find((item) => item.id === profileId);
    if (!profile) throw new Error('프로필을 찾을 수 없습니다.');
    profile.contexts = profile.contexts.filter((item) => item.id !== contextId);
    return;
  }
  const client = userClient(user.token);
  const { error } = await client
    .from('context_cards')
    .delete()
    .eq('id', contextId)
    .eq('profile_id', profileId)
    .eq('user_id', user.id);
  if (error) throw error;
}

export async function persistAuditLog(
  user: Awaited<ReturnType<typeof authenticate>>,
  input: {
    proposalId: string;
    profileId: string;
    snapshotHash: string;
    audit: QueryAuditLog;
  },
) {
  if (user.local) return;
  const client = userClient(user.token);
  // 스냅샷·proposal 상태는 SupabaseProposalStore가 이미 저장했다.
  // 여기서는 audit_logs만 기록한다.
  const { error: auditError } = await client.from('audit_logs').insert({
    user_id: user.id,
    profile_id: input.profileId,
    proposal_id: input.proposalId,
    question: input.audit.userQuery,
    used_contexts: input.audit.usedContexts,
    snapshot_hash: input.snapshotHash,
    answer: input.audit.contextBridgeAnswer,
    raw_answer: input.audit.rawAnswer,
  });
  if (auditError) throw auditError;
}

function fromCardRow(row: any): ContextItem {
  return {
    id: row.id,
    title: row.label,
    category: row.category,
    content: row.value_text,
    tags: row.tags || [],
    isActive: row.enabled,
    privacyLevel: row.sensitivity,
    updatedAt: row.updated_at,
  };
}

function toCardRow(userId: string, profileId: string, item: ContextItem) {
  return {
    id: item.id,
    user_id: userId,
    profile_id: profileId,
    semantic_group: item.tags[0] || item.category,
    category: item.category,
    label: item.title,
    value_text: item.content,
    tags: item.tags,
    enabled: item.isActive,
    sensitivity: item.privacyLevel,
    updated_at: item.updatedAt,
  };
}
