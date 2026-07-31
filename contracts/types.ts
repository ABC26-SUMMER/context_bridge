/**
 * Context Bridge — 프론트·백엔드 공유 계약 타입
 * 기준: Context Bridge v20 실제 서버·프론트 계약
 *
 * 이 파일이 유일한 진실의 원천(single source of truth)이다.
 * 종현 선배(프론트)와 도원(백엔드)이 같은 파일을 import 한다.
 * 변경은 반드시 양쪽 합의 후 PR로만.
 *
 * 현재 응답은 기존 호환을 위해 최상위 data 봉투 없이 사용한다.
 */

// ───────────────────────── 기본 별칭 ─────────────────────────
export type UUID = string;        // 서버 생성. 프론트는 만들지 않는다.
export type ISODateTime = string; // UTC ISO 8601, 예: 2026-07-29T04:20:31.000Z

// ───────────────────────── enum ─────────────────────────
export type ContextCategory =
  | 'identity'
  | 'capability'
  | 'objective'
  | 'preference'
  | 'hard_limit'
  | 'soft_limit'
  | 'resource'
  | 'routine'
  | 'relationship'
  | 'current_state'
  | 'project'
  // 기존 DB/기억 카드 호환
  | 'profile'
  | 'goal'
  | 'constraint';
export type PrivacyLevel = 'normal' | 'sensitive' | 'confidential';
export type PersonaType = 'university_student' | 'older_adult' | 'custom';
export type ExclusionReason = 'UNRELATED' | 'DISABLED' | 'RESTRICTED';
export type MemoryCandidateStatus = 'PENDING' | 'SAVED' | 'IGNORED';
export type SelectionMode = 'local-hybrid' | 'query-structured-hybrid';
export type BootstrapMode = 'supabase' | 'local-demo';

// ───────────────────────── Entity ─────────────────────────
export interface ContextItem {
  id: UUID;
  title: string;
  category: ContextCategory;
  content: string;          // proposal 후보 응답에선 confidential이 마스킹됨. bootstrap(본인 vault)에선 값 그대로.
  tags: string[]; // 하위 호환용. 사용자 입력에서는 사용하지 않음
  isActive: boolean;
  privacyLevel: PrivacyLevel;
  updatedAt: ISODateTime;
}

export interface ContextProfile {
  id: UUID;
  displayName: string;      // 사용자 표시 이름 (데모: '전이현' / '김영자')
  personaType: PersonaType;
  name: string;             // 프로필 이름 ('대학생 프로필')
  icon: string;             // 이모지
  description: string;
  contexts: ContextItem[];
}

/**
 * 질문 분석 결과의 카드 1장. 프론트는 이걸로 승인 모달을 그린다.
 * - suggested: true 인 것만 기본 체크
 * - exclusionReason 있으면 "쓰지 않은 카드"로 사유 표시
 * - valueVisible: false 면 content가 마스킹돼 있으니 값 대신 라벨만
 */
export interface EvaluatedContext {
  contextId: UUID;
  context: ContextItem;
  relevanceScore: number;   // 0~100
  reason: string;           // 후보/제외 사유 문구
  suggested: boolean;       // 기본 체크 여부
  approvedByUser: boolean;  // 서버가 채우는 초기값(항상 false로 내려옴)
  isStale: boolean;         // 오래된 카드(재확인 권장)
  exclusionReason?: ExclusionReason; // 있으면 이 질문에 쓰지 않은 카드
  valueVisible: boolean;
  selectionRole?: 'must_use' | 'should_use' | 'optional' | 'ignore';
  impact?: string;
  confidence?: number;    // false = 값 마스킹됨(confidential)
  integrityWarnings?: string[];
  requiresReview?: boolean;
}

export interface MemoryCandidate {
  id: UUID;
  label: string;
  category: ContextCategory;
  content: string;
  privacyLevel: PrivacyLevel;
  status: MemoryCandidateStatus;
}

