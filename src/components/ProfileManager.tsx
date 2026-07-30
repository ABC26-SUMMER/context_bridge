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
  onCreateCards: (inputs: ContextCardInput[]) => Promise<boolean>;
  onStructureContext: (text: string) => Promise<ContextCardInput[]>;
  onUpdateCard: (cardId: string, input: ContextCardInput) => Promise<boolean>;
  onDeleteCard: (cardId: string) => Promise<boolean>;
};

const categoryLabels: Record<ContextCategory, string> = {
  identity: "나의 배경",
  capability: "현재 능력·경험",
  objective: "이루고 싶은 결과",
  preference: "선택·답변 선호",
  hard_limit: "반드시 지켜야 할 조건",
  soft_limit: "가능하면 고려할 조건",
  resource: "사용 가능한 시간·예산·도구",
  routine: "반복 일정·습관",
  relationship: "동행자·관계",
  current_state: "현재 상황",
  project: "진행 중인 일",
  profile: "나의 배경(기존)",
  goal: "이루고 싶은 결과(기존)",
  constraint: "고려 조건(기존)",
};

const emptyCard: ContextCardInput = {
  label: "",
  valueText: "",
  category: "identity",
  semanticGroup: "identity",
  tags: [],
  enabled: true,
  sensitivity: "normal",
};

const simpleCategoryOptions: Array<[ContextCategory, string]> = [
  ["identity", "나의 기본 정보 · 거주 환경"],
  ["preference", "내가 좋아하거나 원하는 것"],
  ["objective", "앞으로 이루고 싶은 목표"],
  ["hard_limit", "꼭 지켜야 하는 조건"],
];

