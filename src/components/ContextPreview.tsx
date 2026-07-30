import type { DetectedIntent, SelectedContext, UiMode } from "../types";
import { Pill } from "./Pill";

type ContextPreviewProps = {
  intent: DetectedIntent | null;
  selected: SelectedContext[];
  sensitive: SelectedContext[];
  excluded: SelectedContext[];
  approvals: Record<string, boolean>;
  source?: "backend" | "frontend";
  onToggle: (key: string, approved: boolean) => void;
  onGenerate: () => void;
  uiMode: UiMode;
};

export function ContextPreview({
  intent,
  selected,
  sensitive,
  excluded,
  approvals,
  source,
  onToggle,
  onGenerate,
  uiMode,
}: ContextPreviewProps) {
  const easy = uiMode === "easy";
  const pool = [...selected, ...sensitive];
  const approvedCount = pool.filter((field) => approvals[field.key]).length;
  const must = pool.filter((field) => field.selectionRole === 'must_use');
  const should = pool.filter((field) => !field.selectionRole || field.selectionRole === 'should_use');
  const optional = pool.filter((field) => field.selectionRole === 'optional');

  return (
    <section className="border border-line bg-white">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h3 className={`${easy ? "text-2xl" : "text-xl"} font-black`}>
          {easy ? "사용할 정보 확인" : "Context Selection"}
        </h3>
        <button
          className={`${easy ? "min-h-14 px-6 text-xl" : "min-h-11 px-4"} bg-accent font-black text-[#2b180b] disabled:cursor-not-allowed disabled:opacity-45`}
          type="button"
          disabled={!intent || approvedCount === 0}
          onClick={onGenerate}
        >
          {easy ? "AI에 넣을 문장 만들기" : "승인 정보로 프롬프트 만들기"}
        </button>
      </div>

      <div className="grid gap-3 p-5">
        <div className="border border-[#cfe0dc] bg-[#f6fbf9] p-4">
          <div className="flex items-center justify-between gap-3">
            <strong>{intent ? intent.label : "질문 의도 대기 중"}</strong>
            <Pill>{intent ? "확인 필요" : "분석 전"}</Pill>
          </div>
          <p className={`${easy ? "text-lg leading-8" : "text-sm leading-6"} mt-2 text-muted`}>
            {intent
              ? `분석 위치: ${source === "backend" ? "백엔드 규칙 엔진" : "프론트 fallback 규칙 엔진"}`
              : "프로필과 질문을 선택한 뒤 분석을 실행하세요."}
          </p>
        </div>

        <ContextGroup
          title="꼭 필요한 정보"
          fields={must}
          approvals={approvals}
          easy={easy}
          onToggle={onToggle}
          emptyText="필수로 반영할 정보가 없습니다."
        />

        <ContextGroup
          title="함께 쓰면 좋은 정보"
          fields={should}
          approvals={approvals}
          easy={easy}
          onToggle={onToggle}
        />

        <ContextGroup
          title="추가로 사용할 정보"
          fields={optional}
          approvals={approvals}
          easy={easy}
          onToggle={onToggle}
          emptyText="선택적으로 반영할 정보가 없습니다."
        />

        {!easy && (
          <ContextGroup
            title="이번에는 사용하지 않음"
            fields={excluded}
            approvals={{}}
            easy={easy}
            readOnly
            onToggle={onToggle}
            emptyText="제외된 정보가 없습니다."
          />
        )}
      </div>
    </section>
  );
}

function ContextGroup({
  title,
  fields,
  approvals,
  easy,
  sensitive = false,
  readOnly = false,
  emptyText = "선택된 정보가 없습니다.",
  onToggle,
}: {
  title: string;
  fields: SelectedContext[];
  approvals: Record<string, boolean>;
  easy: boolean;
  sensitive?: boolean;
  readOnly?: boolean;
  emptyText?: string;
  onToggle: (key: string, approved: boolean) => void;
}) {
  return (
    <div className="grid gap-2">
      <h4 className={`${easy ? "text-xl" : "text-sm"} font-black text-bridge-dark`}>{title}</h4>
      {fields.length === 0 ? (
        <div className="border border-dashed border-line bg-white p-4 text-sm text-muted">{emptyText}</div>
      ) : (
        fields.map((field) => {
          const checked = approvals[field.key] ?? false;
          return (
            <div
              key={field.key}
              className={`grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 border border-line bg-white ${easy ? "p-5" : "p-4"} ${
                !readOnly && checked ? "" : "opacity-70"
              } max-sm:grid-cols-[28px_minmax(0,1fr)]`}
            >
              {field.sensitivity === "sensitive" ? (
                <span className="mt-1 text-center text-lg" aria-hidden="true">🔒</span>
              ) : (
                <input
                  className={`${easy ? "h-7 w-7" : "h-5 w-5"} mt-1 accent-bridge disabled:opacity-30`}
                  type="checkbox"
                  checked={readOnly ? false : checked}
                  disabled={readOnly}
                  onChange={(event) => onToggle(field.key, event.target.checked)}
                />
              )}
              <span className="grid gap-1">
                <strong className={easy ? "text-xl" : "text-sm"}>{field.label}</strong>
                <span className={`${easy ? "text-lg" : "text-sm"} text-muted`}>{field.value}</span>
                {!readOnly && field.sensitivity === "sensitive" && (
                  <span className="mt-2 grid gap-2">
                    <span className="font-bold">건강 또는 이동 관련 정보입니다. 이 질문에 사용할까요?</span>
                    <span className="flex flex-wrap gap-2">
                      <button type="button" className="border border-bridge px-3 py-2 font-black" onClick={() => onToggle(field.key, true)}>사용할게요</button>
                      <button type="button" className="border border-line px-3 py-2 font-black" onClick={() => onToggle(field.key, false)}>사용하지 않을게요</button>
                    </span>
                  </span>
                )}
                {!easy && <>
                  <span className="mt-1 text-sm leading-6 text-[#3c4945]">{field.reason}</span>
                  {field.impact && <span className="text-sm font-bold text-bridge">답변 변화: {field.impact}</span>}
                  {field.requiresReview && (
                    <span className="text-xs font-bold text-amber-800">정보 확인이 필요해요</span>
                  )}
                </>}
              </span>
              <Pill tone={sensitive || field.sensitivity === "sensitive" ? "sensitive" : "normal"}>
                {sensitive || field.sensitivity === "sensitive" ? "확인 필요" : "사용"}
              </Pill>
            </div>
          );
        })
      )}
    </div>
  );
}
