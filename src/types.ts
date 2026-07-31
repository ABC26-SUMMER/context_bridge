import type { ContextCategory } from "../contracts/types";

export type Sensitivity = "normal" | "sensitive" | "confidential";
export type UiMode = "easy" | "standard" | "detail";

export type DemoAccount = {
  id: string;
  email: string;
  displayName: string;
  personaType: string;
  description: string;
  profileId?: string;
  source?: "supabase" | "demo";
};

export type ProfileField = {
  key: string;
  label: string;
  value: string;
  sensitivity: Sensitivity;
  enabled: boolean;
  tags: string[]; // 레거시 호환, UI 입력에서는 숨김
  contextId?: string;
  valueVisible?: boolean;
  category?: ContextCategory;
  semanticGroup?: string;
  version?: number;
};

export type UserProfile = {
  id: string;
  accountId: string;
  name: string;
  group: string;
  personaType: string;
  profileName?: string;
  icon?: string;
  description?: string;
  source?: "supabase" | "demo";
  uiMode: UiMode;
  defaultQuestion: string;
  examples: string[];
  fields: ProfileField[];
};

export type IntentRule = {
  id: string;
  label: string;
  confidence: number;
  keywords: string[];
  reasons: Record<string, string>;
};

export type DetectedIntent = IntentRule & {
  lowConfidence?: boolean;
};

export type SelectedContext = ProfileField & {
  reason: string;
  relevanceScore?: number;
  isStale?: boolean;
  exclusionReason?: "UNRELATED" | "DISABLED" | "RESTRICTED";
  selectionRole?: 'must_use' | 'should_use' | 'optional' | 'ignore';
  impact?: string;
  confidence?: number;
  integrityWarnings?: string[];
  requiresReview?: boolean;
};

export type ContextAnalysis = {
  intent: DetectedIntent;
  selected: SelectedContext[];
  excluded: SelectedContext[];
  sensitive: SelectedContext[];
  source: "backend" | "frontend";
};

export type PromptTemplate = {
  plain: string;
  bridge: string;
};

export type InteractionRecord = {
  profile: string;
  question: string;
  answer: string;
  rawAnswer?: string;
  intent: string;
  selected: string[];
  approved: string[];
  rejected: string[];
  sensitiveCount: number;
  createdAt: string;
};

export type ConversationTurn = {
  id: string;
  question: string;
  answer: string;
  rawAnswer?: string;
  approvedContextCount: number;
  createdAt: string;
};

export type ConversationSession = {
  id: string;
  profileId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: ConversationTurn[];
};
