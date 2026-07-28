import { Clock3, Database, GitBranch } from "lucide-react";

type SidebarProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const navItems = [
  { id: "main", label: "메인 데모", icon: GitBranch },
  { id: "profile", label: "프로필 관리", icon: Database },
  { id: "history", label: "사용 기록", icon: Clock3 },
];

export function Sidebar({ activePage, onPageChange }: SidebarProps) {
  return (
    <aside className="sticky top-0 h-screen overflow-auto bg-[#122824] px-6 py-7 text-[#f4f2ea] max-lg:static max-lg:h-auto">
      <div className="border-b border-white/15 pb-6">
        <div className="mb-3 grid h-11 w-11 place-items-center border border-white/35 bg-white/10 text-sm font-black text-[#f8d7ad]">
          CB
        </div>
        <h1 className="text-3xl font-black leading-tight">Context Bridge</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          계정별 정보를 저장하고, 질문마다 필요한 맥락만 골라 승인 후 AI 프롬프트로 바꾸는 사용자 통제형 AI 데모
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

      <div className="mt-8 border border-white/15 bg-white/10 p-4 text-sm leading-6 text-white/75">
        해커톤 MVP는 전이현 계정과 김영자 계정을 대표 사용자로 두고, 백엔드 규칙 엔진이 질문별 맥락을 선별하는 과정을 보여줍니다.
      </div>
    </aside>
  );
}