export interface QueryAuditLog {
  id: UUID;
  timestamp: ISODateTime;
  userQuery: string;
  evaluations: EvaluatedContext[];
  contextBridgeAnswer: string;
  rawAnswer?: string;
  totalVaultCount: number;   // 감사 경계 안의 승인 카드 수(전체 Vault 크기는 기록하지 않음)
  usedContextCount: number;  // 실제 사용된 카드 수
  privacySavedCount: number; // 거절 카드 존재 여부를 유추하지 않도록 항상 0
  snapshotHash: string;
  profileId: UUID;
  usedContexts: ContextItem[];
}

// ───────────────── 요청 DTO (프론트 → 백엔드) ─────────────────
// 프론트는 id/updatedAt/userId/profileId를 만들지 않는다. 서버가 생성.

export interface CreateProfileRequest {
  displayName: string;
  personaType: PersonaType;
  name: string;
  icon: string;
  description: string;
}

export type UpdateProfileRequest = CreateProfileRequest;

export interface CreateContextRequest {
  title: string;
  category: ContextCategory;
  content: string;
  tags?: string[]; // 하위 호환용. 신규 UI는 입력하지 않음
  isActive?: boolean;
  privacyLevel: PrivacyLevel;
}

export type UpdateContextRequest = CreateContextRequest;

export interface StructuredContextDraft {
  title: string;
  category: ContextCategory;
  content: string;
  privacyLevel: PrivacyLevel;
  rationale: string;
}

export interface CreateProposalRequest {
  profileId: UUID;
  query: string;
  conversationHistory?: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 답변 생성 요청. 프론트는 승인한 카드의 ID만 보낸다. */
export interface GenerateAnswerRequest {
  approvedContextIds: UUID[];
  includeRawComparison?: boolean; // 기본 true. 일반 답변 vs 개인화 답변 비교(데모용)
  temporaryNote?: string;         // 이번 질문에만 쓰는 일회성 메모. DB 저장 안 함.
  conversationHistory?: ConversationMessage[];
}

export interface ResolveMemoryRequest {
  action: 'save' | 'ignore';
}

// ───────────────── 응답 (백엔드 → 프론트) ─────────────────
// v20 실제 형태. 최상위 키가 API마다 다름(봉투 미적용).

export interface BootstrapResponse {
  user: { id: UUID; email: string };
  profiles: ContextProfile[];
  auditLogs: QueryAuditLog[];
  mode: BootstrapMode;
}

export interface CreateProfileResponse {
  profile: ContextProfile;
}

export interface SaveContextResponse {
  context: ContextItem;
}

export interface ProposalResponse {
  proposalId: UUID;
  query: string;
  evaluations: EvaluatedContext[];
  selectionMode: SelectionMode;
  summaryReasoning: string;
  detectedIntent?: string;
  questionPlan?: {
    taskType: string;
    userGoal: string;
    requiredFactors: string[];
    responsePlan: string[];
    desiredOutcome: string;
    currentDecision: string;
    necessaryConditions: string[];
    riskDomains: string[];
    timeHorizon: string;
    accessibilityOrSafety: string[];
  };
  suggestedAdditions?: string[];
  diagnostics?: {
    mode: SelectionMode;
    vaultCount: number;
    shortlistCount: number;
    safetyNetRescues: number;
    overSelectionTrims: number;
  };
}

export interface AnswerResponse {
  contextBridgeAnswer: string;
  rawAnswer?: string;
  usedContexts: ContextItem[];
  usedContextsCount: number;
  snapshotHash: string;
  memoryCandidates: MemoryCandidate[];
  auditLog: QueryAuditLog;
}

export interface ResolveMemoryResponse {
  candidate: MemoryCandidate & { profileId: UUID };
  context?: ContextItem; // action이 'save'일 때만 존재(생성된 카드)
  profileId: UUID;
}

// ───────────────── 오류 (v20 현재 형태) ─────────────────
// 현재는 { error: string } 하나뿐. code 분기 불가.
// 통합 시 { error: { code, message, retryable } }로 올릴 것(§9 P1). 그 전까진 status로 분기.
export interface ErrorResponseV12 {
  error: string;
}