export function ProfileManager({
  profiles,
  profileId,
  saving,
  error,
  onProfileChange,
  onUpdateProfile,
  onCreateCard,
  onCreateCards,
  onStructureContext,
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
  const [naturalInput, setNaturalInput] = useState("");
  const [drafts, setDrafts] = useState<ContextCardInput[]>([]);
  const [structuring, setStructuring] = useState(false);
  const [inputMode, setInputMode] = useState<"natural" | "direct">("natural");

  useEffect(() => {
    setProfileInput(toProfileInput(profile));
    setEditingProfile(false);
    setEditingCardId(null);
    setCardFormOpen(false);
  }, [profile]);

  const grouped = useMemo(
    () =>
      profile.fields.reduce<Record<string, ProfileField[]>>((acc, field) => {
        const section = displayGroupForCategory(field.category || "profile");
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
    setNaturalInput("");
    setDrafts([]);
    setInputMode("natural");
  };

  const openEditCard = (field: ProfileField) => {
    const category = field.category || "profile";
    setCardInput({
      label: field.label,
      valueText: field.value,
      category,
      semanticGroup: field.semanticGroup || category,
      tags: [],
      enabled: field.enabled,
      sensitivity: field.sensitivity,
    });
    setEditingCardId(field.contextId || field.key);
    setCardFormOpen(true);
    setDeleteTargetId(null);
    setInputMode("direct");
  };

  const structureNaturalInput = async () => {
    if (!naturalInput.trim() || structuring) return;
    setStructuring(true);
    try {
      setDrafts(await onStructureContext(naturalInput.trim()));
    } finally {
      setStructuring(false);
    }
  };

  const saveStructuredDrafts = async () => {
    if (!drafts.length) return;
    if (await onCreateCards(drafts)) {
      setCardFormOpen(false);
      setNaturalInput("");
      setDrafts([]);
    }
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

  const toggleCard = async (field: ProfileField) => {
    const category = field.category || "profile";
    await onUpdateCard(field.contextId || field.key, {
      label: field.label,
      valueText: field.value,
      category,
      semanticGroup: field.semanticGroup || category,
      tags: field.tags,
      enabled: !field.enabled,
      sensitivity: field.sensitivity,
    });
  };

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase text-bridge">내 정보</div>
          <h2 className="mt-2 text-4xl font-black leading-tight max-sm:text-2xl">AI가 이해할 나의 정보</h2>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-2 bg-bridge px-4 text-sm font-black text-white"
          type="button"
          onClick={openCreateCard}
        >
          <Plus size={17} />
          내 정보 추가
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
              className="inline-flex min-h-11 items-center gap-2 border border-line bg-white px-3 text-sm font-black text-ink hover:border-bridge"
              type="button"
              aria-label="프로필 수정"
              onClick={() => setEditingProfile((current) => !current)}
            >
              {editingProfile ? <X size={17} /> : <Edit3 size={17} />}
              {editingProfile ? "닫기" : "프로필 수정"}
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
              <strong>{editingCardId ? "정보 수정" : "새 정보 입력"}</strong>
              <button
                className="grid h-9 w-9 place-items-center border border-line bg-white"
                type="button"
                aria-label="카드 편집 닫기"
                onClick={() => setCardFormOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            {!editingCardId && (
              <div className="col-span-2 grid grid-cols-2 rounded-[8px] border border-line bg-[#e9efec] p-1 max-sm:col-span-1">
                <button
                  className={`min-h-11 rounded-[6px] px-3 text-sm font-black ${inputMode === "natural" ? "bg-white text-bridge shadow-sm" : "text-muted"}`}
                  type="button"
                  onClick={() => setInputMode("natural")}
                >
                  문장으로 편하게 입력
                </button>
                <button
                  className={`min-h-11 rounded-[6px] px-3 text-sm font-black ${inputMode === "direct" ? "bg-white text-bridge shadow-sm" : "text-muted"}`}
                  type="button"
                  onClick={() => setInputMode("direct")}
                >
                  직접 입력
                </button>
              </div>
            )}
            {!editingCardId && inputMode === "natural" && (
              <div className="col-span-2 grid gap-3 border border-[#bdd7cf] bg-white p-4 max-sm:col-span-1">
                <div>
                  <strong className="block">자연어로 한 번에 입력</strong>
                  <span className="mt-1 block text-sm leading-6 text-muted">
                    예: 저는 수원에 살고 집 근처에 버스 정류장과 공원이 있어요. 평일에는 하루 1시간 공부할 수 있고 목표는 클라우드 엔지니어예요.
                  </span>
                </div>
                <textarea
                  className="min-h-28 resize-y border border-line px-3 py-3 outline-none focus:border-bridge"
                  value={naturalInput}
                  onChange={(event) => { setNaturalInput(event.target.value); setDrafts([]); }}
                  placeholder="거주 지역, 주변 환경, 나의 상황, 목표, 가능한 시간, 선호 등을 편하게 적어 주세요."
                />
                <div className="flex justify-end">
                  <button className="min-h-10 bg-bridge px-4 text-sm font-black text-white disabled:opacity-50" type="button" disabled={structuring || !naturalInput.trim()} onClick={structureNaturalInput}>
                    {structuring ? "AI가 분리·분류 중..." : "AI가 정보로 나누기"}
                  </button>
                </div>
                {drafts.length > 0 && (
                  <div className="grid gap-2">
                    <strong>저장될 정보 {drafts.length}개</strong>
                    {drafts.map((draft, index) => (
                      <div key={`${draft.label}-${index}`} className="border border-line bg-[#f8f7f2] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>{draft.label}</strong>
                          <Pill>{displayGroupForCategory(draft.category)}</Pill>
                        </div>
                        <p className="mt-2 text-sm leading-6">{draft.valueText}</p>
                        {draft.rationale && <p className="mt-1 text-xs text-muted">분류 이유: {draft.rationale}</p>}
                      </div>
                    ))}
                    <button className="mt-2 min-h-11 bg-accent px-4 font-black text-[#2b180b]" type="button" onClick={saveStructuredDrafts}>분류된 정보 모두 저장</button>
                  </div>
                )}
              </div>
            )}
            {(editingCardId || inputMode === "direct") && (
              <>
                <div className="col-span-2 text-sm font-black text-bridge-dark max-sm:col-span-1">필요한 내용 4가지만 입력하세요</div>
                <FormField label="1. 정보 종류">
                  <select
                    value={cardInput.category}
                    onChange={(event) => {
                      const category = event.target.value as ContextCategory;
                      setCardInput({ ...cardInput, category, semanticGroup: category });
                    }}
                  >
                    {editingCardId && !simpleCategoryOptions.some(([value]) => value === cardInput.category) && (
                      <option value={cardInput.category}>{categoryLabels[cardInput.category]}</option>
                    )}
                    {simpleCategoryOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="2. 짧은 이름">
                  <input
                    value={cardInput.label}
                    placeholder={cardInput.category === "identity" ? "예: 거주 환경" : "예: 이동할 때 주의할 점"}
                    onChange={(event) => setCardInput({ ...cardInput, label: event.target.value })}
                  />
                </FormField>
                <label className="col-span-2 grid gap-2 text-sm font-black max-sm:col-span-1">
                  3. 자세한 내용
                  <textarea
                    className="min-h-24 resize-y border border-line px-3 py-3 font-normal outline-none focus:border-bridge"
                    value={cardInput.valueText}
                    placeholder={cardInput.category === "identity" ? "예: 수원에 살고 버스 정류장과 공원이 가까워요." : "예: 오래 걷는 것은 어려워요."}
                    onChange={(event) => setCardInput({ ...cardInput, valueText: event.target.value })}
                  />
                </label>
                <FormField label="4. 보호 방법">
                  <select
                    value={cardInput.sensitivity}
                    onChange={(event) =>
                      setCardInput({ ...cardInput, sensitivity: event.target.value as PrivacyLevel })
                    }
                  >
                    <option value="normal">일반 정보</option>
                    <option value="sensitive">사용할 때마다 내가 확인</option>
                    <option value="confidential">AI 답변에 절대 사용하지 않음</option>
                  </select>
                </FormField>
                <div className="flex justify-end">
                  <button
                    className="inline-flex min-h-11 items-center gap-2 bg-bridge px-5 text-sm font-black text-white disabled:opacity-50"
                    type="submit"
                    disabled={saving || !cardInput.label.trim() || !cardInput.valueText.trim()}
                  >
                    {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}
                    {editingCardId ? "수정 저장" : "정보 저장"}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        <div className="grid gap-5 p-5">
          <div className="flex flex-wrap gap-2">
            <Pill tone="normal">사용 중 {profile.fields.filter((field) => field.enabled).length}개</Pill>
            <Pill>전체 {profile.fields.length}개</Pill>
            <span className="self-center text-sm text-muted">사용 중인 정보만 질문에 맞춰 추천됩니다.</span>
          </div>

          {profile.fields.length === 0 ? (
            <div className="border border-dashed border-line p-8 text-center text-muted">아직 저장된 정보가 없습니다. 자연어로 나의 상황·목표·선호를 추가해 보세요.</div>
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
                      className={`grid grid-cols-[150px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 max-sm:grid-cols-1 ${field.enabled ? "" : "bg-zinc-50 text-muted"}`}
                    >
                      <div className="text-sm font-black text-muted">{field.label}</div>
                      <div className="min-w-0">
                        <div className="break-words leading-6">{field.value}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-black transition disabled:opacity-50 ${
                            field.enabled
                              ? "border-[#8bbab0] bg-[#eef8f5] text-bridge-dark"
                              : "border-line bg-white text-muted"
                          }`}
                          type="button"
                          role="switch"
                          aria-checked={field.enabled}
                          aria-label={`${field.label} ${field.enabled ? "사용 중, 눌러서 끄기" : "사용 안 함, 눌러서 켜기"}`}
                          disabled={saving}
                          onClick={() => void toggleCard(field)}
                        >
                          <span className={`relative h-5 w-9 rounded-full ${field.enabled ? "bg-bridge" : "bg-zinc-300"}`}>
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${field.enabled ? "left-[18px]" : "left-0.5"}`} />
                          </span>
                          {field.enabled ? "사용 중" : "사용 안 함"}
                        </button>
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
                              className="inline-flex min-h-10 items-center gap-1.5 border border-line bg-white px-3 text-xs font-black hover:border-bridge"
                              type="button"
                              aria-label={`${field.label} 수정`}
                              onClick={() => openEditCard(field)}
                            >
                              <Edit3 size={15} />
                              수정
                            </button>
                            <button
                              className="inline-flex min-h-10 items-center gap-1.5 border border-line bg-white px-3 text-xs font-black text-red-800 hover:border-red-400"
                              type="button"
                              aria-label={`${field.label} 삭제`}
                              onClick={() => setDeleteTargetId(cardId)}
                            >
                              <Trash2 size={15} />
                              삭제
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

function displayGroupForCategory(category: ContextCategory): string {
  if (category === "preference" || category === "soft_limit") return "내가 좋아하거나 원하는 것";
  if (category === "objective" || category === "goal") return "앞으로 이루고 싶은 목표";
  if (category === "hard_limit" || category === "constraint") return "꼭 지켜야 하는 조건";
  return "나의 기본 정보";
}
