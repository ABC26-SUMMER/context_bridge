import type {
  ContextProfile,
  EvaluatedContext,
  ProposalResponse,
  QueryAuditLog,
} from "../../contracts/types";
import type {
  ContextAnalysis,
  DetectedIntent,
  InteractionRecord,
  SelectedContext,
  UserProfile,
} from "../types";

const exampleQuestions = {
  university_student: ["이번 방학에 뭐 공부해야 해?", "공기업 전산직 준비하려면 뭐부터 해야 해?", "우리 동네에서 공부하기 좋은 곳을 추천해 줘"],
  older_adult: ["내일 딸이랑 어디 가면 좋아?", "키오스크 쓰는 법 쉽게 알려줘", "집 근처에서 오래 걷지 않고 갈 곳을 알려줘"],
  custom: ["내 상황에 맞는 방법을 알려줘", "어디서부터 시작하면 좋을까?", "내 생활 환경에 맞는 장소를 추천해 줘"],
} as const;

export function mapContractProfile(profile: ContextProfile, accountId: string): UserProfile {
  const examples = [...exampleQuestions[profile.personaType]];

  return {
    id: profile.id,
    accountId,
    name: profile.displayName,
    group: profile.description || profile.name,
    profileName: profile.name,
    icon: profile.icon,
    description: profile.description,
    personaType: profile.personaType,
    source: "supabase",
    uiMode: profile.personaType === "older_adult" ? "easy" : "standard",
    defaultQuestion: examples[0],
    examples,
    fields: profile.contexts.map((context) => ({
      key: context.id,
      label: context.title,
      value: context.content,
      sensitivity: context.privacyLevel === "normal" ? "normal" : "sensitive",
      enabled: context.isActive,
      tags: context.tags,
      contextId: context.id,
      valueVisible: true,
      category: context.category,
      semanticGroup: context.category,
    })),
  };
}

export function mapProposalToAnalysis(proposal: ProposalResponse): ContextAnalysis {
  const included = proposal.evaluations.filter((evaluation) => !evaluation.exclusionReason);
  const excluded = proposal.evaluations.filter((evaluation) => Boolean(evaluation.exclusionReason));
  const selected = included.filter((evaluation) => evaluation.context.privacyLevel === "normal");
  const sensitive = included.filter((evaluation) => evaluation.context.privacyLevel !== "normal");

  return {
    intent: mapProposalIntent(proposal),
    selected: selected.map(mapEvaluation),
    sensitive: sensitive.map(mapEvaluation),
    excluded: excluded.map(mapEvaluation),
    source: "backend",
  };
}

export function getInitialApprovals(evaluations: EvaluatedContext[]) {
  return Object.fromEntries(
    evaluations.map((evaluation) => [
      evaluation.contextId,
      evaluation.suggested &&
        evaluation.context.privacyLevel === "normal" &&
        !evaluation.isStale &&
        !evaluation.requiresReview &&
        evaluation.valueVisible &&
        !evaluation.exclusionReason,
    ]),
  );
}

export function mapAuditLog(log: QueryAuditLog, profileName: string): InteractionRecord {
  const approvedIds = new Set(log.usedContexts.map((context) => context.id));
  const available = log.evaluations.filter((evaluation) => !evaluation.exclusionReason);

  return {
    profile: profileName,
    question: log.userQuery,
    answer: log.contextBridgeAnswer,
    rawAnswer: log.rawAnswer,
    intent: "API 맥락 선별",
    selected: available.map((evaluation) => visibleValue(evaluation)),
    approved: available.filter((evaluation) => approvedIds.has(evaluation.contextId)).map(visibleValue),
    rejected: available.filter((evaluation) => !approvedIds.has(evaluation.contextId)).map(visibleValue),
    sensitiveCount: available.filter((evaluation) => evaluation.context.privacyLevel !== "normal").length,
    createdAt: new Date(log.timestamp).toLocaleString("ko-KR"),
  };
}

function mapProposalIntent(proposal: ProposalResponse): DetectedIntent {
  return {
    id: proposal.proposalId,
    label: proposal.detectedIntent || '질문 기반 맥락 선별',
    confidence: getAverageScore(proposal.evaluations),
    keywords: [],
    reasons: Object.fromEntries(
      proposal.evaluations.map((evaluation) => [evaluation.contextId, evaluation.reason]),
    ),
  };
}

function mapEvaluation(evaluation: EvaluatedContext): SelectedContext {
  return {
    key: evaluation.contextId,
    contextId: evaluation.contextId,
    label: evaluation.context.title,
    value: visibleValue(evaluation),
    sensitivity: evaluation.context.privacyLevel === "normal" ? "normal" : "sensitive",
    enabled: evaluation.context.isActive,
    tags: [],
    reason: evaluation.reason,
    relevanceScore: evaluation.relevanceScore,
    isStale: evaluation.isStale,
    valueVisible: evaluation.valueVisible,
    exclusionReason: evaluation.exclusionReason,
    selectionRole: evaluation.selectionRole,
    impact: evaluation.impact,
    confidence: evaluation.confidence,
    integrityWarnings: evaluation.integrityWarnings,
    requiresReview: evaluation.requiresReview,
  };
}

function visibleValue(evaluation: EvaluatedContext) {
  return evaluation.valueVisible ? evaluation.context.content : "정책상 숨겨진 기밀 맥락";
}

function getAverageScore(evaluations: EvaluatedContext[]) {
  if (evaluations.length === 0) return 0;
  const total = evaluations.reduce((sum, evaluation) => sum + evaluation.relevanceScore, 0);
  return Math.round(total / evaluations.length);
}
