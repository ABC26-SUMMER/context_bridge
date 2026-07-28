import type { UserProfile } from "../types";
import { Pill } from "./Pill";

type ProfileManagerProps = {
  profiles: UserProfile[];
  profileId: string;
  onProfileChange: (profileId: string) => void;
};

const sectionNames: Record<string, string> = {
  occupation: "기본 정보",
  major: "기본 정보",
  grade: "기본 정보",
  age_group: "기본 정보",
  digital_literacy: "기본 정보",
  career_goal: "목표",
  certificate_goal: "목표",
  current_skills: "역량",
  available_study_time: "제약 조건",
  mobility: "제약 조건",
  transportation: "제약 조건",
  budget_level: "제약 조건",
  place_preference: "취향",
  accessibility_preferences: "접근성",
  response_style: "출력 방식",
};

export function ProfileManager({ profiles, profileId, onProfileChange }: ProfileManagerProps) {
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const grouped = profile.fields.reduce<Record<string, typeof profile.fields>>((acc, field) => {
    const section = sectionNames[field.key] || "기타";
    acc[section] ||= [];
    acc[section].push(field);
    return acc;
  }, {});

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6">
        <div className="text-xs font-black uppercase text-bridge">Profile Manager</div>
        <h2 className="mt-2 text-4xl font-black leading-tight max-sm:text-2xl">계정별 프로필 저장 상태</h2>
        <p className="mt-3 leading-7 text-muted">
          데모에서는 대표 계정 2개를 보여주고, Supabase 환경변수가 있으면 DB의 프로필 데이터를 불러옵니다.
        </p>
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
          <div className="flex flex-wrap gap-2">
            <Pill>{profile.personaType}</Pill>
            <Pill>{profile.source === "supabase" ? "Supabase 저장" : "로컬 데모 데이터"}</Pill>
          </div>
          {Object.entries(grouped).map(([section, fields]) => (
            <div key={section} className="border border-line bg-white">
              <h3 className="border-b border-line bg-[#f8f7f2] px-4 py-3 text-base font-black">
                {section}
              </h3>
              {fields.map((field) => (
                <div key={field.key} className="grid grid-cols-[160px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 max-sm:grid-cols-1">
                  <div className="text-sm font-black text-muted">{field.label}</div>
                  <div className="leading-6">{field.value}</div>
                  <Pill tone="normal">{field.enabled ? "활성" : "비활성"}</Pill>
                  <Pill tone={field.sensitivity === "sensitive" ? "sensitive" : "normal"}>
                    {field.sensitivity === "sensitive" ? "민감 가능" : "일반"}
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
