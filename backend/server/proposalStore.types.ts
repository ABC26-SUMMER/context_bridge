import { ContextItem, MemoryCandidate } from '../types.js';
import { ExtractedMemory } from './memory.js';


export interface RelevanceOverride {
  score: number;
  reason?: string;
  role?: 'must_use' | 'should_use' | 'optional' | 'ignore';
  impact?: string;
  confidence?: number;
}

/**
 * ProposalStore 계약. 인메모리(테스트·데모)와 Supabase(운영)가 같은 인터페이스를 구현한다.
 * server.ts는 이 인터페이스에만 의존하므로, 환경변수 유무로 구현체만 바꿔 끼운다.
 *
 * 인메모리 버전은 동기지만, Supabase 버전은 네트워크라 비동기다.
 * 따라서 계약은 모두 Promise로 통일한다(인메모리는 즉시 resolve).
 */

export interface ProposalSnapshot {
  id: string;
  userId: string;
  profileId: string;
  query: string;
  state: 'AWAITING_APPROVAL' | 'APPROVED' | 'ANSWERED' | 'FAILED';
  contexts: ContextItem[];   // 마스킹된 카드(생성 시점 고정)
  evaluations: EvaluatedLike[];
  createdAt: string;
}

// core.ts의 EvaluatedContext와 동일 구조(순환 import 회피용 최소 정의)
export interface EvaluatedLike {
  contextId: string;
  context: ContextItem;
  relevanceScore: number;
  reason: string;
  suggested: boolean;
  approvedByUser: boolean;
  isStale: boolean;
  exclusionReason?: 'UNRELATED' | 'DISABLED' | 'RESTRICTED';
  valueVisible: boolean;
  selectionRole?: 'must_use' | 'should_use' | 'optional' | 'ignore';
  impact?: string;
  confidence?: number;
}

export interface ApproveResult {
  proposal: ProposalSnapshot;
  approved: ContextItem[];
  snapshotHash: string;
}

export interface ResolveMemoryResult {
  candidate: MemoryCandidate & { userId: string; profileId: string };
  context?: ContextItem;
  /** Supabase RPC가 카드 생성까지 한 트랜잭션으로 완료했는지 여부 */
  persisted?: boolean;
}

export interface IProposalStore {
  create(
    userId: string,
    profileId: string,
    query: string,
    contexts: ContextItem[],
    now?: Date,
    overrideScores?: Map<string, number | RelevanceOverride>,
  ): Promise<ProposalSnapshot>;

  inspect(proposalId: string, userId: string): Promise<ProposalSnapshot>;

  approve(proposalId: string, userId: string, approvedIds: string[]): Promise<ApproveResult>;

  complete(proposalId: string, userId: string): Promise<void>;

  fail(proposalId: string, userId: string): Promise<void>;

  extractMemories(
    proposal: ProposalSnapshot,
    extra?: ExtractedMemory[],
    includeRuleFallback?: boolean,
  ): Promise<MemoryCandidate[]>;

  resolveMemory(
    id: string,
    userId: string,
    action: 'save' | 'ignore',
  ): Promise<ResolveMemoryResult>;

  /**
   * resolveMemory('save')가 후보를 SAVED로 표시한 뒤 카드 저장이 실패하면
   * 후보를 다시 PENDING으로 되돌려 재시도 가능하게 한다(best-effort).
   * SAVED가 아니면 아무 것도 하지 않는다.
   */
  revertMemory?(id: string, userId: string): Promise<void>;

  /** 멱등: 같은 키의 답변이 이미 있으면 반환, 없으면 null. */
  findAnswerByIdempotencyKey?(
    userId: string,
    key: string,
  ): Promise<Record<string, unknown> | null>;
}
