import { createHash, randomUUID } from 'node:crypto';
import { ContextItem, EvaluatedContext, MemoryCandidate } from '../types.js';
import type {
  ApproveResult,
  IProposalStore,
  ProposalSnapshot,
  ResolveMemoryResult,
  RelevanceOverride,
} from './proposalStore.types.js';
import {
  ExtractedMemory,
  blueprintToContext,
  extractByRules,
  isSaveWorthyMemory,
  isDuplicate,
  toCandidate,
} from './memory.js';
import { selectDeterministic } from './selection.js';
import { inspectIntegrity } from './contextIntegrity.js';

const STALE_DAYS = 90;
const DAY_MS = 86_400_000;

export interface Proposal {
  id: string;
  userId: string;
  profileId: string;
  query: string;
  state: 'AWAITING_APPROVAL' | 'APPROVED' | 'ANSWERED' | 'FAILED';
  contexts: ContextItem[];
  evaluations: EvaluatedContext[];
  createdAt: string;
}

export function enforcePrivacy(item: ContextItem): ContextItem {
  const sensitivePattern = /(건강|식단|알레르|불내증|장애|접근성|무릎|질환|복용|이동\s*제약)/i;
  if (
    item.privacyLevel !== 'confidential' &&
    sensitivePattern.test([item.title, item.content, ...item.tags].join(' '))
  ) {
    return { ...item, privacyLevel: 'sensitive' };
  }
  return { ...item };
}

function ageInDays(updatedAt: string, now: Date): number {
  const parsed = Date.parse(updatedAt);
  return Number.isFinite(parsed) ? Math.floor((now.getTime() - parsed) / DAY_MS) : STALE_DAYS;
}

export const RELEVANCE_THRESHOLD = 50;

/** confidential은 절대 후보가 아니므로 LLM 선별 대상에서 사전 제외한다. */
export function selectableForRelevance(contexts: ContextItem[]): ContextItem[] {
  return contexts.filter((c) => c.privacyLevel !== 'confidential' && c.isActive);
}

/**
 * overrideScores: contextId→관련성 점수(0~100). LLM 선별 결과를 여기로 주입한다.
 * 정책(confidential 차단)·신선도·비활성 판정은 절대 오버라이드하지 않는다 —
 * LLM은 '허용된 후보 안에서의 관련성'만 바꿀 수 있고, 경계는 서버 규칙이 지킨다.
 */
export function evaluateContexts(
  query: string,
  contexts: ContextItem[],
  now = new Date(),
  overrideScores?: Map<string, number | RelevanceOverride>,
): EvaluatedContext[] {
  // override(LLM 선별)가 없으면 신규 결정론 엔진으로 전체 프로필을 한 번에 선별한다.
  // (v19의 카드별 relevance() 정규식 표를 대체 — 고정 도메인 규칙/약한 규칙 제거)
  const effectiveOverrides =
    overrideScores ?? selectDeterministic(query, contexts).overrides;
  return contexts.map((context) => {
    const isStale = ageInDays(context.updatedAt, now) >= STALE_DAYS;
    const integrity = inspectIntegrity(query, context, contexts, isStale);
    const restricted = context.privacyLevel === 'confidential';
    // confidential은 점수를 아예 계산하지 않는다(LLM에도 값이 가지 않음).
    const score = restricted
      ? 0
      : (() => {
          const override = effectiveOverrides.get(context.id);
          return typeof override === 'number' ? override : override?.score ?? 0;
        })();
    const override = effectiveOverrides.get(context.id);
    const selectionRole = typeof override === 'object'
      ? override.role || (score >= 85 ? 'must_use' : score >= RELEVANCE_THRESHOLD ? 'should_use' : score >= 35 ? 'optional' : 'ignore')
      : score >= RELEVANCE_THRESHOLD ? 'should_use' : 'ignore';
    const related = selectionRole !== 'ignore';
    const overrideReason = typeof override === 'object' ? override.reason : undefined;
    const impact = typeof override === 'object' ? override.impact : undefined;
    const confidence = typeof override === 'object' ? override.confidence : undefined;
    const suggested =
      context.isActive &&
      !restricted &&
      context.privacyLevel === 'normal' &&
      !integrity.requiresReview &&
      ['must_use', 'should_use'].includes(selectionRole);
    const exclusionReason = restricted
      ? 'RESTRICTED'
      : !context.isActive
        ? 'DISABLED'
        : selectionRole === 'ignore'
          ? 'UNRELATED'
          : undefined;
    const safeContext = restricted ? { ...context, content: '정책상 숨겨진 기밀 맥락' } : context;
    return {
      contextId: context.id,
      context: safeContext,
      relevanceScore: score,
      reason: restricted
        ? '기밀 등급이라 후보와 AI 프롬프트에서 제외했습니다.'
        : !context.isActive
          ? '사용자가 꺼둔 맥락입니다.'
          : overrideReason || (related
            ? `질문과 '${context.title}' 카드의 실제 내용이 의미상 관련됩니다.`
            : `질문에 답하는 데 '${context.title}' 정보의 직접 기여도가 낮습니다.`),
      suggested,
      approvedByUser: false,
      isStale,
      exclusionReason,
      valueVisible: !restricted,
      selectionRole,
      impact,
      confidence,
      integrityWarnings: integrity.warnings,
      requiresReview: integrity.requiresReview,
    };
  });
}

