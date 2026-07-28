import type { ContextAnalysis, DetectedIntent, SelectedContext, UserProfile } from "../types";

const defaultReason = "현재 질문에 필요한 맥락인지 규칙 엔진이 확인했습니다.";

export function selectContext(profile: UserProfile, intent: DetectedIntent): SelectedContext[] {
  return profile.fields
    .filter((field) => field.enabled && field.tags.includes(intent.id) && field.sensitivity !== "sensitive")
    .map((field) => ({
      ...field,
      reason: intent.reasons[field.label] || defaultReason,
    }));
}

export function analyzeContext(profile: UserProfile, intent: DetectedIntent, source: ContextAnalysis["source"]): ContextAnalysis {
  const enabledFields = profile.fields.filter((field) => field.enabled);
  const matchedFields = enabledFields.filter((field) => field.tags.includes(intent.id));

  const selected = matchedFields
    .filter((field) => field.sensitivity !== "sensitive")
    .map((field) => ({ ...field, reason: intent.reasons[field.label] || defaultReason }));

  const sensitive = matchedFields
    .filter((field) => field.sensitivity === "sensitive")
    .map((field) => ({
      ...field,
      reason: `${intent.reasons[field.label] || defaultReason} 민감할 수 있어 기본적으로 제외하고 사용자가 직접 승인할 때만 전달합니다.`,
    }));

  const excluded = enabledFields
    .filter((field) => !field.tags.includes(intent.id))
    .map((field) => ({
      ...field,
      reason: "이번 질문의 의도와 직접 관련이 낮아 제외했습니다.",
    }));

  return { intent, selected, excluded, sensitive, source };
}
