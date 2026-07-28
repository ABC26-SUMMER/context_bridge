import { useEffect, useMemo, useState } from "react";
import { demoAccounts, demoProfiles } from "./data/profiles";
import { BridgeFlow } from "./components/BridgeFlow";
import { ContextLog } from "./components/ContextLog";
import { ContextPreview } from "./components/ContextPreview";
import { Header } from "./components/Header";
import { LoginScreen } from "./components/LoginScreen";
import { ProfileManager } from "./components/ProfileManager";
import { PromptComparison } from "./components/PromptComparison";
import { PromptQualityPanel } from "./components/PromptQualityPanel";
import { QuestionPanel } from "./components/QuestionPanel";
import { Sidebar } from "./components/Sidebar";
import { analyzeContext } from "./services/contextSelector";
import { detectIntent } from "./services/intentAnalyzer";
import { loadAccounts, loadProfileForAccount } from "./services/profileRepository";
import { composeBridgePrompt, getPlainInput } from "./services/promptComposer";
import { getAnalyzedQuality, getGeneratedQuality, getIdleQuality } from "./services/qualityAnalyzer";
import type { ContextAnalysis, DemoAccount, DetectedIntent, InteractionRecord, SelectedContext, UserProfile } from "./types";

type QualityMode = "idle" | "analyzed" | "generated";

export default function App() {
  const [activePage, setActivePage] = useState("main");
  const [accounts, setAccounts] = useState<DemoAccount[]>(demoAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [question, setQuestion] = useState(demoProfiles[0].defaultQuestion);
  const [intent, setIntent] = useState<DetectedIntent | null>(null);
  const [selected, setSelected] = useState<SelectedContext[]>([]);
  const [sensitive, setSensitive] = useState<SelectedContext[]>([]);
  const [excluded, setExcluded] = useState<SelectedContext[]>([]);
  const [analysisSource, setAnalysisSource] = useState<ContextAnalysis["source"]>();
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [plainInput, setPlainInput] = useState("");
  const [bridgePrompt, setBridgePrompt] = useState("");
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
    setLoadingProfile(true);
    const profile = await loadProfileForAccount(accountId);
    const account = accounts.find((item) => item.id === accountId) || demoAccounts[0];

    setSelectedAccountId(accountId);
    setCurrentProfile(profile);
    setQuestion(profile?.defaultQuestion || (account.personaType === "older_adult" ? "내일 딸이랑 어디 가면 좋아?" : "이번 방학에 뭐 공부해야 해?"));
    resetAnalysis(profile?.defaultQuestion);
    setLoadingProfile(false);
  };

  const logout = () => {
    setSelectedAccountId(null);
    setCurrentProfile(null);
    resetAnalysis(demoProfiles[0].defaultQuestion);
    setActivePage("main");
  };

  const resetAnalysis = (nextQuestion = currentProfile?.defaultQuestion || question) => {
    setIntent(null);
    setSelected([]);
    setSensitive([]);
    setExcluded([]);
    setAnalysisSource(undefined);
    setApprovals({});
    setPlainInput("");
    setBridgePrompt("");
    setQuestion(nextQuestion);
    setQualityMode("idle");
  };

  const analyze = async () => {
    if (!currentProfile || !currentAccount) return;
    const normalizedQuestion = question.trim() || currentProfile.defaultQuestion;
    setAnalyzing(true);

    try {
      const response = await fetch("/api/analyze-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: currentAccount.id, question: normalizedQuestion }),
      });

      if (!response.ok) throw new Error("backend analysis failed");
      const analysis = (await response.json()) as ContextAnalysis;
      applyAnalysis(normalizedQuestion, analysis);
    } catch {
      const nextIntent = detectIntent(normalizedQuestion);
      const fallbackAnalysis = analyzeContext(currentProfile, nextIntent, "frontend");
      applyAnalysis(normalizedQuestion, fallbackAnalysis);
    } finally {
      setAnalyzing(false);
    }
  };

  const applyAnalysis = (normalizedQuestion: string, analysis: ContextAnalysis) => {
    setQuestion(normalizedQuestion);
    setIntent(analysis.intent);
    setSelected(analysis.selected);
    setSensitive(analysis.sensitive);
    setExcluded(analysis.excluded);
    setAnalysisSource(analysis.source);
    setApprovals({
      ...Object.fromEntries(analysis.selected.map((field) => [field.key, true])),
      ...Object.fromEntries(analysis.sensitive.map((field) => [field.key, false])),
    });
    setPlainInput("");
    setBridgePrompt("");
    setQualityMode("analyzed");
  };

  const toggleApproval = (key: string, value: boolean) => {
    setApprovals((current) => ({ ...current, [key]: value }));
    if (qualityMode === "generated") {
      setQualityMode("analyzed");
      setBridgePrompt("");
    }
  };

  const generatePrompt = () => {
    if (!intent || !currentProfile) return;
    const nextPlainInput = getPlainInput(question);
    const nextBridgePrompt = composeBridgePrompt(question, intent, approved, rejected);
    setPlainInput(nextPlainInput);
    setBridgePrompt(nextBridgePrompt);
    setQualityMode("generated");
    setRecords((current) => [
      {
        profile: currentProfile.name,
        question,
        intent: intent.label,
        selected: approvalPool.map((field) => field.value),
        approved: approved.map((field) => field.value),
        rejected: rejected.map((field) => field.value),
        sensitiveCount,
        createdAt: new Date().toLocaleString("ko-KR"),
      },
      ...current,
    ]);
  };

  if (!currentAccount || !currentProfile) {
    return <LoginScreen accounts={accounts} loading={loadingAccounts || loadingProfile} onLogin={login} />;
  }

  return (
    <div className="grid min-h-screen grid-cols-[280px_minmax(0,1fr)] max-lg:grid-cols-1">
      <Sidebar activePage={activePage} onPageChange={setActivePage} />
      <main className={`p-7 max-sm:p-4 ${easy ? "text-lg" : ""}`}>
        {activePage === "main" && (
          <section className="mx-auto max-w-6xl">
            <Header selectedCount={selectedCount} approvedCount={approvedCount} sensitiveCount={sensitiveCount} uiMode={uiMode} />
            <div className="grid grid-cols-[0.95fr_1.25fr] items-start gap-5 max-lg:grid-cols-1">
              <QuestionPanel
                account={currentAccount}
                profile={currentProfile}
                question={question}
                analyzing={analyzing}
                uiMode={uiMode}
                onQuestionChange={setQuestion}
                onAnalyze={analyze}
                onReset={() => resetAnalysis()}
                onLogout={logout}
              />
              <ContextPreview
                intent={intent}
                selected={selected}
                sensitive={sensitive}
                excluded={excluded}
                approvals={approvals}
                source={analysisSource}
                uiMode={uiMode}
                onToggle={toggleApproval}
                onGenerate={generatePrompt}
              />
            </div>
            <BridgeFlow />
            <PromptComparison plainInput={plainInput} bridgePrompt={bridgePrompt} easy={easy} />
            <PromptQualityPanel quality={quality} prompt={bridgePrompt} uiMode={uiMode} />
          </section>
        )}

        {activePage === "profile" && (
          <ProfileManager profiles={[currentProfile]} profileId={currentProfile.id} onProfileChange={() => undefined} />
        )}

        {activePage === "history" && <ContextLog records={records} />}
      </main>
    </div>
  );
}
