import type { DetectedIntent, SelectedContext } from "../types";

export function getPlainInput(question: string): string {
  return question;
}

export function composeBridgePrompt(
  question: string,
  intent: DetectedIntent,
  approved: SelectedContext[],
  rejected: SelectedContext[],
): string {
  if (approved.length === 0) {
    return [
      "사용자가 승인한 정보가 없습니다.",
      "",
      `원래 질문: "${question}"`,
      "개인 맥락 없이도 답할 수 있는 일반적인 안내만 생성하세요.",
    ].join("\n");
  }

  const contextLines = approved.map((field) => `- ${field.label}: ${field.value}`);
  const excludedLines = rejected.map((field) => `- ${field.label}: ${field.value}`);

  return [
    "너는 사용자의 짧은 질문을 더 좋은 AI 명령문으로 바꾸는 Context Bridge다.",
    "답변을 바로 만들지 말고, 아래 정보를 반영해 다른 AI에게 넣을 고급 프롬프트를 작성하라.",
    "",
    `원래 질문: "${question}"`,
    `분석된 의도: ${intent.label}`,
    "",
    "사용자가 승인한 맥락:",
    ...contextLines,
    "",
    "작성 지침:",
    "1. 사용자의 원래 질문을 보존한다.",
    "2. 승인된 맥락만 사용한다.",
    "3. 목적, 조건, 제약, 출력 형식을 명확히 포함한다.",
    "4. 민감하거나 승인되지 않은 정보는 추측하거나 포함하지 않는다.",
    "5. 최종 결과는 바로 복사해 다른 AI에 넣을 수 있는 프롬프트 형태로 작성한다.",
    ...(excludedLines.length
      ? ["", "사용자가 승인하지 않았거나 제외한 정보:", ...excludedLines]
      : []),
  ].join("\n");
}
