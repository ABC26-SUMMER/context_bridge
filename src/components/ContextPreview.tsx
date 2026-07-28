import type { DetectedIntent, SelectedContext, UiMode } from "../types";
import { Pill } from "./Pill";

type ContextPreviewProps = {
  intent: DetectedIntent | null;
  selected: SelectedContext[];
  approvals: Record<string, boolean>;
  onToggle: (key: string, approved: boolean) => void;
  onGenerate: () => void;
  uiMode: UiMode;
};

export function ContextPreview({ intent, selected, approvals, onToggle, onGenerate, uiMode }: ContextPreviewProps) {
  const easy = uiMode === "easy";

  return (
    <section className="border border-line bg-white">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h3 className={`${easy ? "text-2xl" : "text-xl"} font-black`}>{easy ? "사용할 정보 확인" : "Context Preview"}</h3>
        <button
          className={`${easy ? "min-h-14 px-6 text-xl" : "min-h-11 px-4"} bg-accent font-black text-[#2b180b] disabled:cursor-not-allowed disabled:opacity-45`}
          type="button"
          disabled={selected.length === 0}
          onClick={onGenerate}
        >
          {easy ? "AI에 넣을 문장 만들기" : "고급 프롬프트 만들기"}
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
              ? intent.lowConfidence
                ? easy ? "질문이 조금 애매해서 가장 가까운 뜻으로 골랐습니다." : "의도가 조금 불명확합니다. 데모에서는 가장 가까운 의도로 분석했습니다."
                : easy ? "이번 질문에 쓸 정보만 골랐습니다." : "현재 질문에 필요한 프로필 정보만 골랐습니다."
              : "프로필과 질문을 선택한 뒤 분석을 실행하세요."}
          </p>
        </div>

        {selected.map((field) => {
          const checked = approvals[field.key] ?? true;
          return (
            <label
              key={field.key}
              className={`grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 border border-line bg-white ${easy ? "p-5" : "p-4"} ${
                checked ? "" : "opacity-60"
              } max-sm:grid-cols-[28px_minmax(0,1fr)]`}
            >
              <input
                className={`${easy ? "h-7 w-7" : "h-5 w-5"} mt-1 accent-bridge`}
                type="checkbox"
                checked={checked}
                onChange={(event) => onToggle(field.key, event.target.checked)}
              />
              <span className="grid gap-1">
                <strong className={easy ? "text-xl" : "text-sm"}>{field.label}</strong>
                <span className={`${easy ? "text-lg" : "text-sm"} text-muted`}>{field.value}</span>
                {!easy && <span className="mt-1 text-sm leading-6 text-[#3c4945]">{field.reason}</span>}
              </span>
              <Pill tone={field.sensitivity === "sensitive" ? "sensitive" : "normal"}>
                {field.sensitivity === "sensitive" ? "민감" : "보통"}
              </Pill>
            </label>
          );
        })}
      </div>
    </section>
  );
}