export class ProposalStore implements IProposalStore {
  private proposals = new Map<string, Proposal>();
  private answers = new Map<string, Record<string, unknown>>();
  private memories = new Map<
    string,
    MemoryCandidate & { userId: string; profileId: string; blueprint: ExtractedMemory }
  >();

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
    const proposal: Proposal = {
      id: randomUUID(),
      userId,
      profileId,
      query,
      state: 'AWAITING_APPROVAL',
      contexts: protectedContexts,
      evaluations: evaluateContexts(query, protectedContexts, now, overrideScores),
      createdAt: now.toISOString(),
    };
    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  async approve(proposalId: string, userId: string, approvedIds: string[]): Promise<ApproveResult> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.userId !== userId) throw new Error('이 Proposal에 대한 권한이 없습니다.');
    if (proposal.state !== 'AWAITING_APPROVAL') throw new Error('이미 처리한 Proposal입니다.');
    const allowedIds = new Set(
      proposal.evaluations
        .filter((item) => item.context.privacyLevel !== 'confidential' && item.context.isActive)
        .map((item) => item.contextId),
    );
    if (approvedIds.some((id) => !allowedIds.has(id))) {
      throw new Error('승인할 수 없는 맥락이 포함됐습니다.');
    }
    const byId = new Map(proposal.contexts.map((item) => [item.id, item]));
    const approved = approvedIds.map((id) => ({ ...byId.get(id)! }));
    const snapshotHash = createHash('sha256')
      .update(JSON.stringify({ proposalId, query: proposal.query, approved }))
      .digest('hex');
    proposal.state = 'APPROVED';
    return { proposal, approved, snapshotHash };
  }

  async inspect(proposalId: string, userId: string): Promise<ProposalSnapshot> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.userId !== userId) throw new Error('이 Proposal에 대한 권한이 없습니다.');
    if (proposal.state !== 'AWAITING_APPROVAL') throw new Error('이미 처리한 Proposal입니다.');
    return proposal;
  }

  async complete(proposalId: string, _userId?: string, answer?: Record<string, unknown>): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (proposal) {
      if (answer) this.answers.set(`${proposal.userId}:${proposalId}`, answer);
      proposal.state = 'ANSWERED';
    }
  }

  async fail(proposalId: string, _userId?: string): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (proposal?.state === 'APPROVED') proposal.state = 'FAILED';
  }

  async findAnswerByIdempotencyKey(userId: string, key: string): Promise<Record<string, unknown> | null> {
    return this.answers.get(`${userId}:${key}`) || null;
  }

  /**
   * 질문에서 새 개인 맥락을 추출해 기억 후보로 만든다.
   * extra: LLM 등 외부 추출기가 뽑은 결과(선택). 규칙 결과와 라벨 기준으로 병합한다.
   * 이미 프로필에 있는 정보는 제외한다.
   */
  async extractMemories(proposal: ProposalSnapshot | Proposal, extra: ExtractedMemory[] = []): Promise<MemoryCandidate[]> {
    const merged: ExtractedMemory[] = [];
    const seen = new Set<string>();
    for (const mem of [...extra, ...extractByRules(proposal.query)]) {
      if (!isSaveWorthyMemory(proposal.query, mem)) continue;
      if (seen.has(mem.label)) continue;
      if (isDuplicate(mem, proposal.contexts)) continue;
      seen.add(mem.label);
      merged.push(mem);
    }
    return merged.slice(0, 3).map((mem) => {
      const candidate = toCandidate(mem, proposal.userId, proposal.profileId);
      this.memories.set(candidate.id, candidate);
      const { blueprint: _blueprint, userId: _userId, profileId: _profileId, ...view } = candidate;
      return view;
    });
  }

  async resolveMemory(id: string, userId: string, action: 'save' | 'ignore'): Promise<ResolveMemoryResult> {
    const candidate = this.memories.get(id);
    if (!candidate || candidate.userId !== userId) throw new Error('기억 후보에 대한 권한이 없습니다.');
    if (candidate.status !== 'PENDING') throw new Error('이미 처리한 기억 후보입니다.');
    candidate.status = action === 'save' ? 'SAVED' : 'IGNORED';
    return {
      candidate,
      // 저장 카드의 제목·태그·등급은 추출 blueprint에서 만든다(하드코딩 제거).
      context: action === 'save' ? blueprintToContext(candidate.blueprint) : undefined,
    };
  }
}
