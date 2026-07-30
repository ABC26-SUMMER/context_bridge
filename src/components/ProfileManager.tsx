import { useEffect, useMemo, useState } from "react";
import { Check, Edit3, LoaderCircle, Plus, Save, Trash2, X } from "lucide-react";
import type { ContextCategory, PrivacyLevel } from "../../contracts/types";
import type { ContextCardInput, ProfileInput } from "../services/profileRepository";
import type { ProfileField, UserProfile } from "../types";
import { Pill } from "./Pill";

type ProfileManagerProps = {
  profiles: UserProfile[];
  profileId: string;
  saving: boolean;
  error?: string;
  onProfileChange: (profileId: string) => void;
  onUpdateProfile: (input: ProfileInput) => Promise<boolean>;
  onCreateCard: (input: ContextCardInput) => Promise<boolean>;
  onUpdateCard: (cardId: string, input: ContextCardInput) => Promise<boolean>;
  onDeleteCard: (cardId: string) => Promise<boolean>;
};

const categoryLabels: Record<ContextCategory, string> = {
  profile: "기본 정보",
  preference: "취향",
  goal: "목표",
  constraint: "제약 조건",
  project: "프로젝트",
};

const emptyCard: ContextCardInput = {
  label: "",
  valueText: "",
  category: "profile",
  semanticGroup: "profile",
  tags: [],
  enabled: true,
  sensitivity: "normal",
};

