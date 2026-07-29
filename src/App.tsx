import { useEffect, useMemo, useState } from "react";
import type { AnswerResponse, MemoryCandidate, SelectionMode } from "../contracts/types";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { ContextLog } from "./components/ContextLog";
import { LoginScreen } from "./components/LoginScreen";
import { ProfileManager } from "./components/ProfileManager";
import { Sidebar } from "./components/Sidebar";
import { demoAccounts, demoProfiles } from "./data/profiles";
import { createProposal, generateAnswer, getBootstrap, resolveMemory } from "./services/contractApi";
import {
  getInitialApprovals,
  mapAuditLog,
  mapContractProfile,
  mapProposalToAnalysis,
} from "./services/contractMappers";
import { loadAccounts } from "./services/profileRepository";
import { getAnalyzedQuality, getGeneratedQuality, getIdleQuality } from "./services/qualityAnalyzer";
import type {
  ContextAnalysis,
  DemoAccount,
  DetectedIntent,
  InteractionRecord,
  SelectedContext,
  UserProfile,
} from "./types";

type QualityMode = "idle" | "analyzed" | "generated";
type RetryStage = "proposal" | "generate" | null;

export default function App() {
  const [activePage, setActivePage] = useState("main");
  const [accounts, setAccounts] = useState<DemoAccount[]>(demoAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [emptyProfile, setEmptyProfile] = useState(false);
  const [lastLoginAccountId, setLastLoginAccountId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [question, setQuestion] = useState(demoProfiles[0].defaultQuestion);
  const [intent, setIntent] = useState<DetectedIntent | null>(null);
  const [selected, setSelected] = useState<SelectedContext[]>([]);
  const [sensitive, setSensitive] = useState<SelectedContext[]>([]);
  const [excluded, setExcluded] = useState<SelectedContext[]>([]);
  const [analysisSource, setAnalysisSource] = useState<ContextAnalysis["source"]>();
  const [selectionMode, setSelectionMode] = useState<SelectionMode>();
  const [proposalId, setProposalId] = useState("");
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [bridgeAnswer, setBridgeAnswer] = useState("");
  const [answerCompleted, setAnswerCompleted] = useState(false);
  const [rawAnswer, setRawAnswer] = useState("");
  const [memoryCandidates, setMemoryCandidates] = useState<MemoryCandidate[]>([]);
  const [memoryResolvingId, setMemoryResolvingId] = useState("");
  const [memoryActions, setMemoryActions] = useState<Record<string, "save" | "ignore">>({});
  const [apiError, setApiError] = useState("");
  const [retryStage, setRetryStage] = useState<RetryStage>(null);
  const [qualityMode, setQualityMode] = useState<QualityMode>("idle");
  const [records, setRecords] = useState<InteractionRecord[]>([]);

  useEffect(() => {
    loadAccounts()
      .then(setAccounts)
      .finally(() => setLoadingAccounts(false));
  }, []);

  const currentAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) || null,
    [accounts, selectedAccountId],
  );

  const approvalPool = [...selected, ...sensitive];
  const approved = approvalPool.filter((field) => approvals[field.key]);
  const rejected = approvalPool.filter((field) => !approvals[field.key]);
  const selectedCount = approvalPool.length;
  const approvedCount = approved.length;
  const sensitiveCount = sensitive.length;
  const uiMode = currentProfile?.uiMode || "standard";
  const easy = uiMode === "easy";

  const quality =
    qualityMode === "generated"
      ? getGeneratedQuality(question, approved)
      : qualityMode === "analyzed"
        ? getAnalyzedQuality()
        : getIdleQuality();

  const login = async (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId) || demoAccounts[0];
    const token = account.personaType === "older_adult" ? "demo-senior" : "demo-student";

    setLoadingProfile(true);
    setLoginError("");
    setEmptyProfile(false);
    setLastLoginAccountId(accountId);

    try {
      const bootstrap = await getBootstrap(token);
      const contractProfile = bootstrap.profiles[0];

      if (!contractProfile) {
        setEmptyProfile(true);
        return;
      }

      const profile = mapContractProfile(contractProfile, account.id);
      setApiToken(token);
      setSelectedAccountId(account.id);
      setCurrentProfile(profile);
      setRecords(bootstrap.auditLogs.map((log) => mapAuditLog(log, profile.name)));
      resetAnalysis(profile.defaultQuestion);
    } catch (error) {
      setLoginError(getErrorMessage(error));
    } finally {
      setLoadingProfile(false);
    }
  };

  const logout = () => {
    setSelectedAccountId(null);
    setApiToken("");
    setCurrentProfile(null);
    setLoginError("");
    setEmptyProfile(false);
    setLastLoginAccountId(null);
    resetAnalysis(demoProfiles[0].defaultQuestion);
    setActivePage("main");
  };

  const resetAnalysis = (nextQuestion = currentProfile?.defaultQuestion || question) => {
    setIntent(null);
    setSelected([]);
    setSensitive([]);
    setExcluded([]);
    setAnalysisSource(undefined);
    setSelectionMode(undefined);
    setProposalId("");
    setApprovals({});
    setBridgeAnswer("");
    setAnswerCompleted(false);
    setRawAnswer("");
    setMemoryCandidates([]);
    setMemoryResolvingId("");
    setMemoryActions({});
    setApiError("");
    setRetryStage(null);
    setQuestion(nextQuestion);
    setQualityMode("idle");
  };

  const analyze = async () => {
    if (!currentProfile || !apiToken) return;
    const normalizedQuestion = question.trim() || currentProfile.defaultQuestion;

    setAnalyzing(true);
    setApiError("");
    setRetryStage(null);
    setIntent(null);
    setSelected([]);
    setSensitive([]);
    setExcluded([]);
    setProposalId("");
    setApprovals({});
    setBridgeAnswer("");
    setAnswerCompleted(false);
    setRawAnswer("");
    setMemoryCandidates([]);

    try {
      const proposal = await createProposal(apiToken, {
        profileId: currentProfile.id,
        query: normalizedQuestion,
      });
      const analysis = mapProposalToAnalysis(proposal);

      setQuestion(normalizedQuestion);
      setProposalId(proposal.proposalId);
      setSelectionMode(proposal.selectionMode);
      setIntent(analysis.intent);
      setSelected(analysis.selected);
      setSensitive(analysis.sensitive);
      setExcluded(analysis.excluded);
      setAnalysisSource(analysis.source);
      setApprovals(getInitialApprovals(proposal.evaluations));
      setQualityMode("analyzed");
    } catch (error) {
      setApiError(getErrorMessage(error));
      setRetryStage("proposal");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleApproval = (key: string, value: boolean) => {
    const field = approvalPool.find((item) => item.key === key);
    if (field?.valueVisible === false) return;

    setApprovals((current) => ({ ...current, [key]: value }));
    if (qualityMode === "generated") {
      setQualityMode("analyzed");
      setBridgeAnswer("");
      setAnswerCompleted(false);
      setRawAnswer("");
      setMemoryCandidates([]);
    }
  };

  const generate = async () => {
    if (!proposalId || !apiToken || !currentProfile || generating) return;

    setGenerating(true);
    setApiError("");
    setRetryStage(null);

    try {
      const answer = await generateAnswer(apiToken, proposalId, {
        approvedIds: approved.map((field) => field.contextId || field.key),
        includeRawComparison: true,
      });

      applyAnswer(answer);
      setRecords((current) => [mapAuditLog(answer.auditLog, currentProfile.name), ...current]);
    } catch (error) {
      setApiError(getErrorMessage(error));
      setRetryStage("generate");
    } finally {
      setGenerating(false);
    }
  };

  const applyAnswer = (answer: AnswerResponse) => {
    setBridgeAnswer(answer.contextBridgeAnswer);
    setAnswerCompleted(true);
    setRawAnswer(answer.rawAnswer || "");
    setMemoryCandidates(answer.memoryCandidates);
    setMemoryActions({});
    setQualityMode("generated");
  };

  const resolveMemoryCandidate = async (candidateId: string, action: "save" | "ignore") => {
    if (!apiToken || memoryResolvingId) return;

    setMemoryResolvingId(candidateId);
    setApiError("");

    try {
      const response = await resolveMemory(apiToken, candidateId, { action });
      setMemoryActions((current) => ({ ...current, [candidateId]: action }));

      if (response.context && currentProfile) {
        setCurrentProfile({
          ...currentProfile,
          fields: [
            ...currentProfile.fields,
            {
              key: response.context.id,
              contextId: response.context.id,
              label: response.context.title,
              value: response.context.content,
              sensitivity: response.context.privacyLevel === "normal" ? "normal" : "sensitive",
              enabled: response.context.isActive,
              tags: response.context.tags,
              valueVisible: true,
            },
          ],
        });
      }
    } catch (error) {
      setApiError(getErrorMessage(error));
      setRetryStage(null);
    } finally {
      setMemoryResolvingId("");
    }
  };

  const retry = () => {
    if (retryStage === "proposal") {
      void analyze();
    } else if (retryStage === "generate") {
      void generate();
    }
  };

  if (!currentAccount || !currentProfile) {
    return (
      <LoginScreen
        accounts={accounts}
        loading={loadingAccounts || loadingProfile}
        error={loginError}
        emptyProfile={emptyProfile}
        onLogin={login}
        onRetry={lastLoginAccountId ? () => login(lastLoginAccountId) : undefined}
      />
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-[300px_minmax(0,1fr)] bg-surface max-lg:grid-cols-1">
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        account={currentAccount}
        profile={currentProfile}
        selectedCount={selectedCount}
        approvedCount={approvedCount}
        sensitiveCount={sensitiveCount}
        intent={intent}
        selected={selected}
        sensitive={sensitive}
        approvals={approvals}
        onToggleApproval={toggleApproval}
        onLogout={logout}
      />
      <main className={`${easy ? "text-lg" : ""}`}>
        {activePage === "main" && (
          <ChatWorkspace
            account={currentAccount}
            profile={currentProfile}
            question={question}
            analyzing={analyzing}
            generating={generating}
            intent={intent}
            selected={selected}
            sensitive={sensitive}
            excluded={excluded}
            approvals={approvals}
            source={analysisSource}
            selectionMode={selectionMode}
            bridgePrompt={bridgeAnswer}
            answerCompleted={answerCompleted}
            rawAnswer={rawAnswer}
            quality={quality}
            uiMode={uiMode}
            apiError={apiError}
            canRetry={Boolean(retryStage)}
            memoryCandidates={memoryCandidates}
            memoryResolvingId={memoryResolvingId}
            memoryActions={memoryActions}
            onQuestionChange={setQuestion}
            onAnalyze={analyze}
            onGenerate={generate}
            onRetry={retry}
            onResolveMemory={resolveMemoryCandidate}
            onReset={() => resetAnalysis()}
          />
        )}

        {activePage === "profile" && (
          <div className="p-7 max-sm:p-4">
            <ProfileManager profiles={[currentProfile]} profileId={currentProfile.id} onProfileChange={() => undefined} />
          </div>
        )}

        {activePage === "history" && (
          <div className="p-7 max-sm:p-4">
            <ContextLog records={records} />
          </div>
        )}
      </main>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}
