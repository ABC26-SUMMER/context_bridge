import { useState } from "react";
import { Check, Clock3, Database, GitBranch, LogOut, Menu, ShieldAlert, UserRound, X } from "lucide-react";
import type { DemoAccount, DetectedIntent, SelectedContext, UserProfile } from "../types";

type SidebarProps = {
  activePage: string;
  onPageChange: (page: string) => void;
  account?: DemoAccount | null;
  profile?: UserProfile | null;
  selectedCount?: number;
  approvedCount?: number;
  sensitiveCount?: number;
  intent?: DetectedIntent | null;
  selected?: SelectedContext[];
  sensitive?: SelectedContext[];
  approvals?: Record<string, boolean>;
  onToggleApproval?: (key: string, approved: boolean) => void;
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
  selectedCount = 0,
  approvedCount = 0,
  sensitiveCount = 0,
  intent,
  selected = [],
  sensitive = [],
  approvals = {},
  onToggleApproval,
  onLogout,
}: SidebarProps) {
  const approvalItems = [...selected, ...sensitive];
  const [mobileOpen, setMobileOpen] = useState(false);

  const changePage = (page: string) => {
    onPageChange(page);
    setMobileOpen(false);
  };

  return (
    <aside className="sticky top-0 z-20 h-screen overflow-auto bg-[#122824] px-5 py-6 text-[#f4f2ea] max-lg:static max-lg:h-auto max-lg:overflow-visible max-sm:px-4 max-sm:py-4">
      <div className="flex items-center justify-between gap-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center border border-white/35 bg-white/10 text-sm font-black text-[#f8d7ad]">
            CB
          </div>
          <div className="min-w-0">
            <strong className="block truncate text-white">Context Bridge</strong>
            {account && <span className="block truncate text-xs text-white/60">{account.displayName}</span>}
          </div>
        </div>
        <button
          className="grid h-11 w-11 shrink-0 place-items-center border border-white/20 bg-white/10 text-white"
          type="button"
          aria-controls="sidebar-content"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div id="sidebar-content" className={`${mobileOpen ? "max-lg:block" : "max-lg:hidden"} lg:block`}>
        <div className="border-b border-white/15 pb-6 max-lg:mt-5">
          <div className="mb-3 grid h-11 w-11 place-items-center border border-white/35 bg-white/10 text-sm font-black text-[#f8d7ad] max-lg:hidden">
            CB
          </div>
          <h1 className="text-3xl font-black leading-tight max-lg:hidden">Context Bridge</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">
            질문은 오른쪽 채팅창에서 받고, 필요한 맥락과 승인 상태는 이 사이드바에서 관리합니다.
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
                aria-current={active ? "page" : undefined}
                onClick={() => changePage(item.id)}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {account && profile && (
          <div className="mt-6 grid gap-3">
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

          <section className="grid grid-cols-3 gap-2">
            <SidebarMetric value={selectedCount} label="선택" />
            <SidebarMetric value={approvedCount} label="승인" />
            <SidebarMetric value={sensitiveCount} label="민감" />
          </section>

          <section className="border border-white/15 bg-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-sm text-white">맥락 승인</strong>
              <span className="text-xs font-bold text-[#f8d7ad]">{intent ? intent.label : "대기"}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/55">
              {intent ? "체크한 정보만 답변 생성에 사용됩니다." : "질문을 보내면 필요한 정보가 여기에 표시됩니다."}
            </p>

            <div className="mt-4 grid gap-2">
              {approvalItems.length === 0 ? (
                <div className="border border-dashed border-white/20 p-3 text-sm leading-6 text-white/50">아직 선택된 맥락이 없습니다.</div>
              ) : (
                approvalItems.map((field) => {
                  const checked = approvals[field.key] ?? false;
                  const sensitiveField = field.sensitivity === "sensitive";
                  const disabled = field.valueVisible === false;

                  return (
                    <label
                      key={field.key}
                      className={`grid grid-cols-[22px_minmax(0,1fr)] gap-2 border p-3 transition ${
                        disabled
                          ? "cursor-not-allowed border-white/10 bg-black/10 text-white/40"
                          :
                        checked
                          ? "border-[#79b8ac] bg-white/12 text-white"
                          : "border-white/15 bg-black/5 text-white/60"
                      }`}
                    >
                      <input
                        className="mt-1 h-4 w-4 accent-[#f8d7ad]"
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => onToggleApproval?.(field.key, event.target.checked)}
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-black">
                          {sensitiveField ? <ShieldAlert size={14} /> : <Check size={14} />}
                          {field.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-white/55">
                          {disabled ? "기밀 정보는 답변에 사용할 수 없습니다." : field.value}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </section>
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-white/15 bg-white/10 p-3">
      <strong className="block text-2xl font-black text-[#f8d7ad]">{value}</strong>
      <span className="text-xs font-bold text-white/55">{label}</span>
    </div>
  );
}
