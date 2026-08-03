import { useState } from "react";
import {
  AlertTriangle,
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
  answerText?: string;
  busy: boolean;
  onRetryExplain: () => void;
  /** 대화 기록(과거 턴)처럼 다시 생성 요청을 걸 수 없는 경우 true. 이해 확인 버튼을 숨긴다. */
  readOnly?: boolean;
  /** UI를 고령자 모드(easy)로 크게 표시할지 여부 */
  easy?: boolean;
};

const CALLOUT_META: Record<ElderlyCalloutTone, { label: string; icon: typeof AlertTriangle; className: string }> = {
  warning: { label: "조심할 점", icon: AlertTriangle, className: "border-l-red-700" },
  remember: { label: "꼭 기억할 점", icon: ThumbsUp, className: "border-l-bridge" },
  next: { label: "다음에 할 일", icon: ArrowRight, className: "border-l-[#385c93]" },
  first_action: { label: "가장 먼저 할 일", icon: Flag, className: "border-l-[#a46221]" },
};

function cleanDisplayText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/[*_]{1,3}/g, "")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/(^|\n)\s*\d+[.)]\s*(결론 및 핵심 원리|핵심 원리|결론|요약|단계별 안내)\s*/g, "$1")
    .replace(/(^|\n)\s*(핵심|요약)\s*[:：]\s*/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeStepTitle(title: string, index: number) {
  const cleaned = cleanDisplayText(title).replace(/^STEP\s*/i, "").trim();
  return /^\d+단계/.test(cleaned) ? cleaned : `${index + 1}단계`;
}

function buildDisplayStepsFromText(text: string) {
  const pieces = cleanDisplayText(text)
    .replace(/\s*(?:→|->|⇒)\s*/g, "\n")
    .split(/\n+|(?<=[.!?。])\s+/)
    .map((item) => cleanDisplayText(item).replace(/^\s*\d+\s*[.)]\s*/, "").trim())
    .filter((item) => item.length > 1 && !/^(결론|핵심|요약|원리)$/.test(item));

  return pieces.slice(0, 5).map((body, index) => ({ title: `${index + 1}단계`, body }));
}

type RichAnswerSection = {
  title: string;
  items: string[];
};

type RichAnswer = {
  summary: string;
  sections: RichAnswerSection[];
  contextItems: string[];
};

type RecommendationCard = {
  title: string;
  reason?: string;
  target?: string;
  details: string[];
};

const CONTEXT_LABELS: Record<string, string> = {
  identity: "내 정보",
  capability: "할 수 있는 것",
  objective: "목표",
  preference: "선호",
  hardlimit: "꼭 지킬 점",
  softlimit: "고려할 점",
  resource: "이용 가능한 것",
  routine: "일정",
  relationship: "가족과 관계",
  currentstate: "현재 상황",
  project: "진행 중인 일",
  profile: "기본 정보",
  goal: "목표",
  constraint: "제약 조건",
};

function normalizeAnswerText(text: string) {
  return cleanDisplayText(text)
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => cleanDisplayText(line))
    .filter((line) => line && line !== "AI 답변")
    .join("\n");
}

