import { Clock3, Database, GitBranch, LogOut, UserRound } from "lucide-react";
import type { DemoAccount, UserProfile } from "../types";

type SidebarProps = {
  activePage: string;
  onPageChange: (page: string) => void;
  account?: DemoAccount | null;
  profile?: UserProfile | null;
  onLogout?: () => void;
};

const navItems = [
  { id: "main", label: "AI 대화", icon: GitBranch },
  { id: "profile", label: "프로필 관리", icon: Database },
  { id: "history", label: "사용 기록", icon: Clock3 },
];

export function Sidebar({
  activePage,
  onPageChange,
  account,
  profile,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="sticky top-0 h-screen overflow-auto bg-[#122824] px-5 py-6 text-[#f4f2ea] max-lg:static max-lg:h-auto">
      <div className="border-b border-white/15 pb-6">
        <div className="mb-3 grid h-11 w-11 place-items-center border border-white/35 bg-white/10 text-sm font-black text-[#f8d7ad]">
          CB
        </div>
        <h1 className="text-3xl font-black leading-tight">Context Bridge</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          대화하고, 내 정보를 관리하고, 사용 기록을 확인하세요.
        </p>
      </div>

      <nav className="mt-6 grid gap-2" aria-label="주요 화면">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;

          return (
            <button
              key={item.id}
              className={`flex min-h-11 items-center gap-3 border-l-4 px-3 text-left text-sm font-bold transition ${
                active
                  ? "border-accent bg-white/10 text-white"
                  : "border-transparent text-white/75 hover:bg-white/5"
              }`}
              type="button"
              onClick={() => onPageChange(item.id)}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {account && profile && (
        <div className="mt-6">
          <section className="border border-white/15 bg-white/10 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="grid h-9 w-9 place-items-center border border-white/20 bg-white/10 text-white/80">
                <UserRound size={17} />
              </div>
              {onLogout && (
                <button
                  className="grid h-9 w-9 place-items-center border border-white/15 bg-white/10 text-white/75 transition hover:bg-white/15 hover:text-white"
                  type="button"
                  aria-label="로그아웃"
                  onClick={onLogout}
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
            <strong className="block text-base text-white">{account.displayName}</strong>
            <span className="mt-1 block text-sm leading-6 text-white/65">{account.description}</span>
            <span className="mt-2 block truncate text-xs text-white/45">{account.email}</span>
          </section>
        </div>
      )}
    </aside>
  );
}
