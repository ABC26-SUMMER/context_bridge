import { AlertCircle, LogIn, RefreshCw, UserRoundPlus } from "lucide-react";
import type { DemoAccount } from "../types";
import { Pill } from "./Pill";

type LoginScreenProps = {
  accounts: DemoAccount[];
  loading: boolean;
  error?: string;
  emptyProfile?: boolean;
  onLogin: (accountId: string) => void;
  onRetry?: () => void;
};

export function LoginScreen({ accounts, loading, error, emptyProfile, onLogin, onRetry }: LoginScreenProps) {
  return (
    <main className="min-h-screen bg-[#f8f7f2] p-7 max-sm:p-4">
      <section className="mx-auto grid min-h-[calc(100vh-56px)] max-w-5xl content-center gap-6">
        <div>
          <div className="text-xs font-black uppercase text-bridge">Context Bridge Demo Login</div>
          <h1 className="mt-3 max-w-3xl text-5xl font-black leading-tight max-sm:text-3xl">
            로그인한 계정의 프로필만 사용합니다
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
            해커톤 시연용 데모 로그인입니다. 각 계정은 Mock API의 개인 프로필과 연결되고, API는 로그인 계정의 프로필만 조회해 질문에 필요한 정보만 선별합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          {accounts.map((account) => (
            <button
              key={account.id}
              className="grid min-h-52 content-between border border-line bg-white p-5 text-left hover:border-bridge focus:border-bridge focus:outline-none focus:ring-4 focus:ring-bridge/10"
              type="button"
              disabled={loading}
              onClick={() => onLogin(account.id)}
            >
              <span className="grid gap-3">
                <span className="flex items-center justify-between gap-3">
                  <strong className="text-2xl font-black">{account.displayName}</strong>
                  <Pill>{account.source === "supabase" ? "Supabase 계정" : "Demo 계정"}</Pill>
                </span>
                <span className="text-sm font-bold text-bridge-dark">{account.email}</span>
                <span className="leading-7 text-muted">{account.description}</span>
              </span>
              <span className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 bg-bridge px-4 font-black text-white">
                <LogIn size={18} />
                이 계정으로 로그인
              </span>
            </button>
          ))}
        </div>

        {loading && <div className="border border-line bg-white p-4 text-muted">계정 정보를 불러오는 중입니다.</div>}

        {emptyProfile && (
          <div className="flex items-start gap-3 border border-line bg-white p-5" role="status">
            <UserRoundPlus className="mt-0.5 shrink-0 text-bridge" size={20} />
            <div>
              <strong className="block">아직 등록된 프로필이 없습니다</strong>
              <span className="mt-1 block text-sm leading-6 text-muted">
                프로필 생성 기능이 연결되면 이 화면에서 새 프로필을 시작할 수 있습니다.
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-4 border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="mt-0.5 shrink-0" size={19} />
              <div>
                <strong className="block">프로필을 불러오지 못했습니다</strong>
                <span className="mt-1 block text-sm leading-6">{error}</span>
              </div>
            </div>
            {onRetry && (
              <button
                className="inline-flex min-h-10 items-center gap-2 border border-red-300 bg-white px-4 text-sm font-black hover:bg-red-100"
                type="button"
                disabled={loading}
                onClick={onRetry}
              >
                <RefreshCw size={16} />
                다시 시도
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
