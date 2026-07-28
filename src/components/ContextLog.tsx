import type { InteractionRecord } from "../types";
import { Pill } from "./Pill";

type ContextLogProps = {
  records: InteractionRecord[];
};

export function ContextLog({ records }: ContextLogProps) {
  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6">
        <div className="text-xs font-black uppercase text-bridge">Context Log</div>
        <h2 className="mt-2 text-4xl font-black leading-tight max-sm:text-2xl">질문별 개인정보 활용 기록</h2>
        <p className="mt-3 leading-7 text-muted">어떤 정보가 선택되고 승인됐는지 남겨 투명성을 확인합니다.</p>
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
                <Pill tone="sensitive">민감 {record.sensitiveCount}</Pill>
                <span>{record.createdAt}</span>
              </div>
              <div className="leading-6">
                <strong>승인한 정보</strong>: {record.approved.length ? record.approved.join(", ") : "없음"}
              </div>
              <div className="leading-6">
                <strong>제외한 정보</strong>: {record.rejected.length ? record.rejected.join(", ") : "없음"}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
