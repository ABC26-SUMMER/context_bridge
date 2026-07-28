export type Sensitivity = "normal" | "sensitive";
export type UiMode = "easy" | "standard" | "detail";

export type ProfileField = {
  key: string;
  label: string;
  value: string;
  sensitivity: Sensitivity;
  enabled: boolean;
  tags: string[];
};

export type UserProfile = {
  id: string;
  name: string;
  group: string;
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
};

export type PromptTemplate = {
  plain: string;
  bridge: string;
};

export type InteractionRecord = {
  profile: string;
  question: string;
  intent: string;
  selected: string[];
  approved: string[];
  rejected: string[];
  sensitiveCount: number;
  createdAt: string;
};
