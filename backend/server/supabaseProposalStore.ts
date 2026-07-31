import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ContextItem, MemoryCandidate } from '../types.js';
import { enforcePrivacy, evaluateContexts } from './core.js';
import {
  ExtractedMemory,
  blueprintToContext,
  extractByRules,
  isSaveWorthyMemory,
  isDuplicate,
  toCandidate,
} from './memory.js';
import {
  ApproveResult,
  EvaluatedLike,
  IProposalStore,
  ProposalSnapshot,
  ResolveMemoryResult,
  RelevanceOverride,
} from './proposalStore.types.js';

/**
 * Supabase 기반 ProposalStore.
 *
 * 인메모리 버전과 동작이 동일하되, 상태를 context_proposals(JSONB snapshot)와
 * memory_candidates에 영속한다. 서버리스에서 요청이 다른 인스턴스로 가도
 * proposal이 유실되지 않는다.
 *
 * 상태 전이는 advance_proposal_state() RPC로 원자화한다(낙관적 잠금).
 * 동시 승인 요청 중 하나만 AWAITING_APPROVAL→APPROVED에 성공하고, 나머지는 0행 → 409.
 *
 * client는 "요청한 사용자의 토큰이 실린" Supabase 클라이언트여야 한다(RLS 적용).
 */
export class SupabaseProposalStore implements IProposalStore {
  constructor(private readonly client: SupabaseClient) {}

  async create(
    userId: string,
    profileId: string,
    query: string,
    contexts: ContextItem[],
    now = new Date(),
    overrideScores?: Map<string, number | RelevanceOverride>,
  ): Promise<ProposalSnapshot> {
    const protectedContexts = contexts.map((item) =>
      enforcePrivacy({ ...item, tags: [...item.tags] }),
    );
    const evaluations = evaluateContexts(query, protectedContexts, now, overrideScores);
    const snapshot: ProposalSnapshot = {
      id: randomUUID(),
      userId,
      profileId,
      query,
      state: 'AWAITING_APPROVAL',
      contexts: protectedContexts,
      evaluations: evaluations as EvaluatedLike[],
      createdAt: now.toISOString(),
    };

    const { error } = await this.client.from('context_proposals').insert({
      id: snapshot.id,
      user_id: userId,
      profile_id: profileId,
      question: query,
      state: 'AWAITING_APPROVAL',
      candidate_ids: evaluations.filter((e) => e.suggested).map((e) => e.contextId),
      snapshot: { contexts: protectedContexts, evaluations },
      idempotency_key: snapshot.id,
    });
    if (error) throw new Error(`proposal 저장 실패: ${error.message}`);
    return snapshot;
  }

  private async load(proposalId: string, userId: string): Promise<ProposalSnapshot> {
    const { data, error } = await this.client
      .from('context_proposals')
      .select('*')
      .eq('id', proposalId)
      .eq('user_id', userId)   // RLS가 이미 막지만 명시적 이중 방어
      .maybeSingle();
    if (error) throw new Error(`proposal 조회 실패: ${error.message}`);
    if (!data) throw new Error('이 Proposal에 대한 권한이 없습니다.');
    const snap = (data.snapshot || {}) as {
      contexts?: ContextItem[];
      evaluations?: EvaluatedLike[];
    };
    return {
      id: data.id,
      userId: data.user_id,
      profileId: data.profile_id,
      query: data.question,
      state: data.state,
      contexts: snap.contexts || [],
      evaluations: snap.evaluations || [],
      createdAt: data.created_at,
    };
  }

  async inspect(proposalId: string, userId: string): Promise<ProposalSnapshot> {
    const proposal = await this.load(proposalId, userId);
    if (proposal.state !== 'AWAITING_APPROVAL') throw new Error('이미 처리한 Proposal입니다.');
    return proposal;
  }

  async approve(
    proposalId: string,
    userId: string,
    approvedIds: string[],
  ): Promise<ApproveResult> {
    const proposal = await this.load(proposalId, userId);
    if (proposal.state !== 'AWAITING_APPROVAL') throw new Error('이미 처리한 Proposal입니다.');

    // 승인 가능한 ID만 허용(비활성·기밀 제외) — 인메모리 버전과 동일 규칙
    const allowedIds = new Set(
      proposal.evaluations
        .filter((e) => e.context.privacyLevel !== 'confidential' && e.context.isActive)
        .map((e) => e.contextId),
    );
    if (approvedIds.some((id) => !allowedIds.has(id))) {
      throw new Error('승인할 수 없는 맥락이 포함됐습니다.');
    }
    const byId = new Map(proposal.contexts.map((c) => [c.id, c]));
    const approved = approvedIds.map((id) => ({ ...byId.get(id)! }));
    const snapshotHash = createHash('sha256')
      .update(JSON.stringify({ proposalId, query: proposal.query, approved }))
      .digest('hex');

    // 낙관적 잠금: AWAITING_APPROVAL일 때만 APPROVED로. 경쟁 요청은 여기서 0행 → 409.
    const { data, error } = await this.client.rpc('advance_proposal_state', {
      p_proposal_id: proposalId,
      p_expected_state: 'AWAITING_APPROVAL',
      p_next_state: 'APPROVED',
    });
    if (error) throw new Error(`상태 전이 실패: ${error.message}`);
    if (!data || (Array.isArray(data) && data.length === 0)) {
      const conflict = new Error('이미 처리한 Proposal입니다.');
      (conflict as Error & { status?: number }).status = 409;
      throw conflict;
    }

    // 스냅샷 저장. approval_snapshots는 RLS에 insert 정책만 있고 update가 없으므로
    // upsert(=충돌 시 update)를 쓰면 안 된다. 낙관적 잠금으로 approve가 승인당 정확히
    // 1회만 성공하므로, proposal_id PK 충돌은 발생하지 않는다 → 순수 insert가 맞다.
    const { error: snapErr } = await this.client.from('approval_snapshots').insert({
      proposal_id: proposalId,
      user_id: userId,
      approved_items: approved,
      snapshot_hash: snapshotHash,
    });
    if (snapErr) throw new Error(`스냅샷 저장 실패: ${snapErr.message}`);

    return { proposal: { ...proposal, state: 'APPROVED' }, approved, snapshotHash };
  }