export function ProfileManager({
  profiles,
  profileId,
  saving,
  error,
  onProfileChange,
  onUpdateProfile,
  onCreateCard,
  onUpdateCard,
  onDeleteCard,
}: ProfileManagerProps) {
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileInput, setProfileInput] = useState<ProfileInput>(() => toProfileInput(profile));
  const [cardInput, setCardInput] = useState<ContextCardInput>(emptyCard);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    setProfileInput(toProfileInput(profile));
    setEditingProfile(false);
    setEditingCardId(null);
    setCardFormOpen(false);
  }, [profile]);

  const grouped = useMemo(
    () =>
      profile.fields.reduce<Record<string, ProfileField[]>>((acc, field) => {
        const section = categoryLabels[field.category || "profile"];
        acc[section] ||= [];
        acc[section].push(field);
        return acc;
      }, {}),
    [profile.fields],
  );

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await onUpdateProfile(profileInput)) setEditingProfile(false);
  };

  const openCreateCard = () => {
    setCardInput(emptyCard);
    setEditingCardId(null);
    setCardFormOpen(true);
    setDeleteTargetId(null);
  };

  const openEditCard = (field: ProfileField) => {
    const category = field.category || "profile";
    setCardInput({
      label: field.label,
      valueText: field.value,
      category,
      semanticGroup: field.semanticGroup || category,
      tags: field.tags,
      enabled: field.enabled,
      sensitivity: field.sensitivity,
    });
    setEditingCardId(field.contextId || field.key);
    setCardFormOpen(true);
    setDeleteTargetId(null);
  };

  const saveCard = async (event: React.FormEvent) => {
    event.preventDefault();
    const saved = editingCardId
      ? await onUpdateCard(editingCardId, cardInput)
      : await onCreateCard(cardInput);
    if (!saved) return;
    setCardFormOpen(false);
    setEditingCardId(null);
    setCardInput(emptyCard);
  };

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase text-bridge">Profile Vault</div>
          <h2 className="mt-2 text-4xl font-black leading-tight max-sm:text-2xl">프로필과 컨텍스트 카드</h2>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-2 bg-bridge px-4 text-sm font-black text-white"
          type="button"
          onClick={openCreateCard}
        >
          <Plus size={17} />
          카드 추가
        </button>
      </div>

      {error && <div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}

      <div className="border border-line bg-white">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center bg-[#122824] text-sm font-black text-[#f8d7ad]">
              {profile.icon || "CB"}
            </span>
            <div>
              <h3 className="text-xl font-black">{profile.profileName || profile.name}</h3>
              <span className="text-sm text-muted">{profile.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profiles.length > 1 && (
              <select
                className="min-h-10 border border-line bg-white px-3 text-sm font-bold"
                value={profileId}
                onChange={(event) => onProfileChange(event.target.value)}
              >
                {profiles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.profileName || item.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="grid h-10 w-10 place-items-center border border-line bg-white text-ink hover:border-bridge"
              type="button"
              aria-label="프로필 수정"
              title="프로필 수정"
              onClick={() => setEditingProfile((current) => !current)}
            >
              {editingProfile ? <X size={17} /> : <Edit3 size={17} />}
            </button>
          </div>
        </div>

        {editingProfile && (
          <form className="grid grid-cols-2 gap-4 border-b border-line bg-[#f8f7f2] p-5 max-sm:grid-cols-1" onSubmit={saveProfile}>
            <FormField label="표시 이름">
              <input
                value={profileInput.displayName}
                onChange={(event) => setProfileInput({ ...profileInput, displayName: event.target.value })}
              />
            </FormField>
            <FormField label="프로필 이름">
              <input
                value={profileInput.profileName}
                onChange={(event) => setProfileInput({ ...profileInput, profileName: event.target.value })}
              />
            </FormField>
            <FormField label="사용 유형">
              <select
                value={profileInput.personaType}
                onChange={(event) =>
                  setProfileInput({ ...profileInput, personaType: event.target.value as ProfileInput["personaType"] })
                }
              >
                <option value="custom">일반 사용자</option>
                <option value="university_student">대학생</option>
                <option value="older_adult">쉬운 설명 필요</option>
              </select>
            </FormField>
            <FormField label="아이콘">
              <input
                value={profileInput.icon}
                maxLength={4}
                onChange={(event) => setProfileInput({ ...profileInput, icon: event.target.value })}
              />
            </FormField>
            <label className="col-span-2 grid gap-2 text-sm font-black max-sm:col-span-1">
              설명
              <textarea
                className="min-h-20 resize-y border border-line px-3 py-3 font-normal outline-none focus:border-bridge"
                value={profileInput.description}
                onChange={(event) => setProfileInput({ ...profileInput, description: event.target.value })}
              />
            </label>
            <div className="col-span-2 flex justify-end max-sm:col-span-1">
              <button
                className="inline-flex min-h-10 items-center gap-2 bg-bridge px-4 text-sm font-black text-white disabled:opacity-50"
                type="submit"
                disabled={saving}
              >
                {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
                저장
              </button>
            </div>
          </form>
        )}

        {cardFormOpen && (
          <form className="grid grid-cols-2 gap-4 border-b border-line bg-[#f3f8f6] p-5 max-sm:grid-cols-1" onSubmit={saveCard}>
            <div className="col-span-2 flex items-center justify-between max-sm:col-span-1">
              <strong>{editingCardId ? "카드 수정" : "새 카드"}</strong>
              <button
                className="grid h-9 w-9 place-items-center border border-line bg-white"
                type="button"
                aria-label="카드 편집 닫기"
                onClick={() => setCardFormOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <FormField label="카드 이름">
              <input value={cardInput.label} onChange={(event) => setCardInput({ ...cardInput, label: event.target.value })} />
            </FormField>
            <FormField label="분류">
              <select
                value={cardInput.category}
                onChange={(event) => {
                  const category = event.target.value as ContextCategory;
                  setCardInput({ ...cardInput, category, semanticGroup: category });
                }}
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <label className="col-span-2 grid gap-2 text-sm font-black max-sm:col-span-1">
              값
              <textarea
                className="min-h-24 resize-y border border-line px-3 py-3 font-normal outline-none focus:border-bridge"
                value={cardInput.valueText}
                onChange={(event) => setCardInput({ ...cardInput, valueText: event.target.value })}
              />
            </label>
            <FormField label="태그">
              <input
                value={cardInput.tags.join(", ")}
                placeholder="쉼표로 구분"
                onChange={(event) =>
                  setCardInput({
                    ...cardInput,
                    tags: event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
              />
            </FormField>
            <FormField label="민감도">
              <select
                value={cardInput.sensitivity}
                onChange={(event) =>
                  setCardInput({ ...cardInput, sensitivity: event.target.value as PrivacyLevel })
                }
              >
                <option value="normal">일반</option>
                <option value="sensitive">민감</option>
                <option value="confidential">기밀</option>
              </select>
            </FormField>
            <label className="flex min-h-11 items-center gap-2 text-sm font-black">
              <input
                className="h-4 w-4 accent-bridge"
                type="checkbox"
                checked={cardInput.enabled}
                onChange={(event) => setCardInput({ ...cardInput, enabled: event.target.checked })}
              />
              답변 후보로 사용
            </label>
            <div className="flex justify-end">
              <button
                className="inline-flex min-h-10 items-center gap-2 bg-bridge px-4 text-sm font-black text-white disabled:opacity-50"
                type="submit"
                disabled={saving || !cardInput.label.trim() || !cardInput.valueText.trim()}
              >
                {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}
                {editingCardId ? "수정 저장" : "카드 만들기"}
              </button>
            </div>
          </form>
        )}

        <div className="grid gap-5 p-5">
          <div className="flex flex-wrap gap-2">
            <Pill>{profile.personaType}</Pill>
            <Pill>Supabase 저장</Pill>
            <Pill tone="normal">카드 {profile.fields.length}개</Pill>
          </div>

          {profile.fields.length === 0 ? (
            <div className="border border-dashed border-line p-8 text-center text-muted">아직 저장된 컨텍스트 카드가 없습니다.</div>
          ) : (
            Object.entries(grouped).map(([section, fields]) => (
              <div key={section} className="border border-line bg-white">
                <h3 className="border-b border-line bg-[#f8f7f2] px-4 py-3 text-base font-black">{section}</h3>
                {fields.map((field) => {
                  const cardId = field.contextId || field.key;
                  const deleting = deleteTargetId === cardId;

                  return (
                    <div
                      key={field.key}
                      className="grid grid-cols-[150px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 max-sm:grid-cols-1"
                    >
                      <div className="text-sm font-black text-muted">{field.label}</div>
                      <div className="min-w-0">
                        <div className="break-words leading-6">{field.value}</div>
                        {field.tags.length > 0 && (
                          <div className="mt-1 text-xs text-muted">{field.tags.join(" · ")}</div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={field.enabled ? "normal" : "neutral"}>{field.enabled ? "활성" : "비활성"}</Pill>
                        <Pill tone={field.sensitivity === "normal" ? "normal" : "sensitive"}>
                          {privacyLabel(field.sensitivity)}
                        </Pill>
                      </div>
                      <div className="flex justify-end gap-1">
                        {deleting ? (
                          <>
                            <button
                              className="min-h-9 border border-line px-3 text-xs font-black"
                              type="button"
                              onClick={() => setDeleteTargetId(null)}
                            >
                              취소
                            </button>
                            <button
                              className="min-h-9 bg-red-800 px-3 text-xs font-black text-white disabled:opacity-50"
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                void onDeleteCard(cardId).then((deleted) => {
                                  if (deleted) setDeleteTargetId(null);
                                });
                              }}
                            >
                              삭제 확인
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="grid h-9 w-9 place-items-center border border-line bg-white hover:border-bridge"
                              type="button"
                              aria-label={`${field.label} 수정`}
                              title="카드 수정"
                              onClick={() => openEditCard(field)}
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              className="grid h-9 w-9 place-items-center border border-line bg-white text-red-800 hover:border-red-400"
                              type="button"
                              aria-label={`${field.label} 삭제`}
                              title="카드 삭제"
                              onClick={() => setDeleteTargetId(cardId)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-black [&_input]:min-h-11 [&_input]:border [&_input]:border-line [&_input]:px-3 [&_input]:font-normal [&_input]:outline-none [&_input]:focus:border-bridge [&_select]:min-h-11 [&_select]:border [&_select]:border-line [&_select]:bg-white [&_select]:px-3 [&_select]:font-normal">
      {label}
      {children}
    </label>
  );
}

function toProfileInput(profile: UserProfile): ProfileInput {
  const personaType =
    profile.personaType === "university_student" || profile.personaType === "older_adult"
      ? profile.personaType
      : "custom";

  return {
    displayName: profile.name,
    personaType,
    profileName: profile.profileName || "내 프로필",
    icon: profile.icon || "CB",
    description: profile.description || profile.group,
  };
}

function privacyLabel(level: ProfileField["sensitivity"]) {
  if (level === "confidential") return "기밀";
  if (level === "sensitive") return "민감";
  return "일반";
}
