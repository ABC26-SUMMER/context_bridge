import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  ArrowLeft,
  LoaderCircle,
  Mic,
  Plus,
  RefreshCw,
  Save,
  SendHorizontal,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import type { ElderlyAnswerGuide, MemoryCandidate, SelectionMode } from "../../contracts/types";
import type { QualityState } from "../services/qualityAnalyzer";
import { toSpeechText } from "../services/speechText";
import type { ConversationSession, DemoAccount, DetectedIntent, SelectedContext, UiMode, UserProfile } from "../types";
import { ElderlyAnswerView } from "./ElderlyAnswerView";
import { MarkdownText } from "./MarkdownText";
import { humanizeMemoryLabel } from "../services/labelMapper";
import { Pill } from "./Pill";

type ChatWorkspaceProps = {
  account: DemoAccount;
  profile: UserProfile;
  question: string;
  submittedQuestion: string;
  conversations: ConversationSession[];
  conversationId: string;
  currentTurnId: string;
  conversationNotice: string;
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
  elderlyGuides: ElderlyAnswerGuide[];
  reexplaining: boolean;
  onRetryExplain: () => void;
  quality: QualityState;
  uiMode: UiMode;
  apiError?: string;
  canRetry: boolean;
  memoryCandidates: MemoryCandidate[];
  memoryResolvingId: string;
  memoryActions: Record<string, "save" | "ignore">;
  onQuestionChange: (question: string) => void;
  onConversationChange: (conversationId: string) => void;
  onNewConversation: () => void;
  onAnalyze: () => void;
  onToggleApproval: (key: string, approved: boolean) => void;
  onGenerate: () => void;
  onRetry: () => void;
  onResolveMemory: (candidateId: string, action: "save" | "ignore") => void;
  onReset: () => void;
};

type VoiceState = "idle" | "starting" | "listening";

