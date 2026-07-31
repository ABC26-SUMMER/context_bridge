import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AnswerResponse, MemoryCandidate, SelectionMode } from "../contracts/types";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { ContextLog } from "./components/ContextLog";
import { LoginScreen } from "./components/LoginScreen";
import { ProfileManager } from "./components/ProfileManager";
import { ProfileOnboarding } from "./components/ProfileOnboarding";
import { Sidebar } from "./components/Sidebar";
import {
  getCurrentSession,
  onSessionChange,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from "./services/authService";
import { createProposal, generateAnswer, resolveMemory, structureContext } from "./services/contractApi";
import {
  getInitialApprovals,
  mapAuditLog,
  mapProposalToAnalysis,
} from "./services/contractMappers";
import {
  createContextCard,
  createProfile,
  deleteContextCard,
  loadProfilesForUser,
  loadQuestionHistory,
  updateContextCard,
  updateProfile,
  type ContextCardInput,
  type ProfileInput,
} from "./services/profileRepository";
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
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState("");
  const [dataLoading, setDataLoading] = useState(false);
  const [dataSaving, setDataSaving] = useState(false);
  const [dataError, setDataError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [question, setQuestion] = useState("내 상황에 맞는 계획을 세워 줘");
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
    let active = true;

    getCurrentSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setAuthError(error.message);
        setSession(data.session);
        setAuthReady(true);
      })
      .catch((error) => {
        if (!active) return;
        setAuthError(getErrorMessage(error));
        setAuthReady(true);
      });

    const { data } = onSessionChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthReady(true);

      if (!nextSession) {
        setProfiles([]);
        setCurrentProfileId("");
        setRecords([]);
        setActivePage("main");
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    void refreshUserData();
  }, [session?.user.id]);

  const currentProfile = useMemo(
    () => profiles.find((profile) => profile.id === currentProfileId) || profiles[0] || null,
    [profiles, currentProfileId],
  );

  const currentAccount = useMemo<DemoAccount | null>(() => {
    if (!session || !currentProfile) return null;

    return {
      id: session.user.id,
      email: session.user.email || "",
      displayName: currentProfile.name,
      personaType: currentProfile.personaType,
      description: currentProfile.group,
      profileId: currentProfile.id,
      source: "supabase",
    };
  }, [session, currentProfile]);

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

  const refreshUserData = async (preferredProfileId?: string) => {
    setDataLoading(true);
    setDataError("");

    try {
      if (!session) return;
      const nextProfiles = await loadProfilesForUser(session.access_token);
      const nextId =
        preferredProfileId && nextProfiles.some((profile) => profile.id === preferredProfileId)
          ? preferredProfileId
          : currentProfileId && nextProfiles.some((profile) => profile.id === currentProfileId)
            ? currentProfileId
            : nextProfiles[0]?.id || "";
      const nextProfile = nextProfiles.find((profile) => profile.id === nextId) || nextProfiles[0];

      setProfiles(nextProfiles);
      setCurrentProfileId(nextId);

      if (nextProfile) {
        resetAnalysis(nextProfile.defaultQuestion);
        const history = await loadQuestionHistory(
          session.access_token,
          nextProfile.id,
          nextProfile.name,
        );
        setRecords(history);
      } else {
        setRecords([]);
      }
    } catch (error) {
      setDataError(getErrorMessage(error));
    } finally {
      setDataLoading(false);
    }
  };

  const handleSignIn = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError("");
    setAuthNotice("");

    try {
      await signInWithPassword(email, password);
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError("");
    setAuthNotice("");

    try {
      const { session: newSession } = await signUpWithPassword(email, password);
      setAuthNotice(
        newSession
          ? "회원가입이 완료되었습니다. 첫 프로필을 만들어 주세요."
          : "가입 확인 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.",
      );
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    setAuthError("");
    try {
      await signOut();
      resetAnalysis();
    } catch (error) {
      setDataError(getErrorMessage(error));
    }
  };

  const handleCreateProfile = async (input: ProfileInput, cards: ContextCardInput[]) => {
    if (!session) return false;
    setDataSaving(true);
    setDataError("");
    let createdProfileId = "";

    try {
      createdProfileId = await createProfile(session.access_token, input);
      for (const card of cards) {
        await createContextCard(session.access_token, createdProfileId, card);
      }
      await refreshUserData(createdProfileId);
      return true;
    } catch (error) {
      if (createdProfileId) {
        await refreshUserData(createdProfileId);
        setDataError(`프로필은 만들었지만 일부 정보를 저장하지 못했습니다. 내 정보 화면에서 다시 추가해 주세요. ${getErrorMessage(error)}`);
      } else {
        setDataError(getErrorMessage(error));
      }
      return false;
    } finally {
      setDataSaving(false);
    }
  };

  const handleUpdateProfile = async (input: ProfileInput) => {
    if (!currentProfile) return false;
    return runDataMutation(async () => {
      if (!session) throw new Error("로그인이 필요합니다.");
      await updateProfile(session.access_token, currentProfile.id, input);
      await refreshUserData(currentProfile.id);
    });
  };

  const handleStructureContext = async (text: string) => {
    if (!session) return [];
    const result = await structureContext(session.access_token, text);
    return result.drafts.map((draft) => ({
      label: draft.title,
      valueText: draft.content,
      category: draft.category,
      semanticGroup: draft.category,
      tags: [],
      enabled: true,
      sensitivity: draft.privacyLevel,
      rationale: draft.rationale,
    }));
  };

  const handleCreateCards = async (inputs: ContextCardInput[]) => {
    if (!session || !currentProfile) return false;
    return runDataMutation(async () => {
      for (const input of inputs) {
        await createContextCard(session.access_token, currentProfile.id, input);
      }
      await refreshUserData(currentProfile.id);
    });
  };

  const handleCreateCard = async (input: ContextCardInput) => {
    if (!session || !currentProfile) return false;
    return runDataMutation(async () => {
      await createContextCard(session.access_token, currentProfile.id, input);
      await refreshUserData(currentProfile.id);
    });
  };

  const handleUpdateCard = async (cardId: string, input: ContextCardInput) => {
    if (!currentProfile) return false;
    return runDataMutation(async () => {
      if (!session) throw new Error("로그인이 필요합니다.");
      await updateContextCard(session.access_token, currentProfile.id, cardId, input);
      await refreshUserData(currentProfile.id);
    });
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!currentProfile) return false;
    return runDataMutation(async () => {
      if (!session) throw new Error("로그인이 필요합니다.");
      await deleteContextCard(session.access_token, currentProfile.id, cardId);
      await refreshUserData(currentProfile.id);
    });
  };

  const runDataMutation = async (mutation: () => Promise<void>) => {
    setDataSaving(true);
    setDataError("");
    try {
      await mutation();
      return true;
    } catch (error) {
      setDataError(getErrorMessage(error));
      return false;
    } finally {
      setDataSaving(false);
    }
  };

  const changeProfile = async (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    setCurrentProfileId(profileId);
    resetAnalysis(profile?.defaultQuestion);
    if (profile) {
      try {
        if (!session) throw new Error("로그인이 필요합니다.");
        setRecords(await loadQuestionHistory(session.access_token, profile.id, profile.name));
      } catch (error) {
        setDataError(getErrorMessage(error));
      }
    }
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
    if (!currentProfile || !session) return;
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
      const proposal = await createProposal(session.access_token, {
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
    if (!proposalId || !session || !currentProfile || generating) return;

    setGenerating(true);
    setApiError("");
    setRetryStage(null);

    try {
      const answer = await generateAnswer(session.access_token, proposalId, {
        approvedContextIds: approved.map((field) => field.contextId || field.key),
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
    if (!session || memoryResolvingId) return;

    setMemoryResolvingId(candidateId);
    setApiError("");

    try {
      await resolveMemory(session.access_token, candidateId, { action });
      setMemoryActions((current) => ({ ...current, [candidateId]: action }));
      if (action === "save" && currentProfile) await refreshUserData(currentProfile.id);
    } catch (error) {
      setApiError(getErrorMessage(error));
      setRetryStage(null);
    } finally {
      setMemoryResolvingId("");
    }
  };

  const retry = () => {
    if (retryStage === "proposal") void analyze();
    else if (retryStage === "generate") void generate();
  };

  if (!authReady || (session && dataLoading && profiles.length === 0)) {
    return <FullPageLoading />;
  }

  if (!session) {
    return (
      <LoginScreen
        loading={authLoading}
        error={authError}
        notice={authNotice}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
      />
    );
  }

  if (!currentProfile || !currentAccount) {
    return (
      <ProfileOnboarding
        email={session.user.email || ""}
        loading={dataSaving}
        error={dataError}
        onCreate={handleCreateProfile}
        onStructure={handleStructureContext}
        onLogout={() => void logout()}
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
        onLogout={() => void logout()}
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
            onToggleApproval={toggleApproval}
            onGenerate={generate}
            onRetry={retry}
            onResolveMemory={resolveMemoryCandidate}
            onReset={() => resetAnalysis()}
          />
        )}

        {activePage === "profile" && (
          <div className="p-7 max-sm:p-4">
            <ProfileManager
              profiles={profiles}
              profileId={currentProfile.id}
              saving={dataSaving}
              error={dataError}
              onProfileChange={(profileId) => void changeProfile(profileId)}
              onUpdateProfile={handleUpdateProfile}
              onCreateCard={handleCreateCard}
              onCreateCards={handleCreateCards}
              onStructureContext={handleStructureContext}
              onUpdateCard={handleUpdateCard}
              onDeleteCard={handleDeleteCard}
            />
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

function FullPageLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f7f2] p-6" aria-live="polite">
      <div className="grid justify-items-center gap-4 text-center">
        <div className="grid h-12 w-12 animate-pulse place-items-center bg-[#122824] text-sm font-black text-[#f8d7ad]">CB</div>
        <strong>계정과 프로필을 불러오는 중입니다</strong>
      </div>
    </main>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}
