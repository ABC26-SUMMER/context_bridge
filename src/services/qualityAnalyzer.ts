import type { SelectedContext } from "../types";

export type QualityState = {
  before: string[];
  after: string[];
  copyEnabled: boolean;
};

export function getIdleQuality(): QualityState {
  return {
    before: ["분석 후 원문 입력에 부족한 요소를 표시합니다."],
    after: ["고급 프롬프트 생성 후 보강된 요소를 표시합니다."],
    copyEnabled: false,
  };
}

export function getAnalyzedQuality(): QualityState {
  return {
    before: [
      "사용자 의도는 보이지만 목적이 구체적인 명령으로 정리되지 않았습니다.",
      "사용자 맥락과 제약조건이 원문에 들어 있지 않습니다.",
      "AI가 어떤 형식으로 출력해야 하는지 알 수 없습니다.",
    ],
    after: ["Context Preview에서 추가할 맥락을 승인하면 고급 프롬프트가 만들어집니다."],
    copyEnabled: false,
  };
}

export function getGeneratedQuality(question: string, approved: SelectedContext[]): QualityState {
  const labels = new Set(approved.map((field) => field.label));
  const hasSensitive = approved.some((field) => field.sensitivity === "sensitive");
  const hasOutput = labels.has("출력 형식");
  const hasConstraint = approved.some((field) => field.key.startsWith("constraints"));
  const hasPreference = approved.some((field) => field.key.startsWith("preferences"));

  return {
    before: [
      `원문은 ${question.length}자라서 AI가 필요한 조건을 추측해야 합니다.`,
      "역할 지시가 없어 AI가 어떤 관점으로 처리해야 할지 불명확합니다.",
      "제약조건과 출력 형식이 빠져 결과 품질이 사용자 입력 역량에 의존합니다.",
    ],
    after: [
      "AI가 맡을 역할을 먼저 지정했습니다.",
      "사용자의 원래 질문을 보존했습니다.",
      ...(hasPreference ? ["취향과 선호를 명령문에 추가했습니다."] : []),
      ...(hasConstraint ? ["예산, 이동, 시간 같은 제약조건을 추가했습니다."] : []),
      ...(hasOutput ? ["출력 형식과 설명 방식을 명확히 지시했습니다."] : []),
      hasSensitive
        ? "민감정보는 Context Preview에서 승인된 뒤에만 포함했습니다."
        : "민감정보 없이 필요한 맥락만 구성했습니다.",
    ],
    copyEnabled: true,
  };
}
