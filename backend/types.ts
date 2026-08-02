/**
 * 백엔드는 별도 복사본을 유지하지 않고 프론트와 같은 계약 타입을 사용한다.
 * 계약 변경은 contracts/types.ts 한 곳에서만 한다.
 */
export type {
  ContextCategory,
  PrivacyLevel,
  ContextItem,
  ContextProfile,
  ExclusionReason,
  EvaluatedContext,
  MemoryCandidate,
  QueryAuditLog,
  ElderlyAnswerGuide,
  ElderlyCallout,
  ElderlyCalloutTone,
  ElderlyStep,
  ReexplainElderlyRequest,
  ReexplainElderlyResponse,
} from '../contracts/types.js';

import type {
  ContextItem,
  EvaluatedContext,
} from '../contracts/types.js';

export interface ContextAnalysisResponse {
  proposalId: string;
  query: string;
  evaluations: EvaluatedContext[];
  summaryReasoning: string;
}

export interface PresetProfile {
  id: string;
  name: string;
  description: string;
  iconName: string;
  items: Omit<ContextItem, 'id' | 'updatedAt'>[];
}
