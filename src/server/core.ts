import { createHash, randomUUID } from 'node:crypto';
import { ContextItem, EvaluatedContext, MemoryCandidate } from '../types.js';
import {
  ExtractedMemory,
  blueprintToContext,
  extractByRules,
  isDuplicate,
  toCandidate,
} from './memory.js';

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

function relevance(query: string, item: ContextItem): number {
  const q = query.toLocaleLowerCase();
  const haystack = [item.title, item.category, ...item.tags].join(' ').toLocaleLowerCase();
  const tokens = q.split(/[\s,.?!/()[\]{}]+/).filter((token) => token.length >= 2);
  const directHits = tokens.filter((token) => haystack.includes(token)).length;
  const semanticRules: Array<[RegExp, string[]]> = [
    [/(공부|학습|자격증|취업|직무|코드|개발)/, ['goal', 'project', 'profile', '개발', '기술', '학습']],
    [/(맛집|음식|먹|식당|레시피)/, ['constraint', 'preference', '식단', '음식']],
    [/(외출|친구|만나|여행|걷|이동)/, ['constraint', 'preference', '운동', '이동']],
    [/(설명|알려|방법|어떻게)/, ['preference', 'profile', '답변', '스타일']],
  ];
  const semanticHits = semanticRules.reduce(
    (count, [pattern, clues]) =>
      count + (pattern.test(q) && clues.some((clue) => haystack.includes(clue)) ? 1 : 0),
    0,
  );
  return Math.min(95, 20 + directHits * 25 + semanticHits * 35);
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
  overrideScores?: Map<string, number>,
): EvaluatedContext[] {
  return contexts.map((context) => {
    const isStale = ageInDays(context.updatedAt, now) >= STALE_DAYS;
    const restricted = context.privacyLevel === 'confidential';
    // confidential은 점수를 아예 계산하지 않는다(LLM에도 값이 가지 않음).
    const score = restricted
      ? 0
      : overrideScores?.get(context.id) ?? relevance(query, context);
    const related = score >= RELEVANCE_THRESHOLD;
    const suggested = context.isActive && !restricted && related;
    const exclusionReason = restricted
      ? 'RESTRICTED'
      : !context.isActive
        ? 'DISABLED'
        : !related
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
          : related
            ? '질문의 주제와 카드 태그·범주가 관련됩니다.'
            : '질문과 직접 관련된 태그를 찾지 못했습니다.',
      suggested,
      approvedByUser: false,
      isStale,
      exclusionReason,
      valueVisible: !restricted,
    };
  });
}

export class ProposalStore {
  private proposals = new Map<string, Proposal>();
  private memories = new Map<
    string,
    MemoryCandidate & { userId: string; profileId: string; blueprint: ExtractedMemory }
  >();

  create(
    userId: string,
    profileId: string,
    query: string,
    contexts: ContextItem[],
    now = new Date(),
    overrideScores?: Map<string, number>,
  ) {
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

  approve(proposalId: string, userId: string, approvedIds: string[]) {
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

  inspect(proposalId: string, userId: string) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.userId !== userId) throw new Error('이 Proposal에 대한 권한이 없습니다.');
    if (proposal.state !== 'AWAITING_APPROVAL') throw new Error('이미 처리한 Proposal입니다.');
    return proposal;
  }

  complete(proposalId: string) {
    const proposal = this.proposals.get(proposalId);
    if (proposal) proposal.state = 'ANSWERED';
  }

  fail(proposalId: string) {
    const proposal = this.proposals.get(proposalId);
    if (proposal?.state === 'APPROVED') proposal.state = 'FAILED';
  }

  /**
   * 질문에서 새 개인 맥락을 추출해 기억 후보로 만든다.
   * extra: LLM 등 외부 추출기가 뽑은 결과(선택). 규칙 결과와 라벨 기준으로 병합한다.
   * 이미 프로필에 있는 정보는 제외한다.
   */
  extractMemories(proposal: Proposal, extra: ExtractedMemory[] = []): MemoryCandidate[] {
    const merged: ExtractedMemory[] = [];
    const seen = new Set<string>();
    for (const mem of [...extra, ...extractByRules(proposal.query)]) {
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

  resolveMemory(id: string, userId: string, action: 'save' | 'ignore') {
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
