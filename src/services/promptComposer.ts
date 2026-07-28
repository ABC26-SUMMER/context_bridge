import { promptTemplates } from "../data/promptTemplates";
import type { DetectedIntent, SelectedContext } from "../types";

export function getPlainInput(intent: DetectedIntent): string {
  return promptTemplates[intent.id]?.plain || promptTemplates.easy_explanation.plain;
}

export function composeBridgePrompt(
  intent: DetectedIntent,
  approved: SelectedContext[],
  rejected: SelectedContext[],
): string {
  const template =
    promptTemplates[intent.id]?.bridge || promptTemplates.easy_explanation.bridge;

  if (approved.length === 0) {
    return "승인된 정보가 없습니다.\n\nContext Bridge는 사용자가 승인한 맥락만 사용해 프롬프트를 만듭니다. 정보를 승인한 뒤 다시 생성하세요.";
  }

  const rejectedValues = rejected.map((field) => field.value);
  let prompt = template;

  for (const value of rejectedValues) {
    const bullet = `- ${value}`;
    prompt = prompt.replace(`${bullet}\n`, "");
    prompt = prompt.replace(bullet, "");
  }

  if (rejectedValues.length > 0) {
    prompt += `\n\n사용자가 제외한 정보는 프롬프트에 반영하지 마세요: ${rejectedValues.join(", ")}`;
  }

  return prompt.trim();
}
