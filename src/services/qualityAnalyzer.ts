import type { SelectedContext } from "../types";

export type QualityState = {
  before: string[];
  after: string[];
  copyEnabled: boolean;
};

export function getIdleQuality(): QualityState {
  return {
    before: ["아직 질문 의도와 필요한 맥락을 분석하지 않았습니다."],
    after: ["분석 후 어떤 정보가 선택·제외됐는지 보여줍니다."],
    copyEnabled: false,
  };
}

export function getAnalyzedQuality(): QualityState {
  return {
    before: [
      "원래 질문만으로는 AI가 사용자의 상황을 추측해야 합니다.",
      "목표, 제약, 출력 방식이 명확하지 않습니다.",
      "어떤 개인정보가 쓰이는지 사용자가 확인하기 어렵습니다.",
    ],
    after: [
      "질문 의도에 맞는 정보만 규칙 기반으로 골랐습니다.",
      "민감할 수 있는 정보는 기본 제외하고 사용자 승인 뒤에만 전달합니다.",
      "선택된 정보와 제외된 정보를 UI에서 확인할 수 있습니다.",
    ],
    copyEnabled: false,
  };
}

export function getGeneratedQuality(question: string, approved: SelectedContext[]): QualityState {
  const hasApproved = approved.length > 0;
  const hasSensitive = approved.some((field) => field.sensitivity === "sensitive");

  return {
    before: [
      `"${question}"처럼 짧은 질문은 AI가 필요한 조건을 임의로 추측할 수 있습니다.`,
      "AI를 잘 쓰는 사람이 직접 넣는 목적, 조건, 출력 형식이 부족합니다.",
    ],
    after: [
      hasApproved
        ? `${approved.length}개의 승인된 맥락만 개인화 답변에 반영했습니다.`
        : "승인된 맥락 없이 일반 답변으로 제한했습니다.",
      "원래 질문을 보존하면서 필요한 목적, 조건, 제약을 함께 전달했습니다.",
      hasSensitive
        ? "민감 정보는 사용자가 직접 체크한 항목만 포함했습니다."
        : "민감 정보는 포함하지 않았습니다.",
    ],
    copyEnabled: true,
  };
}
