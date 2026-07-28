import type { DetectedIntent, SelectedContext, UserProfile } from "../types";

export function selectContext(profile: UserProfile, intent: DetectedIntent): SelectedContext[] {
  return profile.fields
    .filter((field) => field.enabled && field.tags.includes(intent.id))
    .map((field) => ({
      ...field,
      reason:
        intent.reasons[field.label] ||
        "현재 질문을 더 좋은 프롬프트로 바꾸기 위해 필요한 정보입니다.",
    }));
}
