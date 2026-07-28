import type { UserProfile } from "../types";
import { Pill } from "./Pill";

type ProfileManagerProps = {
  profiles: UserProfile[];
  profileId: string;
  onProfileChange: (profileId: string) => void;
};

const sectionNames: Record<string, string> = {
  basic: "기본 정보",
  preferences: "취향",
  constraints: "제약조건",
  goals: "목표",
  response_style: "출력 형식",
};

export function ProfileManager({ profiles, profileId, onProfileChange }: ProfileManagerProps) {
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const grouped = profile.fields.reduce<Record<string, typeof profile.fields>>((acc, field) => {
    const section = field.key.split(".")[0];
    acc[section] ||= [];
    acc[section].push(field);
    return acc;
  }, {});

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6">
        <div className="text-xs font-black uppercase text-bridge">Profile Manager</div>
        <h2 className="mt-2 text-4xl font-black leading-tight max-sm:text-2xl">개인화에 사용할 정보와 통제 상태</h2>
        <p className="mt-3 leading-7 text-muted">데모 프로필은 정보별 활성화 여부와 민감도를 포함합니다.</p>
      </div>

      <div className="border border-line bg-white">
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h3 className="text-xl font-black">프로필 보기</h3>
          <select
            className="border border-line bg-white px-3 py-2 text-sm font-bold"
            value={profileId}
            onChange={(event) => onProfileChange(event.target.value)}
          >
            {profiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.group}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 p-5">
          {Object.entries(grouped).map(([section, fields]) => (
            <div key={section} className="border border-line bg-white">
              <h3 className="border-b border-line bg-[#f8f7f2] px-4 py-3 text-base font-black">
                {sectionNames[section] || section}
              </h3>
              {fields.map((field) => (
                <div key={field.key} className="grid grid-cols-[160px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 max-sm:grid-cols-1">
                  <div className="text-sm font-black text-muted">{field.label}</div>
                  <div className="leading-6">{field.value}</div>
                  <Pill tone="normal">{field.enabled ? "활성" : "비활성"}</Pill>
                  <Pill tone={field.sensitivity === "sensitive" ? "sensitive" : "normal"}>
                    {field.sensitivity === "sensitive" ? "민감" : "보통"}
                  </Pill>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
