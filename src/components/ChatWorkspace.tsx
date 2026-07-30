import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  LoaderCircle,
  Mic,
  MicOff,
  RefreshCw,
  Save,
  SendHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { MemoryCandidate, SelectionMode } from "../../contracts/types";
import type { QualityState } from "../services/qualityAnalyzer";
import { mergeSpeechSegments } from "../services/speechTranscript";
import type { DemoAccount, DetectedIntent, SelectedContext, UiMode, UserProfile } from "../types";
import { Pill } from "./Pill";

type ChatWorkspaceProps = {
  account: DemoAccount;
  profile: UserProfile;
  question: string;
  analyzing: boolean;
  generating: boolean;
  intent: DetectedIntent | null;
  selected: SelectedContext[];
  sensitive: SelectedContext[];
  excluded: SelectedContext[];
  approvals: Record<string, boolean>;
  source?: "backend" | "frontend";
  selectionMode?: SelectionMode;
  bridgePrompt: string;
  answerCompleted: boolean;
  rawAnswer: string;
  quality: QualityState;
  uiMode: UiMode;
  apiError?: string;
  canRetry: boolean;
  memoryCandidates: MemoryCandidate[];
  memoryResolvingId: string;
  memoryActions: Record<string, "save" | "ignore">;
  onQuestionChange: (question: string) => void;
  onAnalyze: () => void;
  onGenerate: () => void;
  onRetry: () => void;
  onResolveMemory: (candidateId: string, action: "save" | "ignore") => void;
  onReset: () => void;
};