function cleanSummaryText(text: string) {
  return cleanDisplayText(text)
    .replace(/(^|[\s,])\d+\)\s*/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isSectionHeading(line: string) {
  return (
    /^\d+\.\s+/.test(line) ||
    /^(추천 장소|추천 내용|실행 단계|순서대로|주의점|조심할 점|실수하기 쉬운 부분|추가 확인|확인 질문|준비물|준비할 것|다음 행동|다음에 할 일)/.test(line)
  );
}

function sectionTitle(line: string) {
  return line
    .replace(/^\d+\.\s*/, "")
    .replace(/\s*[:：]\s*$/, "")
    .trim();
}

function parseRichAnswer(answerText?: string): RichAnswer | null {
  const normalized = normalizeAnswerText(answerText || "");
  if (!normalized) return null;

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const summaryLines: string[] = [];
  const sections: RichAnswerSection[] = [];
  const contextItems: string[] = [];
  let current: RichAnswerSection | null = null;
  let inContext = false;
  let lastContextIndex = -1;

  for (const line of lines) {
    if (line.includes("반영된 맥락")) {
      inContext = true;
      current = null;
      continue;
    }

    if (inContext) {
      const categoryMatch = line.match(/^\[([^\]]+)\]\s*(.+)$/);
      if (categoryMatch) {
        const key = categoryMatch[1].replace(/[_\s-]/g, "").toLowerCase();
        const label = CONTEXT_LABELS[key] || "반영한 정보";
        const [value, reason] = categoryMatch[2].split(/\s*→\s*/).map((part) => cleanDisplayText(part)).filter(Boolean);
        if (value) {
          contextItems.push(reason ? `${label}: ${value}\n이렇게 반영했어요: ${reason}` : `${label}: ${value}`);
          lastContextIndex = contextItems.length - 1;
        }
        continue;
      }

      const reason = cleanDisplayText(line.replace(/^→\s*/, ""));
      if (reason && lastContextIndex >= 0) {
        contextItems[lastContextIndex] = `${contextItems[lastContextIndex]}\n이렇게 반영했어요: ${reason}`;
      } else if (reason) {
        contextItems.push(reason);
        lastContextIndex = contextItems.length - 1;
      }
      continue;
    }

    if (isSectionHeading(line)) {
      current = { title: sectionTitle(line), items: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      summaryLines.push(line);
      continue;
    }

    const compact = line
      .replace(/^\s*\d+[.)]\s*/, "")
      .replace(/^\s*\d+순위\s*[:：]\s*/, "")
      .replace(/^\s*\d+단계\s*[:：]\s*/, "")
      .replace(/^(추천 이유|주의점|원리|확인 질문)\s*[:：]\s*/, "$1: ")
      .trim();

    if (compact) current.items.push(compact);
  }

  const summary = cleanSummaryText(summaryLines.join(" "));
  const usefulSections = sections
    .map((section) => ({ ...section, items: section.items.filter(Boolean) }))
    .filter((section) => section.items.length);

  if (!summary && !usefulSections.length) return null;
  return { summary, sections: usefulSections, contextItems };
}

function getSectionLabel(title: string) {
  if (/주의|조심|실수|확인|질문/.test(title)) return "확인";
  if (/추천|비교|장소/.test(title)) return "추천";
  if (/실행|순서|단계/.test(title)) return "방법";
  return "안내";
}

function getSectionTitle(title: string) {
  if (/확인\s*질문|질문/.test(title)) return "더 정확히 알려면";
  if (/주의|조심|실수|확인/.test(title)) return "조심하거나 확인할 점";
  if (/추천|비교|장소/.test(title)) return "추천 내용";
  if (/실행|순서|단계/.test(title)) return "순서대로 하세요";
  return title;
}

function isRecommendationSection(title: string) {
  return /추천|비교|장소/.test(title) && !/주의|확인|질문/.test(title);
}

function isStepSection(title: string) {
  return /실행|순서|단계/.test(title) && !isRecommendationSection(title);
}

function isQuestionSection(title: string) {
  return /확인\s*질문|질문/.test(title);
}

function isCautionSection(title: string) {
  return /주의|조심|실수|확인/.test(title) && !isQuestionSection(title);
}

function parseRecommendationCards(items: string[]): RecommendationCard[] {
  const cards: RecommendationCard[] = [];
  let current: RecommendationCard | null = null;

  for (const item of items) {
    const reason = item.match(/^추천\s*이유\s*[:：]\s*(.+)$/);
    if (reason) {
      if (!current) {
        current = { title: "추천 이유", details: [] };
        cards.push(current);
      }
      current.reason = reason[1].trim();
      continue;
    }

    const target = item.match(/^추천\s*대상\s*[:：]\s*(.+)$/);
    if (target) {
      if (!current) {
        current = { title: "추천 대상", details: [] };
        cards.push(current);
      }
      current.target = target[1].trim();
      continue;
    }

    const [rawTitle, rawReason] = item.split(/\s+추천\s*이유\s*[:：]\s*/);
    const [title, rawTarget] = rawTitle.split(/\s+추천\s*대상\s*[:：]\s*/);
    current = {
      title: title.replace(/^\d+[.)]\s*/, "").replace(/^\d+순위\s*[:：]\s*/, "").trim(),
      reason: rawReason?.trim(),
      target: rawTarget?.trim(),
      details: [],
    };
    cards.push(current);
  }

  return cards.filter((card) => card.title || card.reason || card.target || card.details.length);
}

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

