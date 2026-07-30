import { useState } from "react";
import { LoaderCircle, UserRoundPlus } from "lucide-react";
import type { ProfileInput } from "../services/profileRepository";

type ProfileOnboardingProps = {
  email: string;
  loading: boolean;
  error?: string;
  onCreate: (input: ProfileInput) => Promise<void>;
  onLogout: () => void;
};

export function ProfileOnboarding({ email, loading, error, onCreate, onLogout }: ProfileOnboardingProps) {
  const [input, setInput] = useState<ProfileInput>({
    displayName: "",
    personaType: "custom",
    profileName: "내 프로필",
    icon: "CB",
    description: "",
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.displayName.trim() || !input.profileName.trim()) return;
    await onCreate(input);
  };

  return (
    <main className="min-h-screen bg-[#f8f7f2] p-7 max-sm:p-4">
      <section className="mx-auto grid min-h-[calc(100vh-56px)] max-w-3xl content-center">
        <form className="border border-line bg-white p-7 shadow-[0_20px_55px_rgba(18,40,36,0.08)] max-sm:p-5" onSubmit={submit}>
          <div className="grid h-12 w-12 place-items-center bg-[#122824] text-[#f8d7ad]">
            <UserRoundPlus size={21} />
          </div>
          <div className="mt-5 text-xs font-black uppercase text-bridge">First Profile</div>
          <h1 className="mt-2 text-4xl font-black leading-tight max-sm:text-3xl">나를 이해할 첫 프로필을 만들어요</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{email} 계정에는 아직 프로필이 없습니다.</p>

          <div className="mt-7 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <Field label="표시 이름">
              <input value={input.displayName} onChange={(event) => setInput({ ...input, displayName: event.target.value })} />
            </Field>
            <Field label="프로필 이름">
              <input value={input.profileName} onChange={(event) => setInput({ ...input, profileName: event.target.value })} />
            </Field>
            <Field label="사용 유형">
              <select
                value={input.personaType}
                onChange={(event) => setInput({ ...input, personaType: event.target.value as ProfileInput["personaType"] })}
              >
                <option value="custom">일반 사용자</option>
                <option value="university_student">대학생</option>
                <option value="older_adult">쉬운 설명 필요</option>
              </select>
            </Field>
            <Field label="아이콘">
              <input value={input.icon} maxLength={4} onChange={(event) => setInput({ ...input, icon: event.target.value })} />
            </Field>
            <label className="col-span-2 grid gap-2 text-sm font-black max-sm:col-span-1">
              프로필 설명
              <textarea
                className="min-h-24 resize-y border border-line px-3 py-3 font-normal outline-none focus:border-bridge focus:ring-4 focus:ring-bridge/10"
                value={input.description}
                onChange={(event) => setInput({ ...input, description: event.target.value })}
              />
            </label>
          </div>

          {error && <div className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button className="min-h-11 border border-line bg-white px-4 text-sm font-black" type="button" onClick={onLogout}>
              다른 계정으로 로그인
            </button>
            <button
              className="inline-flex min-h-11 items-center gap-2 bg-bridge px-5 text-sm font-black text-white disabled:opacity-50"
              type="submit"
              disabled={loading || !input.displayName.trim() || !input.profileName.trim()}
            >
              {loading && <LoaderCircle className="animate-spin" size={17} />}
              프로필 만들기
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-black [&_input]:min-h-11 [&_input]:border [&_input]:border-line [&_input]:px-3 [&_input]:font-normal [&_input]:outline-none [&_input]:focus:border-bridge [&_input]:focus:ring-4 [&_input]:focus:ring-bridge/10 [&_select]:min-h-11 [&_select]:border [&_select]:border-line [&_select]:bg-white [&_select]:px-3 [&_select]:font-normal">
      {label}
      {children}
    </label>
  );
}
