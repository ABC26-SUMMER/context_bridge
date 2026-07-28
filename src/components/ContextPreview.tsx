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
  const approvedCount = [...selected, ...sensitive].filter((field) => approvals[field.key]).length;

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
            <Pill>{intent ? `${intent.confidence}% 신뢰도` : "분석 전"}</Pill>
          </div>
          <p className={`${easy ? "text-lg leading-8" : "text-sm leading-6"} mt-2 text-muted`}>
            {intent
              ? `분석 위치: ${source === "backend" ? "백엔드 규칙 엔진" : "프론트 fallback 규칙 엔진"}`
              : "프로필과 질문을 선택한 뒤 분석을 실행하세요."}
          </p>
        </div>

        <ContextGroup
          title={easy ? "사용할 정보" : "질문에 맞게 선택된 정보"}
          fields={selected}
          approvals={approvals}
          easy={easy}
          onToggle={onToggle}
        />

        <ContextGroup
          title={easy ? "조심할 정보" : "민감 가능 정보"}
          fields={sensitive}
          approvals={approvals}
          easy={easy}
          sensitive
          onToggle={onToggle}
          emptyText="민감해서 따로 확인할 정보가 없습니다."
        />

        {!easy && (
          <ContextGroup
            title="이번 질문에서 제외된 정보"
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
            <label
              key={field.key}
              className={`grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 border border-line bg-white ${easy ? "p-5" : "p-4"} ${
                !readOnly && checked ? "" : "opacity-70"
              } max-sm:grid-cols-[28px_minmax(0,1fr)]`}
            >
              <input
                className={`${easy ? "h-7 w-7" : "h-5 w-5"} mt-1 accent-bridge disabled:opacity-30`}
                type="checkbox"
                checked={readOnly ? false : checked}
                disabled={readOnly}
                onChange={(event) => onToggle(field.key, event.target.checked)}
              />
              <span className="grid gap-1">
                <strong className={easy ? "text-xl" : "text-sm"}>{field.label}</strong>
                <span className={`${easy ? "text-lg" : "text-sm"} text-muted`}>{field.value}</span>
                {!easy && <span className="mt-1 text-sm leading-6 text-[#3c4945]">{field.reason}</span>}
              </span>
              <Pill tone={sensitive || field.sensitivity === "sensitive" ? "sensitive" : "normal"}>
                {sensitive || field.sensitivity === "sensitive" ? "확인 필요" : "사용"}
              </Pill>
            </label>
          );
        })
      )}
    </div>
  );
}
