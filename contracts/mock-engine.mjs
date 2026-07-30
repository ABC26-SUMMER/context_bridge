import { randomUUID } from "node:crypto";

const intentRules = [
  {
    query: ["키오스크", "스마트폰", "앱", "인터넷", "결제", "사용법"],
    contextTitles: ["디지털 숙련도", "접근성 선호", "답변 방식"],
  },
  {
    query: ["어디", "장소", "외출", "여행", "추천", "이동"],
    contextTitles: ["이동 접근성", "이동 수단", "장소 선호", "연령대"],
  },
  {
    query: ["공부", "취업", "자격증", "진로", "시험", "방학"],
    contextTitles: ["전공", "학년", "진로 목표", "자격증 목표", "현재 기술", "공부 가능 시간", "답변 방식"],
  },
];

export function resolvePersona(authorization) {
  if (authorization.includes("demo-senior")) return "senior";

  const token = authorization.replace(/^Bearer\s+/i, "");
  const payload = decodeJwtPayload(token);
  const email = String(payload?.email || "").toLowerCase();
  const persona = String(payload?.user_metadata?.persona_type || "").toLowerCase();
  return email.includes("senior") || persona === "older_adult" ? "senior" : "student";
}

export function buildProposal({ profile, profileId, query }) {
  const normalizedQuery = query.trim();
  const matchedRule = intentRules.find((rule) => rule.query.some((keyword) => normalizedQuery.includes(keyword)));
  const queryTerms = normalizedQuery.split(/[\s,.?!]+/).filter((term) => term.length >= 2);

  const evaluations = profile.contexts.map((context, index) => {
    const searchable = [context.title, context.content, ...context.tags].join(" ");
    const ruleMatch = matchedRule?.contextTitles.includes(context.title) ?? false;
    const termMatch = queryTerms.some((term) => searchable.includes(term));
    const restricted = context.privacyLevel === "confidential";
    const disabled = !context.isActive;
    const relevant = ruleMatch || termMatch;
    const exclusionReason = restricted ? "RESTRICTED" : disabled ? "DISABLED" : relevant ? undefined : "UNRELATED";
    const relevanceScore = restricted ? 0 : relevant ? Math.max(68, 94 - index * 3) : 18;

    return {
      contextId: context.id,
      context: {
        ...context,
        content: restricted ? "정책상 숨겨진 기밀 맥락" : context.content,
      },
      relevanceScore,
      reason: restricted
        ? "기밀 정보는 Mock 답변 생성에서 제외합니다."
        : relevant
          ? `"${normalizedQuery}"에 필요한 ${context.title} 맥락입니다.`
          : "이번 질문과 직접 관련이 없어 제외했습니다.",
      suggested: relevant && context.privacyLevel === "normal",
      approvedByUser: false,
      isStale: false,
      ...(exclusionReason ? { exclusionReason } : {}),
      valueVisible: !restricted,
    };
  });

  return {
    proposalId: randomUUID(),
    profileId,
    profile,
    query: normalizedQuery,
    evaluations,
    selectionMode: "rules",
    summaryReasoning: matchedRule
      ? "질문의 핵심 단어와 프로필 카드 태그를 비교해 후보를 골랐습니다."
      : "질문과 직접 일치하는 프로필 카드만 후보로 골랐습니다.",
  };
}

export function publicProposal(proposal) {
  return {
    proposalId: proposal.proposalId,
    query: proposal.query,
    evaluations: proposal.evaluations,
    selectionMode: proposal.selectionMode,
    summaryReasoning: proposal.summaryReasoning,
  };
}

export function buildAnswer(proposal, approvedIds) {
  const approved = new Set(approvedIds);
  const available = proposal.evaluations.filter((evaluation) => !evaluation.exclusionReason);
  const usedEvaluations = available.filter((evaluation) => approved.has(evaluation.contextId));
  const usedContexts = usedEvaluations.map((evaluation) => evaluation.context);
  const approvedLabels = usedContexts.map((context) => context.title);
  const contextBridgeAnswer = createAnswer(proposal.query, approvedLabels);
  const rawAnswer = `일반 답변(Mock): "${proposal.query}"에 대한 일반적인 안내입니다.`;
  const timestamp = new Date().toISOString();

  return {
    contextBridgeAnswer,
    rawAnswer,
    usedContexts,
    usedContextsCount: usedContexts.length,
    snapshotHash: `mock-${proposal.proposalId}-${usedContexts.length}`,
    memoryCandidates: [],
    auditLog: {
      id: randomUUID(),
      timestamp,
      userQuery: proposal.query,
      evaluations: proposal.evaluations.map((evaluation) => ({
        ...evaluation,
        approvedByUser: approved.has(evaluation.contextId),
      })),
      contextBridgeAnswer,
      rawAnswer,
      totalVaultCount: proposal.evaluations.length,
      usedContextCount: usedContexts.length,
      privacySavedCount: proposal.evaluations.length - usedContexts.length,
      snapshotHash: `mock-${proposal.proposalId}-${usedContexts.length}`,
      profileId: proposal.profileId,
      usedContexts,
    },
  };
}

function createAnswer(query, approvedLabels) {
  const contextSummary =
    approvedLabels.length > 0
      ? `승인한 정보(${approvedLabels.join(", ")})를 반영했습니다.`
      : "승인한 개인 정보 없이 일반 안내를 제공합니다.";

  if (["키오스크", "결제", "사용법"].some((keyword) => query.includes(keyword))) {
    return [
      `요청하신 "${query}"에 답변드릴게요.`,
      contextSummary,
      "",
      "1. 화면에서 원하는 메뉴를 천천히 누릅니다.",
      "2. 수량과 옵션을 확인하고 다음 버튼을 누릅니다.",
      "3. 결제 방법을 선택한 뒤 카드나 현금을 안내된 위치에 넣습니다.",
      "4. 어려우면 처음 화면으로 돌아가거나 직원 호출 버튼을 누릅니다.",
    ].join("\n");
  }

  return [`요청하신 "${query}"에 대한 개인화 Mock 답변입니다.`, contextSummary].join("\n");
}

function decodeJwtPayload(token) {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}
