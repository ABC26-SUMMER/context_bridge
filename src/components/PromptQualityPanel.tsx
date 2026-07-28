import type { QualityState } from "../services/qualityAnalyzer";
import type { UiMode } from "../types";
import { Pill } from "./Pill";

type PromptQualityPanelProps = {
  quality: QualityState;
  prompt: string;
  uiMode: UiMode;
};

export function PromptQualityPanel({ quality, prompt, uiMode }: PromptQualityPanelProps) {
  const easy = uiMode === "easy";
  const beforeItems = easy ? quality.before.slice(0, 2) : quality.before;
  const afterItems = easy ? quality.after.slice(0, 3) : quality.after;

  const copyPrompt = async () => {
    if (!quality.copyEnabled) return;
    await navigator.clipboard.writeText(prompt);
  };

  return (
    <section className="mt-4 border border-line bg-white">
      <div className="flex min-h-14 items-center justify-between border-b border-line px-5 py-4">
        <h3 className={`${easy ? "text-2xl" : "text-xl"} font-black`}>{easy ? "무엇이 좋아졌나요?" : "Prompt Quality"}</h3>
        <Pill>{easy ? "입력 도움" : "격차가 줄어든 지점"}</Pill>
      </div>
      <div className="grid grid-cols-[0.9fr_1.1fr] gap-4 p-5 max-lg:grid-cols-1">
        <QualityCard title={easy ? "짧은 질문에 빠진 것" : "원문 입력의 빈칸"} tone="warn" badge="Before" items={beforeItems} easy={easy} />
        <QualityCard title={easy ? "AI가 도와서 넣은 것" : "추가된 프롬프트 역량"} tone="good" badge="After" items={afterItems} easy={easy} />
      </div>
      <div className="flex justify-end px-5 pb-5">
        <button
          className="min-h-11 border border-line bg-zinc-100 px-4 font-black text-ink disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          disabled={!quality.copyEnabled}
          onClick={copyPrompt}
        >
          {easy ? "문장 복사" : "프롬프트 복사"}
        </button>
      </div>
    </section>
  );
}

function QualityCard({
  title,
  badge,
  items,
  tone,
  easy,
}: {
  title: string;
  badge: string;
  items: string[];
  tone: "warn" | "good";
  easy: boolean;
}) {
  return (
    <div className="grid content-start gap-3 border border-line bg-white p-4">
      <h3 className={`flex items-center justify-between gap-3 font-black ${easy ? "text-xl" : "text-base"}`}>
        {title}
        <Pill tone={tone === "good" ? "normal" : "neutral"}>{badge}</Pill>
      </h3>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li
            key={item}
            className={`border-l-4 p-3 ${easy ? "text-lg leading-8" : "text-sm leading-6"} ${
              tone === "good" ? "border-bridge bg-[#edf7f3]" : "border-accent bg-[#fff6eb]"
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
