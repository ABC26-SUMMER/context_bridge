import { useState } from "react";
import { AlertCircle, ArrowRight, LoaderCircle, LogIn, UserPlus } from "lucide-react";

type LoginScreenProps = {
  loading: boolean;
  error?: string;
  notice?: string;
  onSignIn: (email: string, password: string) => void;
  onSignUp: (email: string, password: string) => void;
};

export function LoginScreen({ loading, error, notice, onSignIn, onSignUp }: LoginScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    if (mode === "signin") onSignIn(email, password);
    else onSignUp(email, password);
  };

  return (
    <main className="min-h-screen bg-[#f8f7f2] p-7 max-sm:p-4">
      <section className="mx-auto grid min-h-[calc(100vh-56px)] max-w-5xl grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] items-center gap-12 max-md:grid-cols-1 max-md:content-center">
        <div>
          <div className="text-xs font-black uppercase text-bridge">Context Bridge</div>
          <h1 className="mt-3 max-w-3xl text-5xl font-black leading-tight max-sm:text-3xl">
            내 정보를 내가 선택하는 개인화 AI
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
            짧은 질문을 보내도 내 프로필에서 필요한 맥락만 골라 보여줍니다. 승인한 정보만 답변 생성에 사용됩니다.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 border-l-4 border-accent pl-5 text-sm leading-7 text-muted">
            <strong className="text-ink">공용 Supabase 계정으로 로그인합니다.</strong>
            <span>로그인 상태와 프로필 데이터는 새로고침 후에도 유지되며, RLS로 본인의 데이터만 조회합니다.</span>
          </div>
        </div>

        <div className="border border-line bg-white p-6 shadow-[0_20px_55px_rgba(18,40,36,0.08)] max-sm:p-5">
          <div className="grid grid-cols-2 border border-line bg-[#f3f2ed] p-1" role="tablist" aria-label="인증 방식">
            <button
              className={`min-h-10 text-sm font-black transition ${mode === "signin" ? "bg-white text-ink shadow-sm" : "text-muted"}`}
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => setMode("signin")}
            >
              로그인
            </button>
            <button
              className={`min-h-10 text-sm font-black transition ${mode === "signup" ? "bg-white text-ink shadow-sm" : "text-muted"}`}
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => setMode("signup")}
            >
              회원가입
            </button>
          </div>

          <div className="mt-6">
            <h2 className="text-2xl font-black">{mode === "signin" ? "다시 만나서 반가워요" : "새 계정 만들기"}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {mode === "signin" ? "이메일과 비밀번호를 입력해 주세요." : "가입 후 이메일 인증이 필요할 수 있습니다."}
            </p>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={submit}>
            <label className="grid gap-2 text-sm font-black text-ink">
              이메일
              <input
                className="min-h-12 border border-line bg-white px-3 font-normal outline-none transition focus:border-bridge focus:ring-4 focus:ring-bridge/10"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                placeholder="name@example.com"
                disabled={loading}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-ink">
              비밀번호
              <input
                className="min-h-12 border border-line bg-white px-3 font-normal outline-none transition focus:border-bridge focus:ring-4 focus:ring-bridge/10"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                value={password}
                minLength={mode === "signup" ? 6 : undefined}
                disabled={loading}
                onChange={(event) => setPassword(event.target.value)}
              />
              {mode === "signup" && <span className="text-xs font-normal text-muted">6자 이상 입력해 주세요.</span>}
            </label>

            {error && (
              <div className="flex items-start gap-2 border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900" role="alert">
                <AlertCircle className="mt-0.5 shrink-0" size={17} />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div className="border border-[#bcd9d1] bg-[#f1f9f6] p-3 text-sm leading-6 text-bridge-dark" role="status">
                {notice}
              </div>
            )}

            <button
              className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 bg-bridge px-4 font-black text-white transition hover:bg-bridge-dark disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              disabled={loading || !email.trim() || !password || (mode === "signup" && password.length < 6)}
            >
              {loading ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : mode === "signin" ? (
                <LogIn size={18} />
              ) : (
                <UserPlus size={18} />
              )}
              {loading ? "처리 중" : mode === "signin" ? "로그인" : "회원가입"}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
