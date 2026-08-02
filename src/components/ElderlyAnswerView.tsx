import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Flag,
  HelpCircle,
  LoaderCircle,
  Share2,
  ThumbsUp,
  Volume2,
} from "lucide-react";
import type { ElderlyAnswerGuide, ElderlyCalloutTone } from "../../contracts/types";
import { toSpeechText } from "../services/speechText";

type ElderlyAnswerViewProps = {
  guide: ElderlyAnswerGuide;
  busy: boolean;
  onRetryExplain: () => void;
  /** 대화 기록(과거 턴)처럼 다시 생성 요청을 걸 수 없는 경우 true. 이해 확인 버튼을 숨긴다. */
  readOnly?: boolean;
};

const CALLOUT_META: Record<ElderlyCalloutTone, { label: string; icon: typeof AlertTriangle; className: string }> = {
  warning: { label: "주의하세요", icon: AlertTriangle, className: "border-red-200 bg-red-50 text-red-900" },
  remember: { label: "꼭 기억하세요", icon: ThumbsUp, className: "border-green-200 bg-green-50 text-green-900" },
  next: { label: "다음 행동", icon: ArrowRight, className: "border-blue-200 bg-blue-50 text-blue-900" },
  first_action: { label: "가장 먼저 하세요", icon: Flag, className: "border-amber-200 bg-amber-50 text-amber-950" },
};

function speak(text: string) {
  if (typeof window.speechSynthesis === "undefined") {
    window.alert("이 브라우저에서는 소리로 듣기를 지원하지 않습니다.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(toSpeechText(text));
  utterance.lang = "ko-KR";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

async function shareWithFamily(guide: ElderlyAnswerGuide) {
  const text = [guide.summary, ...guide.steps.map((step) => `${step.title}. ${step.body}`)].join("\n");
  const shareWindow = window as typeof window & { navigator: Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> } };
  if (shareWindow.navigator.share) {
    try {
      await shareWindow.navigator.share({ title: "Context Bridge 답변", text });
      return;
    } catch {
      // 사용자가 공유를 취소한 경우 등은 조용히 복사로 대체한다.
    }
  }
  await navigator.clipboard.writeText(text);
  window.alert("답변 내용을 복사했어요. 가족에게 붙여넣기 해서 보내주세요.");
}

export function ElderlyAnswerView({ guide, busy, onRetryExplain, readOnly = false }: ElderlyAnswerViewProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [understood, setUnderstood] = useState<"yes" | "no" | null>(null);
  const steps = guide.steps.length ? guide.steps : [{ title: "STEP 1", body: guide.summary }];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= steps.length - 1;

  const askRetry = () => {
    setUnderstood("no");
    onRetryExplain();
  };

  return (
    <div className="grid gap-5 text-[26px] leading-[1.9] text-ink">
      <section className="grid gap-3 border border-line bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-black uppercase text-bridge">핵심만 먼저</span>
          <button
            className="inline-flex min-h-14 items-center gap-2 rounded-[6px] bg-bridge px-5 text-lg font-black text-white"
            type="button"
            onClick={() => speak(guide.summary)}
          >
            <Volume2 size={22} />
            읽어주기
          </button>
        </div>
        <p>{guide.summary}</p>
      </section>

      <section className="grid gap-4 border border-line bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-lg font-black text-bridge-dark">{step.title}</strong>
          <span className="text-lg font-bold text-muted">
            {Math.min(stepIndex + 1, steps.length)} / {steps.length} 단계
          </span>
        </div>
        <p>{step.body}</p>
        <div className="flex flex-wrap justify-between gap-3">
          <button
            className="inline-flex min-h-14 items-center gap-2 rounded-[6px] border border-line bg-white px-5 text-lg font-black text-ink disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            disabled={isFirst}
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          >
            <ArrowLeft size={22} />
            이전 단계
          </button>
          <button
            className="inline-flex min-h-14 items-center gap-2 rounded-[6px] border border-line bg-white px-5 text-lg font-black text-ink disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            disabled={isLast}
            onClick={() => setStepIndex((current) => Math.min(steps.length - 1, current + 1))}
          >
            다음 단계
            <ArrowRight size={22} />
          </button>
        </div>
      </section>

      {guide.callouts.length > 0 && (
        <section className="grid gap-3">
          {guide.callouts.map((callout, index) => {
            const meta = CALLOUT_META[callout.tone];
            const Icon = meta.icon;
            return (
              <div key={`${callout.tone}-${index}`} className={`flex items-start gap-3 border p-5 ${meta.className}`}>
                <Icon size={26} className="mt-1 shrink-0" />
                <div>
                  <strong className="block text-lg font-black">{meta.label}</strong>
                  <p className="mt-1">{callout.text}</p>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {guide.checklist.length > 0 && (
        <ChecklistSection title="가기 전에 준비하세요" items={guide.checklist} />
      )}

      {guide.commonMistakes.length > 0 && (
        <section className="grid gap-3 border border-line bg-white p-6">
          <strong className="text-lg font-black text-bridge-dark">가장 많이 실수하는 부분</strong>
          <ol className="grid gap-2">
            {guide.commonMistakes.map((item, index) => (
              <li key={item} className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#122824] text-lg font-black text-[#f8d7ad]">
                  {index + 1}
                </span>
                <span className="pt-1">{item}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {guide.nextActions.length > 0 && (
        <ChecklistSection title="다음에 할 일" items={guide.nextActions} />
      )}

      {!readOnly && (
        <section className="grid gap-4 border border-line bg-white p-6">
          {understood === "yes" ? (
            <p className="text-lg font-black text-bridge-dark">
              <Check className="mr-2 inline" size={22} />
              확인해 주셔서 감사합니다.
            </p>
          ) : (
            <>
              <strong className="text-lg font-black text-bridge-dark">
                <HelpCircle className="mr-2 inline" size={24} />
                {guide.comprehensionPrompt || "여기까지 이해되셨나요?"}
              </strong>
              <div className="flex flex-wrap gap-3">
                <button
                  className="inline-flex min-h-14 items-center gap-2 rounded-[6px] border-2 border-line bg-white px-5 text-lg font-black text-ink"
                  type="button"
                  onClick={() => setUnderstood("yes")}
                >
                  ○ 이해했어요
                </button>
                <button
                  className="inline-flex min-h-14 items-center gap-2 rounded-[6px] border-2 border-accent bg-[#fff6eb] px-5 text-lg font-black text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={busy}
                  onClick={askRetry}
                >
                  {busy ? <LoaderCircle className="animate-spin" size={20} /> : null}
                  ○ 다시 설명해주세요
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          className="inline-flex min-h-14 items-center gap-2 rounded-[6px] border border-line bg-white px-5 text-lg font-black text-ink"
          type="button"
          onClick={() => void shareWithFamily(guide)}
        >
          <Share2 size={20} />
          가족에게 공유
        </button>
      </div>
    </div>
  );
}

function ChecklistSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="grid gap-3 border border-line bg-white p-6">
      <strong className="text-lg font-black text-bridge-dark">{title}</strong>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center border-2 border-bridge text-bridge">
              <Check size={20} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
