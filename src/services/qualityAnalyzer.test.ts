import { describe, expect, it } from "vitest";
import type { SelectedContext } from "../types";
import { getGeneratedQuality, getIdleQuality } from "./qualityAnalyzer";

describe("qualityAnalyzer", () => {
  it("keeps copy disabled before an answer is generated", () => {
    expect(getIdleQuality().copyEnabled).toBe(false);
  });

  it("reports approved sensitive context explicitly", () => {
    const sensitiveContext: SelectedContext = {
      key: "accessibility",
      label: "접근성 선호",
      value: "큰 글씨",
      sensitivity: "sensitive",
      enabled: true,
      tags: [],
      reason: "답변 형식에 필요",
    };

    const quality = getGeneratedQuality("쉽게 설명해 줘", [sensitiveContext]);

    expect(quality.copyEnabled).toBe(true);
    expect(quality.after).toContain("1개의 승인된 맥락만 개인화 답변에 반영했습니다.");
    expect(quality.after).toContain("민감 정보는 사용자가 직접 체크한 항목만 포함했습니다.");
  });
});
