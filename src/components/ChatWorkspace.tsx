import { useEffect, useRef } from "react";
import { Check, Copy, RefreshCw, SendHorizontal, ShieldCheck, Sparkles } from "lucide-react";
import type { DemoAccount, DetectedIntent, SelectedContext, UiMode, UserProfile } from "../types";
import type { QualityState } from "../services/qualityAnalyzer";
import { Pill } from "./Pill";

type ChatWorkspaceProps = {
  account: DemoAccount;
  profile: UserProfile;
  question: string;
  analyzing: boolean;
  intent: DetectedIntent | null;
  selected: SelectedContext[];
  sensitive: SelectedContext[];
  excluded: SelectedContext[];
  approvals: Record<string, boolean>;
  source?: "backend" | "frontend";
  bridgePrompt: string;
  quality: QualityState;
  uiMode: UiMode;
  onQuestionChange: (question: string) => void;
  onAnalyze: () => void;
  onGenerate: () => void;
  onReset: () => void;
};

export function ChatWorkspace({
  account,
  profile,
  question,
  analyzing,
  intent,
  selected,
  sensitive,
  excluded,
  approvals,
  source,
  bridgePrompt,
  quality,
  uiMode,
  onQuestionChange,
  onAnalyze,
  onGenerate,
  onReset,
}: ChatWorkspaceProps) {
  const easy = uiMode === "easy";
  const approvalPool = [...selected, ...sensitive];
  const approved = approvalPool.filter((field) => approvals[field.key]);
  const approvedCount = approved.length;
  const canGenerate = Boolean(intent && approvedCount > 0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [intent, bridgePrompt]);

  const copyPrompt = async () => {
    if (!bridgePrompt) return;
    await navigator.clipboard.writeText(bridgePrompt);
  };

  const submitQuestion = () => {
    if (analyzing || !question.trim()) return;
    onAnalyze();
  };

  return (
    <section className="flex h-screen min-h-[720px] flex-col bg-[#fbfaf6] max-lg:min-h-screen">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line bg-[#fbfaf6]/95 px-6 backdrop-blur max-sm:px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase text-bridge">Context Bridge</span>
            <Pill tone={uiMode === "easy" ? "normal" : "neutral"}>{easy ? "쉬운 모드" : "기본 모드"}</Pill>
          </div>
          <h2 className="mt-1 truncate text-lg font-black text-ink max-sm:text-base">
            짧은 질문을 맥락 있는 프롬프트로 바꾸기
          </h2>
        </div>
        <div className="hidden text-right text-sm leading-6 text-muted sm:block">
          <strong className="block text-ink">{account.displayName}</strong>
          {account.description}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-7 max-sm:px-4">
        <div className="mx-auto grid max-w-3xl gap-5">
          <AssistantMessage
            eyebrow="데모 프로필 연결됨"
            title={`${profile.name}님의 질문을 준비했어요`}
            body={`${account.description} 프로필을 기준으로 질문에 필요한 정보만 골라 보여줍니다. 왼쪽 사이드바에서 승인할 맥락을 확인할 수 있습니다.`}
          />

          <UserMessage>{question || profile.defaultQuestion}</UserMessage>

          {!intent && (
            <AssistantMessage
              eyebrow="분석 대기"
              title="아직 선택된 맥락이 없습니다"
              body="아래 입력창에서 질문을 보내면 백엔드 규칙 엔진을 먼저 호출하고, 실패하면 프론트 규칙으로 필요한 맥락을 고릅니다."
            />
          )}

          {intent && (
            <AssistantMessage eyebrow="맥락 분석 완료" title={intent.label}>
              <div className="grid gap-4">
                <div className="grid gap-2 rounded-[6px] border border-[#cfe0dc] bg-[#f6fbf9] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-bridge-dark">
                      {source === "backend" ? "백엔드 규칙 엔진" : "프론트 fallback 규칙 엔진"}
                    </strong>
                    <Pill tone="normal">{intent.confidence}% 신뢰도</Pill>
                  </div>
                  <p className="text-sm leading-6 text-muted">
                    선택 {selected.length}개, 확인 필요 {sensitive.length}개, 제외 {excluded.length}개로 정리했습니다.
                  </p>
                </div>

                <div className="grid gap-2">
                  <strong className="text-sm text-ink">승인된 정보</strong>
                  {approved.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {approved.map((field) => (
                        <span
                          key={field.key}
                          className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-bold text-green-800"
                        >
                          <Check size={14} />
                          {field.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-muted">사이드바에서 사용할 정보를 승인하면 프롬프트를 만들 수 있습니다.</p>
                  )}
                </div>
              </div>
            </AssistantMessage>
          )}

          {bridgePrompt && (
            <AssistantMessage eyebrow="생성 완료" title="복사 가능한 고급 프롬프트">
              <div className="grid gap-4">
                <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-[6px] border border-line bg-white p-4 font-sans text-sm leading-7 text-ink">
                  {bridgePrompt}
                </pre>
                <div className="grid gap-2 rounded-[6px] border border-[#dce7e3] bg-[#f7fbf9] p-4">
                  <strong className="text-sm text-bridge-dark">개선된 점</strong>
                  <ul className="grid gap-2 text-sm leading-6 text-muted">
                    {quality.after.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-end">
                  <button
                    className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-line bg-white px-4 text-sm font-black text-ink hover:border-bridge disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={!quality.copyEnabled}
                    onClick={copyPrompt}
                  >
                    <Copy size={16} />
                    프롬프트 복사
                  </button>
                </div>
              </div>
            </AssistantMessage>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <footer className="border-t border-line bg-[#fbfaf6] px-6 py-4 max-sm:px-4">
        <div className="mx-auto grid max-w-3xl gap-3">
          <div className="flex flex-wrap gap-2">
            {profile.examples.map((example) => (
              <button
                key={example}
                className="rounded-full border border-line bg-white px-3 py-2 text-left text-sm font-bold text-muted transition hover:border-bridge hover:text-bridge-dark"
                type="button"
                onClick={() => onQuestionChange(example)}
              >
                {example}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-[8px] border border-line bg-white p-2 shadow-[0_18px_48px_rgba(18,40,36,0.08)]">
            <textarea
              className="max-h-40 min-h-12 resize-none rounded-[6px] border-0 bg-transparent px-3 py-3 text-sm leading-6 text-ink outline-none placeholder:text-muted"
              value={question}
              placeholder="질문을 입력하세요"
              onChange={(event) => onQuestionChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitQuestion();
                }
              }}
            />
            <div className="flex gap-2">
              <button
                className="grid h-12 w-12 place-items-center rounded-[6px] border border-line bg-zinc-100 text-ink transition hover:border-bridge"
                type="button"
                aria-label="초기화"
                onClick={onReset}
              >
                <RefreshCw size={18} />
              </button>
              {intent && !bridgePrompt ? (
                <button
                  className="inline-flex h-12 items-center gap-2 rounded-[6px] bg-accent px-4 text-sm font-black text-[#2b180b] transition disabled:cursor-not-allowed disabled:opacity-45 max-sm:px-3"
                  type="button"
                  disabled={!canGenerate}
                  onClick={onGenerate}
                >
                  <Sparkles size={18} />
                  <span className="max-sm:hidden">프롬프트 만들기</span>
                </button>
              ) : (
                <button
                  className="grid h-12 w-12 place-items-center rounded-[6px] bg-bridge text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  aria-label="질문 분석"
                  disabled={analyzing || !question.trim()}
                  onClick={submitQuestion}
                >
                  {analyzing ? <ShieldCheck className="animate-pulse" size={18} /> : <SendHorizontal size={18} />}
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-xs leading-5 text-muted">
            승인된 맥락만 프롬프트에 반영됩니다. 민감 정보는 사용자가 직접 켠 항목만 포함합니다.
          </p>
        </div>
      </footer>
    </section>
  );
}

function AssistantMessage({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="grid grid-cols-[38px_minmax(0,1fr)] gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-[#122824] text-xs font-black text-[#f8d7ad]">CB</div>
      <div className="rounded-[8px] border border-line bg-white p-4 shadow-[0_12px_36px_rgba(18,40,36,0.05)]">
        <div className="mb-2 text-xs font-black uppercase text-bridge">{eyebrow}</div>
        <h3 className="text-lg font-black text-ink">{title}</h3>
        {body && <p className="mt-2 text-sm leading-7 text-muted">{body}</p>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </article>
  );
}

function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <article className="ml-auto grid max-w-[86%] justify-items-end gap-2">
      <div className="rounded-[18px] rounded-br-[6px] bg-[#116a67] px-4 py-3 text-sm font-bold leading-7 text-white shadow-[0_12px_30px_rgba(17,106,103,0.22)]">
        {children}
      </div>
    </article>
  );
}
