export type ContextCategory = 'profile' | 'preference' | 'goal' | 'constraint' | 'project';
export type PrivacyLevel = 'normal' | 'sensitive' | 'confidential';

export interface ContextItem {
  id: string;
  title: string;
  category: ContextCategory;
  content: string;
  tags: string[];
  isActive: boolean;
  privacyLevel: PrivacyLevel;
  updatedAt: string;
}

export interface ContextProfile {
  id: string;
  displayName: string;
  personaType: 'university_student' | 'older_adult' | 'custom';
  name: string;
  icon: string;
  description: string;
  contexts: ContextItem[];
}

export type ExclusionReason = 'UNRELATED' | 'DISABLED' | 'RESTRICTED';

export interface EvaluatedContext {
  contextId: string;
  context: ContextItem;
  relevanceScore: number;
  reason: string;
  suggested: boolean;
  approvedByUser: boolean;
  isStale: boolean;
  exclusionReason?: ExclusionReason;
  valueVisible: boolean;
}

export interface ContextAnalysisResponse {
  proposalId: string;
  query: string;
  evaluations: EvaluatedContext[];
  summaryReasoning: string;
}

export interface MemoryCandidate {
  id: string;
  label: string;
  category: ContextCategory;
  content: string;
  privacyLevel: PrivacyLevel;
  status: 'PENDING' | 'SAVED' | 'IGNORED';
}

export interface QueryAuditLog {
  id: string;
  timestamp: string;
  userQuery: string;
  evaluations: EvaluatedContext[];
  contextBridgeAnswer: string;
  rawAnswer?: string;
  totalVaultCount: number;
  usedContextCount: number;
  privacySavedCount: number;
  snapshotHash: string;
  profileId: string;
  usedContexts: ContextItem[];
}

export interface PresetProfile {
  id: string;
  name: string;
  description: string;
  iconName: string;
  items: Omit<ContextItem, 'id' | 'updatedAt'>[];
}
