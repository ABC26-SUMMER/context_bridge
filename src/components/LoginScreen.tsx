import { LogIn } from "lucide-react";
import type { DemoAccount } from "../types";
import { Pill } from "./Pill";

type LoginScreenProps = {
  accounts: DemoAccount[];
  loading: boolean;
  onLogin: (accountId: string) => void;
};

export function LoginScreen({ accounts, loading, onLogin }: LoginScreenProps) {
  return (
    <main className="min-h-screen bg-[#f8f7f2] p-7 max-sm:p-4">
      <section className="mx-auto grid min-h-[calc(100vh-56px)] max-w-5xl content-center gap-6">
        <div>
          <div className="text-xs font-black uppercase text-bridge">Context Bridge Demo Login</div>
          <h1 className="mt-3 max-w-3xl text-5xl font-black leading-tight max-sm:text-3xl">
            로그인한 계정의 프로필만 사용합니다
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
            해커톤 시연용 데모 로그인입니다. 각 계정은 Supabase의 개인 프로필과 연결되고, 백엔드는 로그인 계정의 프로필만 조회해 질문에 필요한 정보만 선별합니다.
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
      </section>
    </main>
  );
}
