import { useMemo, useState } from "react";
import { profiles } from "./data/profiles";
import { BridgeFlow } from "./components/BridgeFlow";
import { ContextLog } from "./components/ContextLog";
import { ContextPreview } from "./components/ContextPreview";
import { Header } from "./components/Header";
import { ProfileManager } from "./components/ProfileManager";
import { PromptComparison } from "./components/PromptComparison";
import { PromptQualityPanel } from "./components/PromptQualityPanel";
import { QuestionPanel } from "./components/QuestionPanel";
import { Sidebar } from "./components/Sidebar";
import { selectContext } from "./services/contextSelector";
import { detectIntent } from "./services/intentAnalyzer";
import { composeBridgePrompt, getPlainInput } from "./services/promptComposer";
import { getAnalyzedQuality, getGeneratedQuality, getIdleQuality } from "./services/qualityAnalyzer";
import type { DetectedIntent, InteractionRecord, SelectedContext } from "./types";

type QualityMode = "idle" | "analyzed" | "generated";

export default function App() {
  const [activePage, setActivePage] = useState("main");
  const [profileId, setProfileId] = useState(profiles[0].id);
  const currentProfile = useMemo(
    () => profiles.find((profile) => profile.id === profileId) ?? profiles[0],
    [profileId],
  );
  const [question, setQuestion] = useState(currentProfile.defaultQuestion);
  const [intent, setIntent] = useState<DetectedIntent | null>(null);
  const [selected, setSelected] = useState<SelectedContext[]>([]);
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [plainInput, setPlainInput] = useState("");
  const [bridgePrompt, setBridgePrompt] = useState("");
  const [qualityMode, setQualityMode] = useState<QualityMode>("idle");
  const [records, setRecords] = useState<InteractionRecord[]>([]);

  const approved = selected.filter((field) => approvals[field.key]);
  const rejected = selected.filter((field) => !approvals[field.key]);
  const selectedCount = selected.length;
  const approvedCount = approved.length;
  const sensitiveCount = selected.filter((field) => field.sensitivity === "sensitive").length;
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
    setQuestion(nextProfile.defaultQuestion);
    resetAnalysis(nextProfile.defaultQuestion);
  };

  const resetAnalysis = (nextQuestion = currentProfile.defaultQuestion) => {
    setIntent(null);
    setSelected([]);
    setApprovals({});
    setPlainInput("");
    setBridgePrompt("");
    setQuestion(nextQuestion);
    setQualityMode("idle");
  };

  const analyze = () => {
    const normalizedQuestion = question.trim() || currentProfile.defaultQuestion;
    const nextIntent = detectIntent(normalizedQuestion);
    const nextSelected = selectContext(currentProfile, nextIntent);
    setQuestion(normalizedQuestion);
    setIntent(nextIntent);
    setSelected(nextSelected);
    setApprovals(Object.fromEntries(nextSelected.map((field) => [field.key, true])));
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
    const nextPlainInput = getPlainInput(intent);
    const nextBridgePrompt = composeBridgePrompt(intent, approved, rejected);
    setPlainInput(nextPlainInput);
    setBridgePrompt(nextBridgePrompt);
    setQualityMode("generated");
    setRecords((current) => [
      {
        profile: currentProfile.name,
        question,
        intent: intent.label,
        selected: selected.map((field) => field.value),
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
                uiMode={uiMode}
                onProfileChange={changeProfile}
                onQuestionChange={setQuestion}
                onAnalyze={analyze}
                onReset={() => resetAnalysis()}
              />
              <ContextPreview
                intent={intent}
                selected={selected}
                approvals={approvals}
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
