import type { InteractionRecord } from "../types";
import { Copy, Volume2 } from "lucide-react";
import { toSpeechText } from "../services/speechText";
import { MarkdownText } from "./MarkdownText";
import { Pill } from "./Pill";

type ContextLogProps = {
  records: InteractionRecord[];
};

export function ContextLog({ records }: ContextLogProps) {
  const copyAnswer = async (answer: string) => {
    await navigator.clipboard.writeText(answer);
  };

  const readAnswer = (answer: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(toSpeechText(answer));
    utterance.lang = "ko-KR";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6">
        <div className="text-xs font-black uppercase text-bridge">Context Log</div>
        <h2 className="mt-2 text-4xl font-black leading-tight max-sm:text-2xl">질문별 개인정보 사용 기록</h2>
        <p className="mt-3 leading-7 text-muted">
          어떤 정보가 선택되고, 어떤 정보가 승인 또는 제외됐는지 투명하게 남깁니다.
        </p>
      </div>

      <div className="grid gap-3">
        {records.length === 0 ? (
          <div className="border border-dashed border-line bg-white/70 p-8 text-center text-muted">아직 사용 기록이 없습니다.</div>
        ) : (
          records.map((record, index) => (
            <article key={`${record.createdAt}-${index}`} className="grid gap-3 border border-line bg-white p-4">
              <h3 className="text-lg font-black">{record.question}</h3>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <Pill>{record.profile}</Pill>
                <Pill>{record.intent}</Pill>
                <Pill tone="sensitive">민감 가능 {record.sensitiveCount}</Pill>
                <span>{record.createdAt}</span>
              </div>
              <div className="leading-6">
                <strong>승인한 정보</strong>: {record.approved.length ? record.approved.join(", ") : "없음"}
              </div>
              <div className="leading-6">
                <strong>제외한 정보</strong>: {record.rejected.length ? record.rejected.join(", ") : "없음"}
              </div>
              <div className="rounded-[6px] border border-line bg-[#f8f7f2] p-4">
                <strong className="block text-sm text-bridge-dark">AI 답변</strong>
                <div className="mt-2 text-sm leading-7 text-ink">
                  <MarkdownText content={record.answer || "저장된 답변이 없습니다."} />
                </div>
              </div>
              {record.answer && (
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    className="inline-flex min-h-11 items-center gap-2 rounded-[6px] bg-bridge px-4 text-sm font-black text-white"
                    type="button"
                    onClick={() => readAnswer(record.answer)}
                  >
                    <Volume2 size={17} />
                    소리로 듣기
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-line bg-white px-4 text-sm font-black"
                    type="button"
                    onClick={() => void copyAnswer(record.answer)}
                  >
                    <Copy size={17} />
                    답변 복사
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
