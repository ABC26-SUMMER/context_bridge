import { useEffect, useMemo, useState } from "react";
import { profiles as fallbackProfiles } from "./data/profiles";
import { BridgeFlow } from "./components/BridgeFlow";
import { ContextLog } from "./components/ContextLog";
import { ContextPreview } from "./components/ContextPreview";
import { Header } from "./components/Header";
import { ProfileManager } from "./components/ProfileManager";
import { PromptComparison } from "./components/PromptComparison";
import { PromptQualityPanel } from "./components/PromptQualityPanel";
import { QuestionPanel } from "./components/QuestionPanel";
import { Sidebar } from "./components/Sidebar";
import { analyzeContext } from "./services/contextSelector";
import { detectIntent } from "./services/intentAnalyzer";
import { loadProfiles } from "./services/profileRepository";
import { composeBridgePrompt, getPlainInput } from "./services/promptComposer";
import { getAnalyzedQuality, getGeneratedQuality, getIdleQuality } from "./services/qualityAnalyzer";
import type { ContextAnalysis, DetectedIntent, InteractionRecord, SelectedContext, UserProfile } from "./types";

type QualityMode = "idle" | "analyzed" | "generated";

export default function App() {
  const [activePage, setActivePage] = useState("main");
  const [profiles, setProfiles] = useState<UserProfile[]>(fallbackProfiles);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [profileId, setProfileId] = useState(fallbackProfiles[0].id);
  const currentProfile = useMemo(
    () => profiles.find((profile) => profile.id === profileId) ?? profiles[0],
    [profiles, profileId],
  );
  const [question, setQuestion] = useState(fallbackProfiles[0].defaultQuestion);
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
    loadProfiles()
      .then((loadedProfiles) => {
        setProfiles(loadedProfiles);
        setProfileId(loadedProfiles[0].id);
        setQuestion(loadedProfiles[0].defaultQuestion);
      })
      .finally(() => setLoadingProfiles(false));
  }, []);

  const approvalPool = [...selected, ...sensitive];
  const approved = approvalPool.filter((field) => approvals[field.key]);
  const rejected = approvalPool.filter((field) => !approvals[field.key]);
  const selectedCount = approvalPool.length;
  const approvedCount = approved.length;
  const sensitiveCount = sensitive.length;
  const uiMode = currentProfile.uiMode;
  const easy = uiMode === "easy";

  const quality =
    qualityMode === "generated"
      ? getGeneratedQuality(question, approved)
      : qualityMode === "analyzed"
        ? getAnalyzedQuality()
        : getIdleQuality();

  const changeProfile = (nextProfileId: string) => {
    const nextProfile = profiles.find((profile) => profile.id === nextProfileId) ?? profiles[0];
    setProfileId(nextProfile.id);
    resetAnalysis(nextProfile.defaultQuestion);
  };

  const resetAnalysis = (nextQuestion = currentProfile.defaultQuestion) => {
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
    const normalizedQuestion = question.trim() || currentProfile.defaultQuestion;
    setAnalyzing(true);

    try {
      const response = await fetch("/api/analyze-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: currentProfile, question: normalizedQuestion }),
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
    if (!intent) return;
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

  return (
    <div className="grid min-h-screen grid-cols-[280px_minmax(0,1fr)] max-lg:grid-cols-1">
      <Sidebar activePage={activePage} onPageChange={setActivePage} />
      <main className={`p-7 max-sm:p-4 ${easy ? "text-lg" : ""}`}>
        {activePage === "main" && (
          <section className="mx-auto max-w-6xl">
            <Header selectedCount={selectedCount} approvedCount={approvedCount} sensitiveCount={sensitiveCount} uiMode={uiMode} />
            <div className="grid grid-cols-[0.95fr_1.25fr] items-start gap-5 max-lg:grid-cols-1">
              <QuestionPanel
                profiles={profiles}
                profileId={profileId}
                question={question}
                loadingProfiles={loadingProfiles}
                analyzing={analyzing}
                uiMode={uiMode}
                onProfileChange={changeProfile}
                onQuestionChange={setQuestion}
                onAnalyze={analyze}
                onReset={() => resetAnalysis()}
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
          <ProfileManager profiles={profiles} profileId={profileId} onProfileChange={changeProfile} />
        )}

        {activePage === "history" && <ContextLog records={records} />}
      </main>
    </div>
  );
}
