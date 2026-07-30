import { describe, expect, it } from "vitest";
import type { EvaluatedContext, ProposalResponse } from "../../contracts/types";
import { getInitialApprovals, mapProposalToAnalysis } from "./contractMappers";

const normalEvaluation = createEvaluation({
  id: "normal",
  privacyLevel: "normal",
  suggested: true,
});

const sensitiveEvaluation = createEvaluation({
  id: "sensitive",
  privacyLevel: "sensitive",
  suggested: true,
});

const hiddenEvaluation = createEvaluation({
  id: "hidden",
  privacyLevel: "confidential",
  suggested: true,
  valueVisible: false,
});

const excludedEvaluation = createEvaluation({
  id: "excluded",
  privacyLevel: "normal",
  suggested: true,
  exclusionReason: "UNRELATED",
});

describe("getInitialApprovals", () => {
  it("suggested and visible contexts only start approved", () => {
    expect(getInitialApprovals([normalEvaluation, hiddenEvaluation, excludedEvaluation])).toEqual({
      normal: true,
      hidden: false,
      excluded: false,
    });
  });
});

describe("mapProposalToAnalysis", () => {
  it("separates normal, sensitive, and excluded contexts", () => {
    const proposal: ProposalResponse = {
      proposalId: "proposal-1",
      query: "내 상황에 맞게 알려줘",
      evaluations: [normalEvaluation, sensitiveEvaluation, hiddenEvaluation, excludedEvaluation],
      selectionMode: "rules",
      summaryReasoning: "테스트",
    };

    const analysis = mapProposalToAnalysis(proposal);

    expect(analysis.selected.map((item) => item.key)).toEqual(["normal"]);
    expect(analysis.sensitive.map((item) => item.key)).toEqual(["sensitive", "hidden"]);
    expect(analysis.excluded.map((item) => item.key)).toEqual(["excluded"]);
    expect(analysis.sensitive[1].value).toBe("정책상 숨겨진 기밀 맥락");
    expect(analysis.intent.confidence).toBe(75);
  });
});

function createEvaluation({
  id,
  privacyLevel,
  suggested,
  valueVisible = true,
  exclusionReason,
}: {
  id: string;
  privacyLevel: "normal" | "sensitive" | "confidential";
  suggested: boolean;
  valueVisible?: boolean;
  exclusionReason?: "UNRELATED";
}): EvaluatedContext {
  return {
    contextId: id,
    context: {
      id,
      title: `${id} 카드`,
      category: "profile",
      content: `${id} 값`,
      tags: [],
      isActive: true,
      privacyLevel,
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
    relevanceScore: 75,
    reason: "질문과 관련 있음",
    suggested,
    approvedByUser: false,
    isStale: false,
    exclusionReason,
    valueVisible,
  };
}