async function shareWithFamily(text: string) {
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

export function ElderlyAnswerView({ guide, answerText, busy, onRetryExplain, readOnly = false, easy = false }: ElderlyAnswerViewProps) {
  const [understood, setUnderstood] = useState<"yes" | "no" | null>(null);
  const richAnswer = parseRichAnswer(answerText);
  const rawSummary = cleanDisplayText(guide.summary);
  const rawStepText = guide.steps.map((step) => step.body).join("\n");
  const rawNeedsRepair = /[#*_`]|---|→|->/.test(rawStepText);
  const normalizedSteps = (guide.steps.length ? guide.steps : [{ title: "1단계", body: rawSummary }])
    .map((step, index) => ({
      title: normalizeStepTitle(step.title, index),
      body: cleanDisplayText(step.body),
    }))
    .filter((step) => step.body);
  const repairedSteps = rawNeedsRepair || normalizedSteps.some((step) => step.body.length > 120)
    ? buildDisplayStepsFromText(rawStepText)
    : normalizedSteps;
  const summary = richAnswer?.summary || rawSummary || repairedSteps[0]?.body || "답변을 준비했습니다.";
  const steps = repairedSteps.length ? repairedSteps : [{ title: "1단계", body: summary }];
  const callouts = guide.callouts
    .map((callout) => ({ ...callout, text: cleanDisplayText(callout.text) }))
    .filter((callout) => callout.text);
  const checklist = guide.checklist.map(cleanDisplayText).filter(Boolean);
  const commonMistakes = guide.commonMistakes.map(cleanDisplayText).filter(Boolean);
  const nextActions = guide.nextActions.map(cleanDisplayText).filter(Boolean);

  const askRetry = () => {
    setUnderstood("no");
    onRetryExplain();
  };

  const speechText = richAnswer
    ? [summary, ...richAnswer.sections.flatMap((section) => [section.title, ...section.items])].join("\n")
    : [summary, ...steps.map((step) => `${step.title}. ${step.body}`)].join("\n");
  const containerClass = easy ? "grid gap-4 text-[24px] leading-[1.55] text-ink" : "grid gap-4 text-[20px] leading-[1.65] text-ink";
  const sectionPadding = easy ? "p-6" : "p-5";
  const controlBtnClass = easy
    ? "inline-flex min-h-14 items-center gap-3 rounded-[6px] border border-line bg-white px-5 text-lg font-black text-ink"
    : "inline-flex min-h-12 items-center gap-2 rounded-[6px] border border-line bg-white px-4 text-base font-black text-ink";

  return (
    <div className={containerClass}>
      <section className={`grid gap-3 border border-line bg-white ${sectionPadding}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-black text-bridge">먼저 이것만 보세요</span>
          <button
            className={`inline-flex ${easy ? "min-h-12 px-5 text-lg" : "min-h-11 px-4 text-base"} items-center gap-2 rounded-[6px] bg-bridge font-black text-white`}
            type="button"
            onClick={() => speak(speechText)}
          >
            <Volume2 size={22} />
            읽어주기
          </button>
        </div>
        <p className="font-bold">{summary}</p>
      </section>

      {richAnswer ? (
        <section className="grid gap-3">
          {richAnswer.sections.map((section, sectionIndex) => (
            <article key={`${section.title}-${sectionIndex}`} className={`grid gap-3 border border-line bg-white ${sectionPadding}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-lg font-black text-bridge-dark">{getSectionTitle(section.title)}</strong>
                <span className="border border-line bg-[#f8f7f2] px-2 py-1 text-sm font-black text-muted">{getSectionLabel(section.title)}</span>
              </div>
              {isRecommendationSection(section.title) ? (
                <div className="grid gap-3">
                  {parseRecommendationCards(section.items).map((card, index) => (
                    <div key={`${card.title}-${index}`} className="grid gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
                      <strong className="text-[1.02em] font-black text-ink">{card.title}</strong>
                      {card.reason && (
                        <p>
                          <span className="font-black text-bridge-dark">추천 이유: </span>
                          {card.reason}
                        </p>
                      )}
                      {card.target && (
                        <p className="text-[0.9em] text-muted">
                          <span className="font-black text-bridge-dark">추천 대상: </span>
                          {card.target}
                        </p>
                      )}
                      {card.details.map((detail) => (
                        <p key={detail}>{detail}</p>
                      ))}
                    </div>
                  ))}
                </div>
              ) : isStepSection(section.title) ? (
                <ol className="grid gap-3">
                  {section.items.map((item, index) => (
                    <li key={`${item}-${index}`} className="grid gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[54px_1fr]">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#122824] text-base font-black text-[#f8d7ad]">
                        {index + 1}
                      </span>
                      <p>{item}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <ul className="grid gap-3">
                  {section.items.map((item, index) => {
                    const Icon = isQuestionSection(section.title) ? HelpCircle : isCautionSection(section.title) ? AlertTriangle : Check;
                    return (
                      <li key={`${item}-${index}`} className="flex items-start gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0">
                        <Icon size={22} className="mt-1 shrink-0 text-bridge-dark" />
                        <p>{item}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          ))}
        </section>
      ) : (
        <section className={`grid gap-4 border border-line bg-white ${sectionPadding}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-lg font-black text-bridge-dark">순서대로 하세요</strong>
            <span className="text-base font-bold text-muted">{steps.length}단계</span>
          </div>
          <ol className="grid gap-3">
            {steps.map((step, index) => (
              <li key={`${step.title}-${index}`} className="grid gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0 sm:grid-cols-[70px_1fr]">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[#122824] text-xl font-black text-[#f8d7ad]">
                  {index + 1}
                </span>
                <div>
                  <strong className="block text-base font-black text-bridge-dark">{step.title}</strong>
                  <p className="mt-1">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {richAnswer && richAnswer.contextItems.length > 0 && (
        <section className={`grid gap-3 border border-line bg-white ${sectionPadding}`}>
          <strong className="text-lg font-black text-bridge-dark">내 상황을 반영한 부분</strong>
          <ul className="grid gap-2 text-[0.9em] leading-relaxed text-muted">
            {richAnswer.contextItems.slice(0, 6).map((item, index) => (
              <li key={`${item}-${index}`} className="whitespace-pre-line border-l-4 border-[#cfe0dc] bg-[#fbfbf8] px-3 py-2">{item}</li>
            ))}
          </ul>
        </section>
      )}

      {callouts.length > 0 && (
        <section className={`grid gap-3 border border-line bg-white ${sectionPadding}`}>
          <strong className="text-lg font-black text-bridge-dark">확인할 점</strong>
          {callouts.map((callout, index) => {
            const meta = CALLOUT_META[callout.tone];
            const Icon = meta.icon;
            return (
              <div key={`${callout.tone}-${index}`} className={`flex items-start gap-3 border-l-4 bg-[#fbfbf8] px-4 py-3 ${meta.className}`}>
                <Icon size={easy ? 26 : 22} className="mt-1 shrink-0 text-bridge-dark" />
                <div>
                  <strong className="block text-base font-black text-bridge-dark">{meta.label}</strong>
                  <p className="mt-1">{callout.text}</p>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {checklist.length > 0 && (
        <ChecklistSection title="준비할 것" items={checklist} />
      )}

      {commonMistakes.length > 0 && (
        <section className={`grid gap-3 border border-line bg-white ${sectionPadding}`}>
          <strong className="text-lg font-black text-bridge-dark">실수하기 쉬운 부분</strong>
          <ul className="grid gap-2">
            {commonMistakes.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <AlertTriangle size={easy ? 24 : 21} className="mt-1 shrink-0 text-bridge-dark" />
                <span className="pt-1">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nextActions.length > 0 && (
        <ChecklistSection title="다음에 할 일" items={nextActions} />
      )}

      {!readOnly && (
        <section className={`grid gap-4 border border-line bg-white ${sectionPadding}`}>
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
                  className={`${controlBtnClass} border-2 border-line bg-white`}
                  type="button"
                  onClick={() => setUnderstood("yes")}
                >
                  ○ 이해했어요
                </button>
                <button
                  className={`${controlBtnClass} border-2 border-accent bg-[#fff6eb] disabled:cursor-not-allowed disabled:opacity-50`}
                  type="button"
                  disabled={busy}
                  onClick={askRetry}
                >
                  {busy ? <LoaderCircle className="animate-spin" size={easy ? 24 : 20} /> : null}
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
          onClick={() => void shareWithFamily(speechText)}
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
    <section className="grid gap-3 border border-line bg-white p-5">
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