export function ChatWorkspace({
  account,
  profile,
  question,
  analyzing,
  generating,
  intent,
  selected,
  sensitive,
  excluded,
  approvals,
  source,
  selectionMode,
  bridgePrompt,
  answerCompleted,
  rawAnswer,
  quality,
  uiMode,
  apiError,
  canRetry,
  memoryCandidates,
  memoryResolvingId,
  memoryActions,
  onQuestionChange,
  onAnalyze,
  onGenerate,
  onRetry,
  onResolveMemory,
  onReset,
}: ChatWorkspaceProps) {
  const easy = uiMode === "easy";
  const approvalPool = [...selected, ...sensitive];
  const approved = approvalPool.filter((field) => approvals[field.key]);
  const approvedCount = approved.length;
  const canGenerate = Boolean(intent && approvedCount > 0 && !generating);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const keepListeningRef = useRef(false);
  const committedTranscriptRef = useRef("");
  const recognitionRestartTimerRef = useRef<number | null>(null);
  const spokenTextRef = useRef(bridgePrompt);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const speechRecognitionSupported =
    typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const speechSynthesisSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [intent, bridgePrompt, apiError, generating]);

  useEffect(
    () => () => {
      keepListeningRef.current = false;
      if (recognitionRestartTimerRef.current !== null) {
        window.clearTimeout(recognitionRestartTimerRef.current);
      }
      try {
        recognitionRef.current?.stop();
      } catch {
        recognitionRef.current = null;
      }
      window.speechSynthesis?.cancel();
    },
    [],
  );

  useEffect(() => {
    if (spokenTextRef.current === bridgePrompt) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    spokenTextRef.current = bridgePrompt;
  }, [bridgePrompt]);

  const copyAnswer = async () => {
    if (!bridgePrompt) return;
    await navigator.clipboard.writeText(bridgePrompt);
  };

  const submitQuestion = () => {
    if (analyzing || generating || !question.trim()) return;
    onAnalyze();
  };

  const toggleVoiceInput = () => {
    if (listening) {
      keepListeningRef.current = false;
      if (recognitionRestartTimerRef.current !== null) {
        window.clearTimeout(recognitionRestartTimerRef.current);
        recognitionRestartTimerRef.current = null;
      }
      const activeRecognition = recognitionRef.current;
      recognitionRef.current = null;
      setListening(false);
      try {
        activeRecognition?.stop();
      } catch {
        setSpeechError("");
      }
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechError("이 브라우저에서는 음성 입력을 지원하지 않습니다.");
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    keepListeningRef.current = true;
    committedTranscriptRef.current = "";
    onQuestionChange("");
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => {
      setSpeechError("");
      setListening(true);
    };
    recognition.onresult = (event) => {
      const segments = Array.from(
        { length: event.results.length - event.resultIndex },
        (_, offset) => {
          const result = event.results[event.resultIndex + offset];
          return {
            transcript: result[0].transcript,
            isFinal: result.isFinal,
          };
        },
      );
      const merged = mergeSpeechSegments(committedTranscriptRef.current, segments);
      committedTranscriptRef.current = merged.committed;
      onQuestionChange(merged.display);
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      keepListeningRef.current = false;
      setSpeechError(
        event.error === "not-allowed"
          ? "마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요."
          : "음성 입력이 중단됐습니다. 마이크 버튼을 눌러 다시 시작해 주세요.",
      );
    };
    recognition.onend = () => {
      if (keepListeningRef.current) {
        recognitionRestartTimerRef.current = window.setTimeout(() => {
          recognitionRestartTimerRef.current = null;
          if (!keepListeningRef.current) return;
          try {
            recognition.start();
          } catch {
            keepListeningRef.current = false;
            recognitionRef.current = null;
            setListening(false);
            setSpeechError("음성 입력을 다시 시작하지 못했습니다. 마이크 버튼을 눌러 주세요.");
          }
        }, 150);
        return;
      }
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.start();
  };

  const toggleAnswerSpeech = () => {
    if (!speechSynthesisSupported || !bridgePrompt) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(bridgePrompt);
    utterance.lang = "ko-KR";
    utterance.rate = easy ? 0.85 : 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setSpeechError("답변을 읽어주지 못했습니다. 잠시 후 다시 시도해 주세요.");
    };
    setSpeechError("");
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <section className="flex h-screen min-h-[720px] flex-col bg-[#fbfaf6] max-lg:min-h-screen">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line bg-[#fbfaf6]/95 px-6 backdrop-blur max-sm:px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase text-bridge">Context Bridge</span>
            <Pill tone={uiMode === "easy" ? "normal" : "neutral"}>{easy ? "쉬운 모드" : "기본 모드"}</Pill>
          </div>
          <h2 className="mt-1 break-words text-lg font-black leading-tight text-ink max-sm:text-base">
            짧은 질문에 필요한 맥락을 안전하게 연결하기
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
            eyebrow="프로필 연결됨"
            title={`${profile.name}님의 질문을 준비했어요`}
            body={`${account.description}을 바탕으로 질문에 필요한 정보만 골라 보여줍니다. 왼쪽 사이드바에서 사용할 맥락을 직접 승인할 수 있습니다.`}
          />

          <UserMessage>{question || profile.defaultQuestion}</UserMessage>

          {!intent && !analyzing && (
            <AssistantMessage
              eyebrow="분석 대기"
              title="아직 선택된 맥락이 없습니다"
              body="질문을 보내면 API가 프로필 카드 중 필요한 맥락을 선별합니다. 승인한 카드만 답변 생성에 사용됩니다."
            />
          )}

          {analyzing && (
            <LoadingMessage
              title="질문에 필요한 맥락을 찾고 있습니다"
              body="이 단계에서는 프로필 카드 값이 AI 답변 생성에 전달되지 않습니다."
            />
          )}

          {apiError && (
            <article className="grid grid-cols-[38px_minmax(0,1fr)] gap-3" role="alert">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-red-900 text-white">
                <AlertCircle size={17} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-red-200 bg-red-50 p-4 text-red-950">
                <div className="min-w-0">
                  <strong className="block">요청을 완료하지 못했습니다</strong>
                  <span className="mt-1 block text-sm leading-6">{apiError}</span>
                </div>
                {canRetry && (
                  <button
                    className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-red-300 bg-white px-4 text-sm font-black transition hover:bg-red-100"
                    type="button"
                    onClick={onRetry}
                  >
                    <RefreshCw size={16} />
                    다시 시도
                  </button>
                )}
              </div>
            </article>
          )}

          {intent && (
            <AssistantMessage eyebrow="맥락 분석 완료" title={intent.label}>
              <div className="grid gap-4">
                <div className="grid gap-2 rounded-[6px] border border-[#cfe0dc] bg-[#f6fbf9] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-bridge-dark">
                      {source === "backend"
                        ? selectionMode === "llm"
                          ? "API · AI 선별"
                          : "API · 규칙 선별"
                        : "프론트 선별"}
                    </strong>
                    <Pill tone="normal">평균 관련도 {intent.confidence}%</Pill>
                  </div>
                  <p className="text-sm leading-6 text-muted">
                    후보 {approvalPool.length}개, 민감 {sensitive.length}개, 제외 {excluded.length}개로 정리했습니다.
                  </p>
                </div>

                <div className="grid gap-2">
                  <strong className="text-sm text-ink">승인한 정보</strong>
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
                    <p className="text-sm leading-6 text-muted">
                      사이드바에서 사용할 정보를 승인하면 답변을 만들 수 있습니다.
                    </p>
                  )}
                </div>

                {approvalPool.length === 0 && (
                  <div className="rounded-[6px] border border-dashed border-line bg-white p-4 text-sm leading-6 text-muted">
                    이번 질문에 사용할 수 있는 맥락 후보가 없습니다. 질문을 조금 더 구체적으로 바꿔 다시 보내 주세요.
                  </div>
                )}

                {excluded.length > 0 && (
                  <details className="rounded-[6px] border border-line bg-white p-4">
                    <summary className="cursor-pointer text-sm font-black text-ink">
                      이번 답변에 사용하지 않는 카드 {excluded.length}개
                    </summary>
                    <ul className="mt-3 grid gap-3">
                      {excluded.map((field) => (
                        <li key={field.key} className="grid gap-1 border-l-2 border-line pl-3 text-sm">
                          <strong className="text-ink">{field.label}</strong>
                          <span className="leading-6 text-muted">{field.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </AssistantMessage>
          )}

          {generating && (
            <LoadingMessage
              title="승인한 맥락으로 답변을 만들고 있습니다"
              body={`${approvedCount}개 카드의 ID만 API에 전달했습니다.`}
            />
          )}

          {bridgePrompt && (
            <AssistantMessage eyebrow="답변 생성 완료" title="Context Bridge 개인화 답변">
              <div className="grid gap-4">
                <div className="whitespace-pre-wrap rounded-[6px] border border-line bg-white p-4 text-sm leading-7 text-ink">
                  {bridgePrompt}
                </div>
                {rawAnswer && (
                  <details className="rounded-[6px] border border-line bg-[#f8f7f2] p-4">
                    <summary className="cursor-pointer text-sm font-black text-ink">
                      개인화하지 않은 일반 답변과 비교
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">{rawAnswer}</p>
                  </details>
                )}
                <div className="grid gap-2 rounded-[6px] border border-[#dce7e3] bg-[#f7fbf9] p-4">
                  <strong className="text-sm text-bridge-dark">적용 결과</strong>
                  <ul className="grid gap-2 text-sm leading-6 text-muted">
                    {quality.after.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-line bg-white px-4 text-sm font-black text-ink hover:border-bridge disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={!speechSynthesisSupported}
                    title={speechSynthesisSupported ? "생성된 답변을 음성으로 읽습니다" : "이 브라우저에서는 읽어주기를 지원하지 않습니다"}
                    onClick={toggleAnswerSpeech}
                  >
                    {speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    {speaking ? "읽기 중지" : "답변 읽기"}
                  </button>
                  <button
                    className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-line bg-white px-4 text-sm font-black text-ink hover:border-bridge disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={!quality.copyEnabled}
                    onClick={copyAnswer}
                  >
                    <Copy size={16} />
                    답변 복사
                  </button>
                </div>
              </div>
            </AssistantMessage>
          )}

          {answerCompleted && !bridgePrompt && !generating && (
            <AssistantMessage
              eyebrow="빈 응답"
              title="API가 답변 내용을 보내지 않았습니다"
              body="승인 상태를 확인한 뒤 답변을 다시 만들어 주세요. 빈 응답을 임의의 Mock 데이터로 대체하지 않습니다."
            />
          )}

          {memoryCandidates.map((candidate) => {
            const action = memoryActions[candidate.id];
            const resolving = memoryResolvingId === candidate.id;

            return (
              <AssistantMessage key={candidate.id} eyebrow="기억 후보" title="이 내용을 다음에도 기억할까요?">
                <div className="grid gap-3">
                  <div className="rounded-[6px] border border-line bg-[#f8f7f2] p-4">
                    <strong className="block text-sm text-ink">{candidate.label}</strong>
                    <span className="mt-1 block text-sm leading-6 text-muted">{candidate.content}</span>
                  </div>
                  {action ? (
                    <p className="text-sm font-bold text-bridge-dark">
                      {action === "save" ? "프로필 카드에 저장했습니다." : "이번 기억 후보를 저장하지 않았습니다."}
                    </p>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-line bg-white px-4 text-sm font-black text-ink hover:border-bridge disabled:opacity-50"
                        type="button"
                        disabled={Boolean(memoryResolvingId)}
                        onClick={() => onResolveMemory(candidate.id, "ignore")}
                      >
                        <X size={16} />
                        저장 안 함
                      </button>
                      <button
                        className="inline-flex min-h-10 items-center gap-2 rounded-[6px] bg-bridge px-4 text-sm font-black text-white disabled:opacity-50"
                        type="button"
                        disabled={Boolean(memoryResolvingId)}
                        onClick={() => onResolveMemory(candidate.id, "save")}
                      >
                        {resolving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
                        기억하기
                      </button>
                    </div>
                  )}
                </div>
              </AssistantMessage>
            );
          })}
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

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-[8px] border border-line bg-white p-2 shadow-[0_18px_48px_rgba(18,40,36,0.08)] max-sm:grid-cols-1">
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
            <div className="flex justify-end gap-2">
              <button
                className={`grid h-12 w-12 place-items-center rounded-[6px] border transition ${
                  listening
                    ? "border-red-700 bg-red-700 text-white"
                    : "border-line bg-zinc-100 text-ink hover:border-bridge"
                }`}
                type="button"
                aria-label={listening ? "음성 입력 종료" : "음성 입력 시작"}
                aria-pressed={listening}
                disabled={!speechRecognitionSupported || analyzing || generating}
                title={
                  speechRecognitionSupported
                    ? listening
                      ? "음성 입력 종료"
                      : "음성 입력 시작"
                    : "이 브라우저에서는 음성 입력을 지원하지 않습니다"
                }
                onClick={toggleVoiceInput}
              >
                {listening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
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
                  aria-label={generating ? "답변 생성 중" : answerCompleted ? "답변 다시 만들기" : "답변 만들기"}
                  disabled={!canGenerate}
                  onClick={onGenerate}
                >
                  {generating ? <LoaderCircle className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  <span className="max-sm:hidden">
                    {generating ? "답변 생성 중" : answerCompleted ? "다시 만들기" : "답변 만들기"}
                  </span>
                </button>
              ) : (
                <button
                  className="grid h-12 w-12 place-items-center rounded-[6px] bg-bridge text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  aria-label="질문 분석"
                  disabled={analyzing || generating || !question.trim()}
                  onClick={submitQuestion}
                >
                  {analyzing ? <LoaderCircle className="animate-spin" size={18} /> : <SendHorizontal size={18} />}
                </button>
              )}
            </div>
          </div>

          {(listening || speechError) && (
            <p
              className={`text-center text-sm font-bold ${speechError ? "text-red-800" : "text-bridge-dark"}`}
              role={speechError ? "alert" : "status"}
            >
              {speechError || "계속 듣고 있습니다. 모두 말씀한 뒤 마이크 버튼을 다시 눌러 종료해 주세요."}
            </p>
          )}

          <p className="text-center text-xs leading-5 text-muted">
            승인한 카드의 ID만 API에 전달합니다. 기밀 정보는 선택하거나 답변에 사용할 수 없습니다.
          </p>
        </div>
      </footer>
    </section>
  );
}

type SpeechRecognitionResultLike = {
  [index: number]: { transcript: string };
  isFinal: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

function LoadingMessage({ title, body }: { title: string; body: string }) {
  return (
    <article className="grid grid-cols-[38px_minmax(0,1fr)] gap-3" aria-live="polite">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-[#122824] text-[#f8d7ad]">
        <LoaderCircle className="animate-spin" size={17} />
      </div>
      <div className="rounded-[8px] border border-line bg-white p-4 shadow-[0_12px_36px_rgba(18,40,36,0.05)]">
        <strong className="block text-ink">{title}</strong>
        <span className="mt-1 block text-sm leading-6 text-muted">{body}</span>
      </div>
    </article>
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
