import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { ContextItem, ContextProfile, MemoryCandidate, QueryAuditLog } from '../types.js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
export const supabaseConfigured = Boolean(url && anonKey);

const studentCards: ContextItem[] = [
  card('전공', 'profile', 'AI·SW학과', ['교육', '전공'], 'normal'),
  card('학년', 'profile', '3학년', ['교육', '학년'], 'normal'),
  card('진로 목표', 'goal', '공기업 전산직', ['취업', '직무'], 'normal'),
  card('자격증 목표', 'goal', 'SQLD, 정보처리기사', ['자격증', '공부'], 'normal'),
  card('현재 기술', 'profile', 'Python, React, Supabase', ['개발', '기술'], 'normal'),
  card('공부 가능 시간', 'constraint', '평일 1시간', ['시간', '공부'], 'normal'),
  card('이동 수단', 'constraint', '대중교통', ['이동', '외출'], 'normal'),
  card('예산', 'constraint', '대학생 수준', ['예산', '외출'], 'normal'),
  card('장소 선호', 'preference', '조용한 장소, 사진 찍기 좋은 공간', ['장소', '외출'], 'normal'),
  card('답변 방식', 'preference', '구체적이고 단계적인 설명', ['답변', '설명'], 'normal'),
];

const seniorCards: ContextItem[] = [
  card('연령대', 'profile', '70대', ['연령'], 'sensitive'),
  card('디지털 숙련도', 'constraint', '초급', ['디지털', '설명'], 'sensitive'),
  card('이동 접근성', 'constraint', '장시간 보행 어려움', ['이동', '접근성', '외출'], 'sensitive'),
  card('이동 수단', 'constraint', '버스와 지하철', ['이동', '외출'], 'normal'),
  card('장소 선호', 'preference', '좌석이 있는 곳, 실내 공간', ['장소', '외출'], 'normal'),
  card('접근성 선호', 'preference', '큰 글씨, 짧은 문장, 쉬운 표현, 단계별 안내', ['접근성', '설명'], 'sensitive'),
  card('답변 방식', 'preference', '짧고 쉬운 설명', ['답변', '설명'], 'normal'),
  // confidential(기밀): 값은 후보 화면·AI 프롬프트 어디에도 나가지 않는다. '값도 안 읽는다' 시연 카드.
  card('복용 약물', 'constraint', '혈압약 복용 중', ['건강', '복용'], 'confidential'),
];

function card(
  title: string,
  category: ContextItem['category'],
  content: string,
  tags: string[],
  privacyLevel: ContextItem['privacyLevel'],
): ContextItem {
  return {
    id: randomUUID(),
    title,
    category,
    content,
    tags,
    isActive: true,
    privacyLevel,
    updatedAt: new Date().toISOString(),
  };
}

const localUsers = new Map<string, { id: string; email: string; profiles: ContextProfile[] }>([
  ['demo-student', {
    id: 'demo-student',
    email: 'student@contextbridge.demo',
    profiles: [{
      id: 'student-profile',
      displayName: '전이현',
      personaType: 'university_student',
      name: '대학생 프로필',
      icon: '🎓',
      description: 'AI·SW학과 3학년 데모 계정',
      contexts: studentCards,
    }],
  }],
  ['demo-senior', {
    id: 'demo-senior',
    email: 'senior@contextbridge.demo',
    profiles: [{
      id: 'senior-profile',
      displayName: '김영자',
      personaType: 'older_adult',
      name: '고령 사용자 프로필',
      icon: '👵',
      description: '쉬운 설명과 이동 접근성 데모 계정',
      contexts: seniorCards,
    }],
  }],
]);

function tokenFrom(header?: string) {
  return header?.startsWith('Bearer ') ? header.slice(7) : '';
}

function userClient(token: string): SupabaseClient {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticate(header?: string) {
  const token = tokenFrom(header);
  if (!supabaseConfigured) {
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
  input: Pick<ContextProfile, 'name' | 'icon' | 'description'>,
) {
  if (user.local) {
    const profile: ContextProfile = {
      id: randomUUID(),
      displayName: user.id === 'demo-student' ? '전이현' : '김영자',
      personaType: 'custom',
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
      display_name: user.email.split('@')[0],
      persona_type: 'custom',
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

export async function persistProposal(
  user: Awaited<ReturnType<typeof authenticate>>,
  proposal: { id: string; profileId: string; question: string; candidateIds: string[] },
) {
  if (user.local) return;
  const client = userClient(user.token);
  const { error } = await client.from('context_proposals').insert({
    id: proposal.id,
    user_id: user.id,
    profile_id: proposal.profileId,
    question: proposal.question,
    state: 'AWAITING_APPROVAL',
    candidate_ids: proposal.candidateIds,
  });
  if (error) throw error;
}

export async function persistAnswerArtifacts(
  user: Awaited<ReturnType<typeof authenticate>>,
  input: {
    proposalId: string;
    profileId: string;
    approved: ContextItem[];
    snapshotHash: string;
    audit: QueryAuditLog;
  },
) {
  if (user.local) return;
  const client = userClient(user.token);
  const { error: snapshotError } = await client.from('approval_snapshots').insert({
    proposal_id: input.proposalId,
    user_id: user.id,
    approved_items: input.approved,
    snapshot_hash: input.snapshotHash,
  });
  if (snapshotError) throw snapshotError;
  const { error: auditError } = await client.from('audit_logs').insert({
    user_id: user.id,
    profile_id: input.profileId,
    proposal_id: input.proposalId,
    question: input.audit.userQuery,
    used_contexts: input.approved,
    snapshot_hash: input.snapshotHash,
    answer: input.audit.contextBridgeAnswer,
    raw_answer: input.audit.rawAnswer,
  });
  if (auditError) throw auditError;
  const { error: stateError } = await client
    .from('context_proposals')
    .update({ state: 'ANSWERED', updated_at: new Date().toISOString() })
    .eq('id', input.proposalId)
    .eq('user_id', user.id)
    .eq('state', 'AWAITING_APPROVAL');
  if (stateError) throw stateError;
}

export async function persistMemoryCandidate(
  user: Awaited<ReturnType<typeof authenticate>>,
  proposalId: string,
  profileId: string,
  candidate: MemoryCandidate,
) {
  if (user.local) return;
  const client = userClient(user.token);
  const { error } = await client.from('memory_candidates').insert({
    id: candidate.id,
    user_id: user.id,
    profile_id: profileId,
    proposal_id: proposalId,
    label: candidate.label,
    category: candidate.category,
    value_text: candidate.content,
    sensitivity: candidate.privacyLevel,
    status: candidate.status,
  });
  if (error) throw error;
}

export async function persistMemoryStatus(
  user: Awaited<ReturnType<typeof authenticate>>,
  candidateId: string,
  status: 'SAVED' | 'IGNORED',
) {
  if (user.local) return;
  const client = userClient(user.token);
  const { error } = await client
    .from('memory_candidates')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', candidateId)
    .eq('user_id', user.id)
    .eq('status', 'PENDING');
  if (error) throw error;
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
