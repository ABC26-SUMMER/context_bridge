import type { UiMode } from "../types";
import { getUiModeDescription, getUiModeLabel } from "../services/uiMode";
import { Pill } from "./Pill";

type HeaderProps = {
  selectedCount: number;
  approvedCount: number;
  sensitiveCount: number;
  uiMode: UiMode;
};

export function Header({ selectedCount, approvedCount, sensitiveCount, uiMode }: HeaderProps) {
  const easy = uiMode === "easy";
  const metricLabels = easy
    ? ["사용할 정보", "확인한 정보", "조심할 정보"]
    : ["선택 맥락", "승인 맥락", "민감 맥락"];

  return (
    <header className="mb-6 flex items-start justify-between gap-6 max-lg:grid">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs font-black uppercase text-bridge">Inclusive AI Context Layer</div>
          <Pill tone={uiMode === "easy" ? "normal" : "neutral"}>{getUiModeLabel(uiMode)}</Pill>
        </div>
        <h2 className={`mt-2 max-w-3xl font-black leading-tight tracking-normal ${easy ? "text-5xl max-sm:text-3xl" : "text-4xl max-sm:text-2xl"}`}>
          짧은 자연어를 고급 프롬프트로 바꾸는 다리
        </h2>
        <p className={`${easy ? "text-xl leading-9" : "leading-7"} mt-4 max-w-3xl text-ink`}>
          로그인 계정의 프로필을 불러오고, 서버가 질문의 결정·위험 영역에 필요한 정보만 골라 보여줍니다.
        </p>
        <p className={`${easy ? "text-lg" : "text-sm"} mt-3 max-w-3xl text-muted`}>
          {getUiModeDescription(uiMode)}
        </p>
      </div>

      <div className="grid min-w-72 grid-cols-3 gap-2 max-sm:min-w-0 max-sm:grid-cols-1">
        <Metric value={selectedCount} label={metricLabels[0]} easy={easy} />
        <Metric value={approvedCount} label={metricLabels[1]} easy={easy} />
        <Metric value={sensitiveCount} label={metricLabels[2]} easy={easy} />
      </div>
    </header>
  );
}

function Metric({ value, label, easy }: { value: number; label: string; easy: boolean }) {
  return (
    <div className="border border-line bg-white p-3">
      <strong className={`block font-black text-bridge-dark ${easy ? "text-4xl" : "text-2xl"}`}>{value}</strong>
      <span className={`${easy ? "text-base" : "text-xs"} text-muted`}>{label}</span>
    </div>
  );
}
