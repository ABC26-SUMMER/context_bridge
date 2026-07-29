/**
 * Context Bridge — 프론트·백엔드 공유 계약 타입
 * 기준: context-bridge-v12-hermetic-tests 실제 서버 코드(server.ts, src/types.ts)
 *
 * 이 파일이 유일한 진실의 원천(single source of truth)이다.
 * 종현 선배(프론트)와 도원(백엔드)이 같은 파일을 import 한다.
 * 변경은 반드시 양쪽 합의 후 PR로만.
 *
 * ⚠️ 주의: 아래는 "현재 v12가 실제로 주고받는" 형태다. 통합계약서 §4의
 * { data, meta } 봉투는 아직 적용돼 있지 않다. 발표 일정상 v12 형태를
 * 유지하기로 했으므로, 프론트도 이 형태로 붙인다. 봉투 전환은 v2로 미룬다.
 */

// ───────────────────────── 기본 별칭 ─────────────────────────
export type UUID = string;        // 서버 생성. 프론트는 만들지 않는다.
export type ISODateTime = string; // UTC ISO 8601, 예: 2026-07-29T04:20:31.000Z

// ───────────────────────── enum ─────────────────────────
export type ContextCategory = 'profile' | 'preference' | 'goal' | 'constraint' | 'project';
export type PrivacyLevel = 'normal' | 'sensitive' | 'confidential';
export type PersonaType = 'university_student' | 'older_adult' | 'custom';
export type ExclusionReason = 'UNRELATED' | 'DISABLED' | 'RESTRICTED';
export type MemoryCandidateStatus = 'PENDING' | 'SAVED' | 'IGNORED';
export type SelectionMode = 'rules' | 'llm';
export type BootstrapMode = 'supabase' | 'local-demo';

// ───────────────────────── Entity ─────────────────────────
export interface ContextItem {
  id: UUID;
  title: string;
  category: ContextCategory;
  content: string;          // proposal 후보 응답에선 confidential이 마스킹됨. bootstrap(본인 vault)에선 값 그대로.
  tags: string[];
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
  valueVisible: boolean;    // false = 값 마스킹됨(confidential)
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
  totalVaultCount: number;   // 전체 카드 수
  usedContextCount: number;  // 실제 사용된 카드 수
  privacySavedCount: number; // 보호된(안 쓴) 카드 수 = total - used
  snapshotHash: string;
  profileId: UUID;
  usedContexts: ContextItem[];
}

// ───────────────── 요청 DTO (프론트 → 백엔드) ─────────────────
// 프론트는 id/updatedAt/userId/profileId를 만들지 않는다. 서버가 생성.

export interface CreateProfileRequest {
  name: string;
  icon: string;
  description: string;
}

export interface CreateContextRequest {
  title: string;
  category: ContextCategory;
  content: string;
  tags: string[];
  isActive?: boolean;
  privacyLevel: PrivacyLevel;
}

export interface CreateProposalRequest {
  profileId: UUID;
  query: string;
}

/**
 * 답변 생성 요청. 프론트는 승인한 카드의 ID만 보낸다.
 * ⚠️ 카드 객체·content를 다시 보내지 않는다 — 서버가 Proposal 스냅샷에서 재조회.
 * ⚠️ v12 현재 키 이름은 approvedIds / tempNote 다(통합계약서의 approvedContextIds가 아님).
 *    최종 이름은 §12에서 합의. 아래는 현재 코드 기준.
 */
export interface GenerateAnswerRequest {
  approvedIds: UUID[];
  includeRawComparison?: boolean; // 기본 true. 일반 답변 vs 개인화 답변 비교(데모용)
  tempNote?: string;              // 이번 질문에만 쓰는 일회성 메모. DB 저장 안 함.
}

export interface ResolveMemoryRequest {
  action: 'save' | 'ignore';
}

// ───────────────── 응답 (백엔드 → 프론트) ─────────────────
// v12 실제 형태. 최상위 키가 API마다 다름(봉투 미적용).

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
  selectionMode: SelectionMode; // ⚠️ v12 src/types.ts엔 없다. 이 파일이 정본.
  summaryReasoning: string;
}

export interface AnswerResponse {
  contextBridgeAnswer: string;
  rawAnswer?: string;
  usedContexts: ContextItem[];
  usedContextsCount: number;    // ⚠️ 오타 주의: v12는 usedContextsCount (s 있음)
  snapshotHash: string;
  memoryCandidates: MemoryCandidate[];
  auditLog: QueryAuditLog;
}

export interface ResolveMemoryResponse {
  candidate: MemoryCandidate & { profileId: UUID };
  context?: ContextItem; // action이 'save'일 때만 존재(생성된 카드)
  profileId: UUID;
}

// ───────────────── 오류 (v12 현재 형태) ─────────────────
// ⚠️ v12는 { error: string } 하나뿐. code 분기 불가.
// 통합 시 { error: { code, message, retryable } }로 올릴 것(§9 P1). 그 전까진 status로 분기.
export interface ErrorResponseV12 {
  error: string;
}
