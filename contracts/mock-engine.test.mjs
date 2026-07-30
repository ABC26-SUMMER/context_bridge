import { describe, expect, it } from "vitest";
import { buildAnswer, buildProposal, publicProposal, resolvePersona } from "./mock-engine.mjs";

const seniorProfile = {
  id: "senior-profile",
  contexts: [
    {
      id: "digital",
      title: "디지털 숙련도",
      category: "constraint",
      content: "초급",
      tags: ["디지털", "설명"],
      isActive: true,
      privacyLevel: "sensitive",
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
    {
      id: "answer-style",
      title: "답변 방식",
      category: "preference",
      content: "짧고 쉬운 설명",
      tags: ["답변", "설명"],
      isActive: true,
      privacyLevel: "normal",
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
    {
      id: "walking",
      title: "이동 접근성",
      category: "constraint",
      content: "장시간 보행 어려움",
      tags: ["이동", "접근성"],
      isActive: true,
      privacyLevel: "sensitive",
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
    {
      id: "medicine",
      title: "복용 약물",
      category: "constraint",
      content: "혈압약",
      tags: ["건강"],
      isActive: true,
      privacyLevel: "confidential",
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
  ],
};

describe("mock engine", () => {
  it("detects a senior Supabase JWT by email", () => {
    const payload = Buffer.from(JSON.stringify({ email: "senior-test@example.com" })).toString("base64url");
    expect(resolvePersona(`Bearer header.${payload}.signature`)).toBe("senior");
  });

  it("uses the current query and senior contexts for a proposal", () => {
    const proposal = buildProposal({
      profile: seniorProfile,
      profileId: "actual-profile-id",
      query: "키오스크 쓰는 법을 알려줘",
    });
    const response = publicProposal(proposal);

    expect(response.query).toBe("키오스크 쓰는 법을 알려줘");
    expect(response.evaluations.find((item) => item.contextId === "digital")?.exclusionReason).toBeUndefined();
    expect(response.evaluations.find((item) => item.contextId === "walking")?.exclusionReason).toBe("UNRELATED");
    expect(response.evaluations.find((item) => item.contextId === "medicine")?.exclusionReason).toBe("RESTRICTED");
  });

  it("uses the approved IDs and proposal query in the generated answer", () => {
    const proposal = buildProposal({
      profile: seniorProfile,
      profileId: "actual-profile-id",
      query: "키오스크 쓰는 법을 알려줘",
    });
    const answer = buildAnswer(proposal, ["answer-style"]);

    expect(answer.contextBridgeAnswer).toContain("키오스크 쓰는 법을 알려줘");
    expect(answer.contextBridgeAnswer).toContain("답변 방식");
    expect(answer.usedContextsCount).toBe(1);
    expect(answer.auditLog.userQuery).toBe("키오스크 쓰는 법을 알려줘");
  });
});
