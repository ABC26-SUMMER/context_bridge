import type { UserProfile } from "../types";
import type { UiMode } from "../types";
import { Pill } from "./Pill";

type QuestionPanelProps = {
  profiles: UserProfile[];
  profileId: string;
  question: string;
  onProfileChange: (profileId: string) => void;
  onQuestionChange: (question: string) => void;
  onAnalyze: () => void;
  onReset: () => void;
  uiMode: UiMode;
};

export function QuestionPanel({
  profiles,
  profileId,
  question,
  onProfileChange,
  onQuestionChange,
  onAnalyze,
  onReset,
  uiMode,
}: QuestionPanelProps) {
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const easy = uiMode === "easy";

  return (
    <section className="border border-line bg-white">
      <div className="flex min-h-14 items-center justify-between border-b border-line px-5 py-4">
        <h3 className={`${easy ? "text-2xl" : "text-xl"} font-black`}>질문 입력</h3>
        <Pill>P0 Demo</Pill>
      </div>
      <div className="grid gap-4 p-5">
        <label className={`grid gap-2 font-bold text-muted ${easy ? "text-lg" : "text-sm"}`}>
          대표 프로필
          <select
            className={`w-full border border-line bg-white px-3 text-ink outline-none focus:border-bridge focus:ring-4 focus:ring-bridge/10 ${easy ? "py-4 text-xl" : "py-3"}`}
            value={profileId}
            onChange={(event) => onProfileChange(event.target.value)}
          >
            {profiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.group}
              </option>
            ))}
          </select>
        </label>

        <label className={`grid gap-2 font-bold text-muted ${easy ? "text-lg" : "text-sm"}`}>
          사용자 질문
          <textarea
            className={`w-full resize-y border border-line bg-white px-3 text-ink outline-none focus:border-bridge focus:ring-4 focus:ring-bridge/10 ${easy ? "min-h-36 py-4 text-xl leading-8" : "min-h-28 py-3 leading-6"}`}
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button className={`${easy ? "min-h-14 px-6 text-xl" : "min-h-11 px-4"} bg-bridge font-black text-white`} type="button" onClick={onAnalyze}>
            {easy ? "필요한 정보 찾기" : "분석하기"}
          </button>
          <button className={`${easy ? "min-h-14 px-6 text-xl" : "min-h-11 px-4"} border border-line bg-zinc-100 font-black text-ink`} type="button" onClick={onReset}>
            초기화
          </button>
        </div>

        <div>
          <div className={`${easy ? "text-lg" : "text-sm"} mb-2 font-bold text-muted`}>예시 질문</div>
          <div className="grid gap-2">
            {profile.examples.map((example) => (
              <button
                key={example}
                className={`border border-line bg-white px-3 text-left hover:border-bridge ${easy ? "py-4 text-lg leading-7" : "py-3 text-sm leading-5"}`}
                type="button"
                onClick={() => onQuestionChange(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