  async complete(proposalId: string, userId: string, answer?: Record<string, unknown>): Promise<void> {
    if (answer) {
      const { error } = await this.client
        .from('context_proposals')
        .update({ answer })
        .eq('id', proposalId)
        .eq('user_id', userId)
        .eq('state', 'APPROVED');
      if (error) throw new Error(`답변 저장 실패: ${error.message}`);
    }
    await this.client.rpc('advance_proposal_state', {
      p_proposal_id: proposalId,
      p_expected_state: 'APPROVED',
      p_next_state: 'ANSWERED',
    });
  }

  async fail(proposalId: string, userId: string): Promise<void> {
    await this.client.rpc('advance_proposal_state', {
      p_proposal_id: proposalId,
      p_expected_state: 'APPROVED',
      p_next_state: 'FAILED',
    });
    void userId;
  }

  async extractMemories(
    proposal: ProposalSnapshot,
    extra: ExtractedMemory[] = [],
  ): Promise<MemoryCandidate[]> {
    const merged: ExtractedMemory[] = [];
    const seen = new Set<string>();
    for (const mem of [...extra, ...extractByRules(proposal.query)]) {
      if (!isSaveWorthyMemory(proposal.query, mem)) continue;
      if (seen.has(mem.label)) continue;
      if (isDuplicate(mem, proposal.contexts)) continue;
      seen.add(mem.label);
      merged.push(mem);
    }
    const top = merged.slice(0, 3);
    const rows = top.map((mem) => {
      const c = toCandidate(mem, proposal.userId, proposal.profileId);
      return {
        id: c.id,
        user_id: proposal.userId,
        profile_id: proposal.profileId,
        proposal_id: proposal.id,
        label: c.label,
        category: c.category,
        value_text: c.content,
        sensitivity: c.privacyLevel,
        status: 'PENDING' as const,
        blueprint: c.blueprint,   // 저장 카드를 정확히 만들기 위해 blueprint 영속
      };
    });
    if (rows.length) {
      const { error } = await this.client.from('memory_candidates').insert(rows);
      if (error) throw new Error(`기억 후보 저장 실패: ${error.message}`);
    }
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      category: r.category,
      content: r.value_text,
      privacyLevel: r.sensitivity,
      status: 'PENDING',
    }));
  }

  async resolveMemory(
    id: string,
    userId: string,
    action: 'save' | 'ignore',
  ): Promise<ResolveMemoryResult> {
    const { data, error } = await this.client
      .from('memory_candidates')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`기억 후보 조회 실패: ${error.message}`);
    if (!data) throw new Error('기억 후보에 대한 권한이 없습니다.');
    if (data.status !== 'PENDING') throw new Error('이미 처리한 기억 후보입니다.');

    const nextStatus = action === 'save' ? 'SAVED' : 'IGNORED';
    // 낙관적 잠금: PENDING일 때만 전이(이중 클릭 방지)
    const { data: updated, error: upErr } = await this.client
      .from('memory_candidates')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .select()
      .maybeSingle();
    if (upErr) throw new Error(`기억 후보 갱신 실패: ${upErr.message}`);
    if (!updated) throw new Error('이미 처리한 기억 후보입니다.');

    const candidate = {
      id: data.id,
      label: data.label,
      category: data.category,
      content: data.value_text,
      privacyLevel: data.sensitivity,
      status: nextStatus as 'SAVED' | 'IGNORED',
      userId: data.user_id,
      profileId: data.profile_id,
    };
    const context =
      action === 'save' && data.blueprint
        ? blueprintToContext(data.blueprint as ExtractedMemory)
        : undefined;
    return { candidate, context };
  }

  async findAnswerByIdempotencyKey(
    userId: string,
    key: string,
  ): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.client
      .from('context_proposals')
      .select('answer')
      .eq('user_id', userId)
      .eq('idempotency_key', key)
      .maybeSingle();
    if (error) return null;
    return (data?.answer as Record<string, unknown>) || null;
  }
}