type SpeechRecognitionResultLike = {
  0: { transcript: string };
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export function ChatWorkspace({
  account,
  profile,
  question,
  submittedQuestion,
  conversations,
  conversationId,
  currentTurnId,
  conversationNotice,
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
  elderlyGuides,
  reexplaining,
  onRetryExplain,
  quality,
  uiMode,
  apiError,
  canRetry,
  memoryCandidates,
  memoryResolvingId,
  memoryActions,
  onQuestionChange,
  onConversationChange,
  onNewConversation,
  onAnalyze,
  onToggleApproval,
  onGenerate,
  onRetry,
  onResolveMemory,
  onReset,
}: ChatWorkspaceProps) {
  const easy = uiMode === "easy";
  const inputGridClass = !easy && intent
    ? "grid-cols-[auto_minmax(0,1fr)_auto]"
    : "grid-cols-[minmax(0,1fr)_auto]";
  const approvalPool = [...selected, ...sensitive];
  const approved = approvalPool.filter((field) => approvals[field.key]);
  const approvedCount = approved.length;
  const canGenerate = Boolean(intent && !generating);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const approvalRef = useRef<HTMLDivElement | null>(null);
  const generatingRef = useRef<HTMLDivElement | null>(null);
  const latestAnswerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceBaseQuestionRef = useRef("");
  const voiceFinalTranscriptRef = useRef("");
  const voiceLiveTranscriptRef = useRef("");
  const voiceErrorRef = useRef(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [voicePreview, setVoicePreview] = useState("");
  const activeConversation = conversations.find((conversation) => conversation.id === conversationId);
  const previousTurns = activeConversation?.turns.filter((turn) => turn.id !== currentTurnId) || [];
  const voiceActive = voiceState !== "idle";

  useEffect(() => {
    if (bridgePrompt) {
      latestAnswerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    if (generating) {
      generatingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    if (intent) {
      approvalRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [intent, bridgePrompt, apiError, generating, previousTurns.length]);

  const copyAnswer = async () => {
    if (!bridgePrompt) return;
    await navigator.clipboard.writeText(bridgePrompt);
  };

  const stopVoiceQuestion = () => {
    if (!recognitionRef.current) return;
    setVoiceMessage("말씀을 정리하고 있어요.");
    recognitionRef.current.stop();
  };

  const resetQuestionFlow = () => {
    stopVoiceQuestion();
    setVoiceMessage("");
    setVoicePreview("");
    onReset();
  };

  const submitQuestion = () => {
    stopVoiceQuestion();
    if (analyzing || generating || !question.trim()) return;
    onAnalyze();
  };

  const startVoiceQuestion = () => {
    const voiceWindow = window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
    const SpeechRecognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceMessage("이 브라우저에서는 음성 질문을 지원하지 않습니다. 글자로 질문해 주세요.");
      return;
    }

    if (recognitionRef.current) {
      stopVoiceQuestion();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    voiceBaseQuestionRef.current = question.trim();
    voiceFinalTranscriptRef.current = "";
    voiceLiveTranscriptRef.current = "";
    voiceErrorRef.current = false;
    setVoiceState("starting");
    setVoicePreview("");
    setVoiceMessage("브라우저 권한 창에서 마이크 사용을 허용해 주세요.");

    recognition.onstart = () => {
      setVoiceState("listening");
      setVoiceMessage("듣고 있어요. 말한 내용이 질문 칸에 바로 적힙니다.");
    };

    recognition.onresult = (event) => {
      let finalTranscript = voiceFinalTranscriptRef.current;
      let interimTranscript = "";
      const startIndex = event.resultIndex ?? 0;

      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript || "";
        if (result.isFinal) finalTranscript = `${finalTranscript} ${text}`.trim();
        else interimTranscript = `${interimTranscript} ${text}`.trim();
      }

      voiceFinalTranscriptRef.current = finalTranscript;
      const currentTranscript = `${finalTranscript} ${interimTranscript}`.trim();
      const baseQuestion = voiceBaseQuestionRef.current;
      const nextQuestion = baseQuestion && currentTranscript
        ? `${baseQuestion} ${currentTranscript}`.trim()
        : currentTranscript || baseQuestion;

      voiceLiveTranscriptRef.current = currentTranscript;
      setVoicePreview(currentTranscript);
      onQuestionChange(nextQuestion);
    };

    recognition.onerror = (event) => {
      const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
      voiceErrorRef.current = true;
      setVoiceMessage(denied ? "마이크 권한이 필요합니다. 브라우저 권한을 허용해 주세요." : "음성을 잘 듣지 못했어요. 다시 눌러 말씀해 주세요.");
      setVoiceState("idle");
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      if (voiceErrorRef.current) {
        voiceErrorRef.current = false;
        recognitionRef.current = null;
        return;
      }
      const hasTranscript = Boolean(voiceFinalTranscriptRef.current || voiceLiveTranscriptRef.current);
      setVoiceState("idle");
      setVoiceMessage(hasTranscript ? "말한 내용을 질문 칸에 넣었어요. 보내기 버튼을 눌러 주세요." : "음성 입력을 멈췄어요. 다시 누르면 말로 질문할 수 있습니다.");
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setVoiceState("idle");
      setVoiceMessage("음성 입력을 시작하지 못했어요. 잠시 후 다시 눌러 주세요.");
    }
  };

  const readAnswer = () => {
    if (!bridgePrompt || !("speechSynthesis" in window)) {
      window.alert("이 브라우저에서는 답변 읽기를 지원하지 않습니다.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(toSpeechText(bridgePrompt));
    utterance.lang = "ko-KR";
    utterance.rate = easy ? 0.88 : 1;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, []);

  return (
    <section className="flex h-screen min-h-[720px] flex-col bg-[#fbfaf6] max-lg:min-h-screen">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line bg-[#fbfaf6]/95 px-6 backdrop-blur max-sm:flex-wrap max-sm:px-4 max-sm:py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase text-bridge">Context Bridge</span>
            <Pill tone={uiMode === "easy" ? "normal" : "neutral"}>{easy ? "쉬운 모드" : "기본 모드"}</Pill>
          </div>
          <h2 className="mt-1 truncate text-lg font-black text-ink max-sm:text-base">
            짧은 질문에 필요한 맥락을 안전하게 연결하기
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2 max-sm:w-full">
          <label className="relative block max-sm:min-w-0 max-sm:flex-1">
            <span className="sr-only">대화 선택</span>
            <select
              className="min-h-10 w-full max-w-52 appearance-none rounded-[6px] border border-line bg-white py-2 pl-3 pr-8 text-sm font-bold text-ink max-sm:max-w-none"
              value={conversationId}
              onChange={(event) => onConversationChange(event.target.value)}
            >
              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>{conversation.title}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-3" size={14} />
          </label>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-line bg-white px-3 text-sm font-black hover:border-bridge" type="button" onClick={onNewConversation}>
            <Plus size={16} /> <span className="max-sm:hidden">새 대화</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-7 max-sm:px-4">
        <div className="mx-auto grid max-w-3xl gap-5">
          {!previousTurns.length && !submittedQuestion && (
            <AssistantMessage easy={easy}
              eyebrow="새로운 대화"
              title={`${account.displayName}님, 무엇을 도와드릴까요?`}
              body="질문을 보내면 필요한 내 정보만 찾아 보여드릴게요. 대화는 아래로 계속 이어집니다."
            />
          )}

          {conversationNotice && (
            <div className="mx-auto rounded-full border border-[#cfe0dc] bg-[#f1faf7] px-4 py-2 text-center text-xs font-bold text-bridge-dark">{conversationNotice}</div>
          )}

          {previousTurns.map((turn) => (
            <div className="contents" key={turn.id}>
              <UserMessage easy={easy}>{turn.question}</UserMessage>
              <AssistantMessage easy={easy} eyebrow="Context Bridge" title="답변">
                {easy && turn.elderlyGuide ? (
                  <ElderlyAnswerView
                    guide={turn.elderlyGuide}
                    answerText={turn.answer}
                    busy={false}
                    readOnly
                    easy={easy}
                    onRetryExplain={() => {}}
                  />
                ) : (
                  <MarkdownText content={turn.answer} className={`${easy ? "text-lg leading-8" : "text-sm leading-7"} text-ink whitespace-pre-wrap`} />
                )}
              </AssistantMessage>
            </div>
          ))}

          {submittedQuestion && <UserMessage easy={easy}>{submittedQuestion}</UserMessage>}

          {analyzing && (
            <LoadingMessage
              title="필요한 정보를 찾고 있어요"
              body="잠시만 기다려 주세요."
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
            <div ref={approvalRef} className="scroll-mt-5">
            <AssistantMessage easy={easy} eyebrow="내 정보 확인" title={`AI가 이 질문에 필요한 정보 ${approvalPool.length}개를 찾았어요`}>
              <div className="grid gap-4">
                <div className="rounded-[6px] border border-[#cfe0dc] bg-[#f6fbf9] p-4">
                  <strong className="text-bridge-dark">답변에 사용할 정보를 직접 골라 주세요.</strong>
                  <p className="mt-1 text-sm leading-6 text-muted">체크한 정보만 AI 답변에 사용됩니다. 원하지 않는 정보는 해제할 수 있어요.</p>
                </div>

                <div className="grid gap-3">
                  {approvalPool.map((field) => {
                    const checked = approvals[field.key] ?? false;
                    const disabled = field.valueVisible === false;
                    return (
                      <label key={field.key} className={`grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-[8px] border p-4 ${checked ? "border-bridge bg-[#f1faf7]" : "border-line bg-white"} ${disabled ? "opacity-55" : "cursor-pointer"}`}>
                        <input
                          className="mt-1 h-6 w-6 accent-bridge"
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={(event) => onToggleApproval(field.key, event.target.checked)}
                        />
                        <span>
                          <span className="flex flex-wrap items-center gap-2">
                            <strong className={easy ? "text-lg" : "text-base"}>{field.label}</strong>
                            {field.sensitivity === "sensitive" && <Pill tone="sensitive">직접 선택</Pill>}
                            <Pill>{selectionRoleLabel(field.selectionRole)}</Pill>
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-muted">
                            {disabled ? "기밀 정보는 답변에 사용할 수 없습니다." : field.value}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {approvalPool.length === 0 && (
                  <div className="rounded-[6px] border border-dashed border-line bg-white p-4 text-sm leading-6 text-muted">
                    이번 질문에 필요한 내 정보가 없습니다. 내 정보 없이 일반 답변을 받을 수 있어요.
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-[#122824] p-4 text-white">
                  <span className="font-black">현재 {approvedCount}개 정보 사용</span>
                  <span className="text-sm text-white/70">{approvedCount ? "선택한 정보만 반영합니다." : "내 정보 없이 일반 답변을 받을 수 있어요."}</span>
                </div>

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
            </div>
          )}

          {generating && (
            <div ref={generatingRef} className="scroll-mt-5">
            <LoadingMessage
              title="선택한 정보로 답변을 만들고 있어요"
              body={`${approvedCount}개 정보를 반영하고 있습니다.`}
            />
            </div>
          )}

          {bridgePrompt && easy && elderlyGuides.length > 0 ? (
            elderlyGuides.map((guide, index) => {
              const isLatest = index === elderlyGuides.length - 1;
              return (
                <div ref={isLatest ? latestAnswerRef : undefined} className="scroll-mt-5" key={index}>
                <AssistantMessage easy={easy}
                  eyebrow={index === 0 ? "답변 생성 완료" : "다시 설명"}
                  title={index === 0 ? "나의 상황을 반영한 답변" : "새로운 답변을 다시 드립니다"}
                >
                  <ElderlyAnswerView
                    guide={guide}
                    answerText={isLatest ? bridgePrompt : undefined}
                    busy={isLatest && reexplaining}
                      readOnly={!isLatest}
                      easy={easy}
                    onRetryExplain={onRetryExplain}
                  />
                </AssistantMessage>
                </div>
              );
            })
              ) : bridgePrompt ? (
                <div ref={latestAnswerRef} className="scroll-mt-5">
                <AssistantMessage easy={easy} eyebrow="답변 생성 완료" title="나의 상황을 반영한 답변">
              <div className="grid gap-4">
                <div className="rounded-[6px] border border-line bg-white p-4 text-ink">
                <MarkdownText content={bridgePrompt} className={`${easy ? "text-lg leading-8" : "text-sm leading-7"} whitespace-pre-wrap`} />
              </div>
                {rawAnswer && (
                  <details className="rounded-[6px] border border-line bg-[#f8f7f2] p-4">
                    <summary className="cursor-pointer text-sm font-black text-ink">
                      개인화하지 않은 일반 답변과 비교
                    </summary>
                    <div className="mt-3 text-muted">
                      <MarkdownText content={rawAnswer} className={`${easy ? "text-lg leading-8" : "text-sm leading-7"} whitespace-pre-wrap`} />
                    </div>
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
                    className={`${easy ? "min-h-14 px-6 text-lg" : "min-h-11 px-4 text-sm"} inline-flex items-center gap-2 rounded-[6px] bg-bridge font-black text-white`}
                    type="button"
                    onClick={readAnswer}
                  >
                    <Volume2 size={easy ? 22 : 17} />
                    소리로 듣기
                  </button>
                  <button
                    className={`${easy ? "min-h-14 px-6 text-lg" : "min-h-11 px-4 text-sm"} inline-flex items-center gap-2 rounded-[6px] border border-line bg-white font-black text-ink hover:border-bridge disabled:cursor-not-allowed disabled:opacity-45`}
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
                </div>
          ) : null}

          {answerCompleted && !bridgePrompt && !generating && (
            <AssistantMessage easy={easy}
              eyebrow="빈 응답"
              title="답변을 받지 못했습니다"
              body="잠시 후 다시 만들기를 눌러 주세요."
            />
          )}

          {memoryCandidates.map((candidate) => {
            const action = memoryActions[candidate.id];
            const resolving = memoryResolvingId === candidate.id;

            return (
              <AssistantMessage key={candidate.id} easy={easy} eyebrow="기억 후보" title="이 내용을 다음에도 기억할까요?">
                <div className="grid gap-3">
                  <div className="rounded-[6px] border border-line bg-[#f8f7f2] p-4">
                    <strong className="block text-sm text-ink">{humanizeMemoryLabel(candidate.label)}</strong>
                    <span className="mt-1 block text-sm leading-6 text-muted">{candidate.content}</span>
                  </div>
                  {action ? (
                    <p className="text-sm font-bold text-bridge-dark">
                      {action === "save" ? "나의 정보에 저장했습니다." : "이번 기억 후보를 저장하지 않았습니다."}
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

          <div className={`grid ${inputGridClass} items-end gap-2 rounded-[8px] border border-line bg-white p-2 shadow-[0_18px_48px_rgba(18,40,36,0.08)]`}>
            {!easy && intent && (
              <button
                className="grid h-12 w-12 place-items-center rounded-[6px] border border-line bg-white"
                type="button"
                aria-label="질문 단계로 되돌리기"
                onClick={resetQuestionFlow}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <textarea
              className={`max-h-40 w-full min-w-0 resize-none rounded-[6px] border-0 bg-transparent px-3 py-3 text-ink outline-none placeholder:text-muted ${easy ? "min-h-14 text-lg leading-7" : "min-h-12 text-sm leading-6"}`}
              value={question}
              placeholder="질문을 입력하세요"
              onChange={(event) => {
                if (!voiceActive && (voiceMessage || voicePreview)) {
                  setVoiceMessage("");
                  setVoicePreview("");
                }
                onQuestionChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitQuestion();
                }
              }}
            />
            <div className="flex shrink-0 items-end justify-end gap-2">
              {!intent && (
                <button
                  className={`${easy ? "h-14 px-5 text-base" : "h-12 px-4 text-sm"} inline-flex items-center gap-2 rounded-[6px] border-2 font-black transition ${voiceActive ? "border-accent bg-[#fff6eb] text-[#2b180b] shadow-[0_0_0_4px_rgba(231,139,60,0.16)]" : "border-bridge bg-[#eef8f5] text-bridge hover:bg-[#e5f4ef]"}`}
                  type="button"
                  aria-label={voiceActive ? "음성 입력 끝내기" : "음성으로 질문하기"}
                  aria-pressed={voiceActive}
                  onClick={voiceActive ? stopVoiceQuestion : startVoiceQuestion}
                >
                  <Mic className={voiceActive ? "animate-pulse" : ""} size={easy ? 24 : 19} />
                  <span className={voiceActive ? "" : "max-sm:hidden"}>{voiceActive ? "말 끝내기" : "말로 질문하기"}</span>
                </button>
              )}
              <button
                className={`${easy ? "grid h-14 w-14" : "grid h-12 w-12"} place-items-center rounded-[8px] border border-line bg-zinc-100 text-ink transition hover:border-bridge`}
                type="button"
                aria-label="초기화"
                title="초기화 (대화 재설정)"
                onClick={resetQuestionFlow}
              >
                <RefreshCw size={easy ? 20 : 18} />
              </button>
              {intent && !bridgePrompt ? (
                <button
                  className={`${easy ? "h-14 px-5 text-base" : "h-12 px-4 text-sm"} inline-flex items-center gap-2 rounded-[6px] bg-accent font-black text-[#2b180b] transition disabled:cursor-not-allowed disabled:opacity-45 max-sm:px-3`}
                  type="button"
                  disabled={!canGenerate}
                  onClick={onGenerate}
                >
                  {generating ? <LoaderCircle className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  <span className="max-sm:hidden">
                    {generating ? "답변 생성 중" : answerCompleted ? "다시 만들기" : approvedCount ? "선택한 정보로 답변 받기" : "내 정보 없이 답변 받기"}
                  </span>
                </button>
              ) : (
                <button
                  className={`${easy ? "grid h-14 w-14" : "grid h-12 w-12"} place-items-center rounded-[6px] bg-bridge text-white transition disabled:cursor-not-allowed disabled:opacity-50`}
                  type="button"
                  aria-label="다음"
                  disabled={analyzing || generating || !question.trim()}
                  onClick={submitQuestion}
                >
                  {analyzing ? <LoaderCircle className="animate-spin" size={18} /> : <SendHorizontal size={18} />}
                </button>
              )}
            </div>
          </div>

          {(voiceActive || voiceMessage || voicePreview) && (
            <div
              className={`rounded-[8px] border px-4 py-3 ${voiceActive ? "border-accent bg-[#fff6eb]" : "border-[#cfe0dc] bg-[#f7fbf9]"}`}
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${voiceActive ? "animate-pulse bg-accent" : "bg-bridge"}`} />
                <strong className={`${easy ? "text-base" : "text-sm"} text-ink`}>
                  {voiceActive ? "마이크 사용 중" : "음성 입력"}
                </strong>
                <span className={`${easy ? "text-base" : "text-sm"} text-muted`}>
                  {voiceMessage || "말한 내용이 질문 칸에 들어갑니다."}
                </span>
              </div>
              {voicePreview && (
                <p className={`mt-2 rounded-[6px] bg-white px-3 py-2 ${easy ? "text-lg leading-7" : "text-sm leading-6"} text-bridge-dark`}>
                  “{voicePreview}”
                </p>
              )}
            </div>
          )}

          <p className="text-center text-xs leading-5 text-muted">
            Context Bridge v20 · 승인한 정보만 답변 생성에 사용하며 기밀 정보는 사용할 수 없습니다.
          </p>
        </div>
      </footer>
    </section>
  );
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
  easy,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
  easy?: boolean;
}) {
  return (
    <article className="grid grid-cols-[38px_minmax(0,1fr)] gap-3">
      <div className={`grid ${easy ? "h-12 w-12" : "h-9 w-9"} place-items-center rounded-full bg-[#122824] text-xs font-black text-[#f8d7ad]`}>CB</div>
      <div className={`rounded-[8px] border border-line bg-white p-4 shadow-[0_12px_36px_rgba(18,40,36,0.05)] ${easy ? "text-lg" : ""}`}>
        <div className={`mb-2 ${easy ? "text-sm" : "text-xs"} font-black uppercase text-bridge`}>{eyebrow}</div>
        <h3 className={`${easy ? "text-2xl" : "text-lg"} font-black text-ink`}>{title}</h3>
        {body && <p className={`mt-2 ${easy ? "text-lg" : "text-sm"} leading-7 text-muted`}>{body}</p>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </article>
  );
}

function UserMessage({ children, easy }: { children: React.ReactNode; easy?: boolean }) {
  return (
    <article className={`ml-auto grid max-w-[86%] justify-items-end gap-2`}> 
      <div className={`rounded-[18px] rounded-br-[6px] bg-[#116a67] px-4 py-3 font-bold leading-7 text-white shadow-[0_12px_30px_rgba(17,106,103,0.22)] ${easy ? "text-xl py-5 px-6" : "text-sm px-4 py-3"}`}>
        {children}
      </div>
    </article>
  );
}

function selectionRoleLabel(role: SelectedContext["selectionRole"]) {
  if (role === "must_use") return "꼭 확인";
  if (role === "should_use") return "도움됨";
  return "선택 가능";
}
