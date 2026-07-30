import type { UiMode } from "../types";

export function getUiModeLabel(uiMode: UiMode): string {
  if (uiMode === "easy") return "쉬운 모드";
  if (uiMode === "detail") return "상세 모드";
  return "기본 모드";
}

export function getUiModeDescription(uiMode: UiMode): string {
  if (uiMode === "easy") {
    return "큰 글씨, 짧은 문장, 적은 설명으로 보여줍니다.";
  }
  if (uiMode === "detail") {
    return "선택 이유와 규칙 매칭 과정을 자세히 보여줍니다.";
  }
  return "맥락 선택과 프롬프트 개선 과정을 균형 있게 보여줍니다.";
}
