import type { DemoAccount, UiMode, UserProfile } from "../types";
import { Pill } from "./Pill";

type QuestionPanelProps = {
  account: DemoAccount;
  profile: UserProfile;
  question: string;
  analyzing?: boolean;
  onQuestionChange: (question: string) => void;
  onAnalyze: () => void;
  onReset: () => void;
  onLogout: () => void;
  uiMode: UiMode;
};

export function QuestionPanel({
  account,
  profile,
  question,
  analyzing = false,
  onQuestionChange,
  onAnalyze,
  onReset,
  onLogout,
  uiMode,
}: QuestionPanelProps) {
  const easy = uiMode === "easy";

  return (
    <section className="border border-line bg-white">
      <div className="flex min-h-14 items-center justify-between border-b border-line px-5 py-4">
        <h3 className={`${easy ? "text-2xl" : "text-xl"} font-black`}>무엇을 도와드릴까요?</h3>
        <Pill>{profile.source === "supabase" ? "Supabase 프로필" : "Demo 프로필"}</Pill>
      </div>
      <div className="grid gap-4 p-5">
        <div className="grid gap-2 border border-[#dce7e3] bg-[#f6fbf9] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className={easy ? "text-xl" : "text-base"}>현재 로그인: {account.displayName}</strong>
            <button className="border border-line bg-white px-3 py-2 text-sm font-black" type="button" onClick={onLogout}>
              로그아웃
            </button>
          </div>
          <div className={`${easy ? "text-lg" : "text-sm"} leading-6 text-muted`}>{account.email}</div>
          <div className={`${easy ? "text-lg" : "text-sm"} leading-6 text-muted`}>{account.description}</div>
        </div>

        <label className={`grid gap-2 font-bold text-muted ${easy ? "text-lg" : "text-sm"}`}>
          사용자 질문
          <textarea
            className={`w-full resize-y border border-line bg-white px-3 text-ink outline-none focus:border-bridge focus:ring-4 focus:ring-bridge/10 ${easy ? "min-h-36 py-4 text-xl leading-8" : "min-h-28 py-3 leading-6"}`}
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            className={`${easy ? "min-h-14 px-6 text-xl" : "min-h-11 px-4"} bg-bridge font-black text-white disabled:cursor-not-allowed disabled:opacity-50`}
            type="button"
            disabled={analyzing}
            onClick={onAnalyze}
          >
            {analyzing ? "확인 중" : "다음"}
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
