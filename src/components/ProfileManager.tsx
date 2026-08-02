import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Clock3,
  Edit3,
  Eye,
  EyeOff,
  GraduationCap,
  HeartHandshake,
  Lightbulb,
  LoaderCircle,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { ContextCategory, PersonaType, PrivacyLevel } from "../../contracts/types";
import { categoryLabels, personaMeta } from "../data/onboardingSurvey";
import type { ContextCardInput, ProfileInput } from "../services/profileRepository";
import type { ProfileField, UserProfile } from "../types";

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

type FilterMode = "all" | PrivacyLevel;
type GroupKey = "background" | "goals" | "capability" | "resources" | "preferences" | "limits";

const GROUPS: Array<{ key: GroupKey; title: string; description: string; icon: typeof UserRound }> = [
  { key: "background", title: "기본 정보", description: "소속, 활동, 현재 상태", icon: UserRound },
  { key: "goals", title: "목표와 진행 중인 일", description: "앞으로 이루고 싶은 것", icon: Target },
  { key: "capability", title: "능력과 경험", description: "이미 알고 있거나 해 본 것", icon: BrainCircuit },
  { key: "resources", title: "시간과 생활 조건", description: "계획에 반영할 자원과 일정", icon: Clock3 },
  { key: "preferences", title: "취향과 답변 방식", description: "좋아하는 방식과 추천 기준", icon: Lightbulb },
  { key: "limits", title: "꼭 지켜야 할 조건", description: "답변 전에 확인할 제약", icon: ShieldCheck },
];

const PRIVACY_META: Record<PrivacyLevel, { label: string; description: string; className: string }> = {
  normal: { label: "기본 사용", description: "관련 질문이면 자동으로 활용", className: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  sensitive: { label: "매번 확인", description: "사용할 때마다 직접 확인", className: "border-amber-200 bg-amber-50 text-amber-950" },
  confidential: { label: "사용 안 함", description: "AI 답변에서 항상 제외", className: "border-zinc-300 bg-zinc-100 text-zinc-700" },
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

const categoryOptions: Array<[ContextCategory, string]> = [
  ["identity", "나의 배경"], ["current_state", "현재 상황"], ["objective", "목표"],
  ["capability", "능력·경험"], ["project", "진행 중인 일"], ["resource", "시간·예산·수단"],
  ["routine", "일정·습관"], ["preference", "선호·답변 방식"], ["hard_limit", "꼭 지킬 조건"],
  ["soft_limit", "가능하면 고려"], ["relationship", "가족·관계"],
];

type ProfileManagerPropsExtended = ProfileManagerProps & { easy?: boolean };

export function ProfileManager(props: ProfileManagerPropsExtended) {
  const {
    profiles, profileId, saving, error, onProfileChange, onUpdateProfile, onCreateCard,
    onCreateCards, onStructureContext, onUpdateCard, onDeleteCard,
    easy,
  } = props;
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const personaType = normalizePersona(profile.personaType);
  const persona = personaMeta[personaType];
  const PersonaIcon = personaType === "university_student" ? GraduationCap : personaType === "older_adult" ? HeartHandshake : BriefcaseBusiness;

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
  const [filter, setFilter] = useState<FilterMode>("all");
  const [managing, setManaging] = useState(false);

  useEffect(() => {
    setProfileInput(toProfileInput(profile));
    setEditingProfile(false);
    setEditingCardId(null);
    setCardFormOpen(false);
    setFilter("all");
    setManaging(false);
  }, [profile]);

  const counts = useMemo(() => ({
    active: profile.fields.filter((field) => field.enabled && field.sensitivity !== "confidential").length,
    normal: profile.fields.filter((field) => field.sensitivity === "normal").length,
    sensitive: profile.fields.filter((field) => field.sensitivity === "sensitive").length,
    confidential: profile.fields.filter((field) => field.sensitivity === "confidential").length,
  }), [profile.fields]);

  const grouped = useMemo(() => {
    const visible = filter === "all" ? profile.fields : profile.fields.filter((field) => field.sensitivity === filter);
    return visible.reduce<Record<GroupKey, ProfileField[]>>((acc, field) => {
      acc[groupForCategory(field.category || "profile")].push(field);
      return acc;
    }, { background: [], goals: [], capability: [], resources: [], preferences: [], limits: [] });
  }, [filter, profile.fields]);

  const snapshots = useMemo(() => {
    const pick = (key: GroupKey) => profile.fields.find((field) => field.enabled && groupForCategory(field.category || "profile") === key);
    return [
      { label: "현재의 나", field: pick("background"), icon: UserRound },
      { label: "가장 중요한 목표", field: pick("goals"), icon: Target },
      { label: "나의 강점", field: pick("capability"), icon: BrainCircuit },
      { label: "나에게 맞는 방식", field: pick("preferences") ?? pick("resources"), icon: Lightbulb },
    ];
  }, [profile.fields]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await onUpdateProfile(profileInput)) setEditingProfile(false);
  };

  const openCreateCard = () => {
    setCardInput(emptyCard); setEditingCardId(null); setCardFormOpen(true); setEditingProfile(false);
    setDeleteTargetId(null); setNaturalInput(""); setDrafts([]); setInputMode("natural");
    window.setTimeout(() => document.getElementById("profile-card-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const closeCardForm = () => { setCardFormOpen(false); setEditingCardId(null); setDeleteTargetId(null); setDrafts([]); };

  const openEditCard = (field: ProfileField) => {
    const category = field.category || "profile";
    setCardInput({ label: field.label, valueText: field.value, category, semanticGroup: field.semanticGroup || category, tags: field.tags, enabled: field.enabled, sensitivity: field.sensitivity });
    setEditingCardId(field.contextId || field.key); setCardFormOpen(true); setEditingProfile(false); setDeleteTargetId(null); setInputMode("direct");
    window.setTimeout(() => document.getElementById("profile-card-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const structureNaturalInput = async () => {
    if (!naturalInput.trim() || structuring) return;
    setStructuring(true);
    try { setDrafts(await onStructureContext(naturalInput.trim())); } finally { setStructuring(false); }
  };

  const saveStructuredDrafts = async () => { if (drafts.length && await onCreateCards(drafts)) closeCardForm(); };

  const saveCard = async (event: React.FormEvent) => {
    event.preventDefault();
    const saved = editingCardId ? await onUpdateCard(editingCardId, cardInput) : await onCreateCard(cardInput);
    if (saved) closeCardForm();
  };

  const updateField = async (field: ProfileField, change: Partial<Pick<ContextCardInput, "enabled" | "sensitivity">>) => {
    const category = field.category || "profile";
    await onUpdateCard(field.contextId || field.key, {
      label: field.label, valueText: field.value, category, semanticGroup: field.semanticGroup || category,
      tags: field.tags, enabled: change.enabled ?? field.enabled, sensitivity: change.sensitivity ?? field.sensitivity,
    });
  };

  return (
    <section className="mx-auto max-w-7xl pb-14">
      <header className={`flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6 ${easy ? "py-6" : ""}`}>
        <div>
          <div className="text-xs font-black uppercase text-bridge">My profile</div>
          <h2 className={`mt-2 ${easy ? "text-6xl" : "text-4xl"} font-black leading-tight max-sm:text-3xl`}>나를 이해하는 프로필</h2>
          <p className={`mt-2 ${easy ? "text-lg" : "text-sm"} leading-7 text-muted`}>AI가 기억하고 있는 나의 모습입니다.</p>
        </div>
        <button className={`inline-flex ${easy ? "min-h-14 px-6 text-lg" : "min-h-12 px-5 text-sm"} items-center justify-center gap-2 bg-bridge font-black text-white hover:bg-bridge-dark max-sm:w-full`} type="button" onClick={openCreateCard}>
          <Plus size={easy ? 22 : 18} /> 새로운 정보 추가
        </button>
      </header>

      {error && <div className="mt-5 border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900" role="alert">{error}</div>}

      <section className="mt-7 grid border border-line bg-white lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-b border-line p-7 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <span className={`${easy ? "grid h-28 w-28" : "grid h-20 w-20"} place-items-center bg-[#122824] text-[#f8d7ad]`}><PersonaIcon size={easy ? 44 : 32} /></span>
            <button className={`${easy ? "grid h-12 w-12" : "grid h-10 w-10"} place-items-center border border-line hover:border-bridge`} type="button" title="프로필 수정" aria-label="프로필 수정" onClick={() => { setEditingProfile((current) => !current); setCardFormOpen(false); }}>
              {editingProfile ? <X size={easy ? 20 : 17} /> : <Edit3 size={easy ? 20 : 17} />}
            </button>
          </div>
          <h3 className={`mt-5 ${easy ? "text-5xl" : "text-3xl"} font-black`}>{profile.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`border border-[#bed6d0] bg-[#eef8f5] px-2 py-1 ${easy ? "text-sm" : "text-xs"} font-black text-bridge-dark`}>{persona.label}</span>
            <span className={`${easy ? "text-lg" : "text-sm"} font-bold text-muted`}>{profile.profileName}</span>
          </div>
          <p className={`mt-5 ${easy ? "text-lg leading-8" : "text-sm leading-7"} text-muted`}>{profile.description || persona.description}</p>
          {profiles.length > 1 && (
            <label className="relative mt-5 block">
              <span className="sr-only">프로필 선택</span>
              <select className="min-h-11 w-full appearance-none border border-line bg-white px-3 pr-9 text-sm font-bold" value={profileId} onChange={(event) => onProfileChange(event.target.value)}>
                {profiles.map((item) => <option key={item.id} value={item.id}>{item.profileName || item.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3.5" size={16} />
            </label>
          )}
          <div className="mt-6 border-t border-line pt-5">
            <div className="flex items-center justify-between text-sm"><span className="text-muted">나를 알아가는 중</span><strong>{profile.fields.length}개의 이야기</strong></div>
            <div className="mt-3 h-2 bg-[#e9eeeb]"><div className="h-full bg-bridge" style={{ width: `${profile.fields.length ? Math.max(18, counts.active / profile.fields.length * 100) : 0}%` }} /></div>
            <p className="mt-2 text-xs leading-5 text-muted">대화할수록 나에게 더 잘 맞는 답변을 할 수 있어요.</p>
          </div>
        </div>

        <div className="p-7 max-sm:p-5">
          <div>
            <span className="text-xs font-black uppercase text-bridge">At a glance</span>
            <h3 className="mt-2 text-2xl font-black">한눈에 보는 나</h3>
          </div>
          <div className="mt-5 grid gap-px bg-line sm:grid-cols-2">
            {snapshots.map(({ label, field, icon: Icon }) => (
              <article key={label} className={`min-h-36 bg-[#fbfbf8] p-5 ${easy ? "" : ""}`}>
                <div className="flex items-center gap-2 text-bridge"><Icon size={easy ? 20 : 17} /><span className={`${easy ? "text-sm" : "text-xs"} font-black`}>{label}</span></div>
                {field ? (
                  <><strong className={`mt-4 block ${easy ? "text-2xl" : "text-lg"} leading-6`}>{field.label}</strong><p className={`mt-2 line-clamp-2 ${easy ? "text-lg" : "text-sm"} leading-6 text-muted`}>{field.value}</p></>
                ) : (
                  <button className={`mt-4 text-left ${easy ? "text-lg" : "text-sm"} font-bold text-muted underline decoration-line underline-offset-4`} type="button" onClick={openCreateCard}>아직 알려주지 않은 정보예요</button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {editingProfile && (
        <form className="grid grid-cols-2 gap-4 border-x border-b border-line bg-[#f3f7f5] p-5 max-sm:grid-cols-1" onSubmit={saveProfile}>
          <FormField label="불러드릴 이름"><input value={profileInput.displayName} onChange={(event) => setProfileInput({ ...profileInput, displayName: event.target.value })} /></FormField>
          <FormField label="프로필 이름"><input value={profileInput.profileName} onChange={(event) => setProfileInput({ ...profileInput, profileName: event.target.value })} /></FormField>
          <FormField label="사용자 유형"><select value={profileInput.personaType} onChange={(event) => setProfileInput({ ...profileInput, personaType: event.target.value as ProfileInput["personaType"] })}><option value="custom">일반인</option><option value="university_student">대학생</option><option value="older_adult">고령자</option></select></FormField>
          <label className="grid gap-2 text-sm font-black">프로필 설명<textarea className="min-h-12 resize-y border border-line bg-white px-3 py-3 font-normal" value={profileInput.description} onChange={(event) => setProfileInput({ ...profileInput, description: event.target.value })} /></label>
          <div className="col-span-2 flex justify-end max-sm:col-span-1"><button className="inline-flex min-h-11 items-center gap-2 bg-bridge px-5 text-sm font-black text-white disabled:opacity-50" type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />} 저장</button></div>
        </form>
      )}

      {cardFormOpen && (
        <section id="profile-card-editor" className="scroll-mt-5 border-x border-b border-line bg-[#f3f7f5] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><div className="text-xs font-black uppercase text-bridge">{editingCardId ? "Edit context" : "Add context"}</div><h3 className="mt-1 text-2xl font-black">{editingCardId ? "내 정보 수정" : "새로운 나의 정보 추가"}</h3><p className="mt-1 text-sm leading-6 text-muted">저장하기 전에 내용과 AI 사용 기준을 확인해 주세요.</p></div>
            <button className="grid h-10 w-10 place-items-center border border-line bg-white" type="button" aria-label="정보 편집 닫기" onClick={closeCardForm}><X size={17} /></button>
          </div>
          {!editingCardId && <div className="mt-5 inline-grid grid-cols-2 border border-line bg-[#e5ece9] p-1"><button className={`min-h-11 px-5 text-sm font-black ${inputMode === "natural" ? "bg-white text-bridge" : "text-muted"}`} type="button" onClick={() => setInputMode("natural")}>문장으로 입력</button><button className={`min-h-11 px-5 text-sm font-black ${inputMode === "direct" ? "bg-white text-bridge" : "text-muted"}`} type="button" onClick={() => setInputMode("direct")}>직접 입력</button></div>}
          {!editingCardId && inputMode === "natural" ? (
            <div className="mt-5 grid gap-4">
              <textarea className="min-h-32 resize-y border border-line bg-white p-4 leading-7 outline-none focus:border-bridge" value={naturalInput} onChange={(event) => { setNaturalInput(event.target.value); setDrafts([]); }} placeholder="예: 평일 저녁에는 2시간 정도 공부할 수 있고, 실습과 예시 중심 설명을 좋아해요." />
              <div className="flex justify-end"><button className="inline-flex min-h-11 items-center gap-2 bg-bridge px-5 text-sm font-black text-white disabled:opacity-50" type="button" disabled={structuring || !naturalInput.trim()} onClick={() => void structureNaturalInput()}>{structuring ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />}{structuring ? "AI가 정리하고 있어요" : "AI가 정보로 정리"}</button></div>
              {drafts.length > 0 && <div className="grid gap-3 border-t border-line pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><strong>AI가 정리한 정보 {drafts.length}개</strong><button className="min-h-11 bg-accent px-5 text-sm font-black text-[#2b180b] disabled:opacity-50" type="button" disabled={saving} onClick={() => void saveStructuredDrafts()}>확인한 정보 모두 저장</button></div><div className="grid gap-3 lg:grid-cols-2">{drafts.map((draft, index) => <article key={`${draft.label}-${index}`} className="border border-line bg-white p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-black text-bridge">{categoryLabels[draft.category]}</span><strong className="mt-1 block">{draft.label}</strong></div><button className="grid h-8 w-8 place-items-center border border-line text-muted" type="button" aria-label={`${draft.label} 제외`} onClick={() => setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button></div><p className="mt-3 text-sm leading-6">{draft.valueText}</p><label className="mt-3 grid gap-1 text-xs font-black text-muted">AI 사용 기준<select className="min-h-10 border border-line bg-white px-2 text-sm font-normal text-ink" value={draft.sensitivity} onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, sensitivity: event.target.value as PrivacyLevel } : item))}><PrivacyOptions /></select></label></article>)}</div></div>}
            </div>
          ) : (
            <form className="mt-5 grid grid-cols-2 gap-4 max-sm:grid-cols-1" onSubmit={saveCard}>
              <FormField label="정보 영역"><select value={cardInput.category} onChange={(event) => { const category = event.target.value as ContextCategory; setCardInput({ ...cardInput, category, semanticGroup: category }); }}>{!categoryOptions.some(([category]) => category === cardInput.category) && <option value={cardInput.category}>{categoryLabels[cardInput.category]}</option>}{categoryOptions.map(([category, label]) => <option key={category} value={category}>{label}</option>)}</select></FormField>
              <FormField label="짧은 이름"><input value={cardInput.label} placeholder="예: 학습 가능한 시간" onChange={(event) => setCardInput({ ...cardInput, label: event.target.value })} /></FormField>
              <label className="col-span-2 grid gap-2 text-sm font-black max-sm:col-span-1">자세한 내용<textarea className="min-h-28 resize-y border border-line bg-white p-3 font-normal leading-7" value={cardInput.valueText} onChange={(event) => setCardInput({ ...cardInput, valueText: event.target.value })} /></label>
              <FormField label="AI 사용 기준"><select value={cardInput.sensitivity} onChange={(event) => setCardInput({ ...cardInput, sensitivity: event.target.value as PrivacyLevel })}><PrivacyOptions /></select></FormField>
              <div className="flex items-end justify-end"><button className="inline-flex min-h-11 items-center gap-2 bg-bridge px-5 text-sm font-black text-white disabled:opacity-50" type="submit" disabled={saving || !cardInput.label.trim() || !cardInput.valueText.trim()}>{saving ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}{editingCardId ? "수정 저장" : "정보 저장"}</button></div>
            </form>
          )}
        </section>
      )}

      <section className="mt-10">
        <div className={`flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4 ${easy ? "gap-6" : ""}`}>
          <div>
            <span className={`font-black uppercase text-bridge ${easy ? "text-sm" : "text-xs"}`}>My story</span>
            <h3 className={`mt-2 font-black ${easy ? "text-4xl" : "text-2xl"}`}>나의 이야기</h3>
            <p className={`mt-1 ${easy ? "text-lg" : "text-sm"} leading-7 text-muted`}>지금까지 알려준 나의 모습들을 모아봤어요.</p>
          </div>
          <button className={`inline-flex ${easy ? "min-h-12 px-5 text-base" : "min-h-11 px-4 text-sm"} items-center gap-2 border font-black ${managing ? "border-bridge bg-[#eef8f5] text-bridge-dark" : "border-line bg-white"}`} type="button" onClick={() => { setManaging((current) => !current); setFilter("all"); }}>
            {managing ? <X size={easy ? 18 : 16} /> : <Edit3 size={easy ? 18 : 16} />}{managing ? "정리 끝내기" : "정보 정리하기"}
          </button>
        </div>

        {profile.fields.length === 0 ? (
          <div className={`mt-6 border border-dashed border-line bg-white px-6 py-14 text-center ${easy ? "text-lg" : ""}`}><BrainCircuit className="mx-auto text-bridge" size={easy ? 36 : 30} /><strong className={`mt-4 block font-black ${easy ? "text-3xl" : "text-xl"}`}>아직 들려준 이야기가 없어요</strong><p className={`mt-2 ${easy ? "text-lg" : "text-sm"} text-muted`}>나에 대해 하나씩 알려주세요.</p><button className={`mt-5 ${easy ? "min-h-14 px-6 text-base" : "min-h-11 px-5 text-sm"} bg-bridge font-black text-white`} type="button" onClick={openCreateCard}>첫 이야기 들려주기</button></div>
        ) : managing ? (
          <div className="mt-6 grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside>
              <p className="text-sm font-black">어떤 정보를 정리할까요?</p>
              <div className="mt-3 grid border border-line bg-white p-1" role="group" aria-label="정보 사용 기준 필터">
                {([ ["all", "전체", profile.fields.length], ["normal", "바로 사용", counts.normal], ["sensitive", "먼저 물어보기", counts.sensitive], ["confidential", "사용하지 않기", counts.confidential] ] as Array<[FilterMode, string, number]>).map(([value, label, count]) => (
                  <button key={value} className={`flex min-h-11 items-center justify-between px-3 text-sm font-black ${filter === value ? "bg-[#122824] text-white" : "text-muted hover:bg-[#f3f7f5] hover:text-ink"}`} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}><span>{label}</span><span className="opacity-65">{count}</span></button>
                ))}
              </div>
            </aside>
            <div className="grid gap-4">
              {GROUPS.map((group) => {
                const fields = grouped[group.key];
                if (!fields.length) return null;
                const Icon = group.icon;
                return <section key={group.key} className="border border-line bg-white"><div className={`flex items-center gap-3 border-b border-line bg-[#f7f8f5] ${easy ? "px-6 py-5" : "px-5 py-4"}`}><span className={`grid ${easy ? "h-11 w-11" : "h-9 w-9"} place-items-center bg-[#e7f1ee] text-bridge`}><Icon size={easy ? 20 : 17} /></span><div><h4 className={`font-black ${easy ? "text-xl" : ""}`}>{group.title}</h4><p className={`mt-0.5 ${easy ? "text-sm" : "text-xs"} text-muted`}>{group.description}</p></div><span className={`ml-auto ${easy ? "text-sm" : "text-xs"} font-black text-muted`}>{fields.length}개</span></div><div className="divide-y divide-line">{fields.map((field) => <ContextRow key={field.key} field={field} easy={easy} saving={saving} deleting={deleteTargetId === (field.contextId || field.key)} onToggle={() => void updateField(field, { enabled: !field.enabled })} onPrivacyChange={(sensitivity) => void updateField(field, { sensitivity })} onEdit={() => openEditCard(field)} onDeleteRequest={() => setDeleteTargetId(field.contextId || field.key)} onDeleteCancel={() => setDeleteTargetId(null)} onDeleteConfirm={() => void onDeleteCard(field.contextId || field.key).then((deleted) => { if (deleted) setDeleteTargetId(null); })} />)}</div></section>;
              })}
              {Object.values(grouped).every((fields) => fields.length === 0) && <div className="border border-dashed border-line bg-white p-10 text-center text-sm text-muted">여기에 해당하는 정보가 없어요.</div>}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {GROUPS.map((group) => {
              const fields = profile.fields.filter((field) => field.enabled && field.sensitivity !== "confidential" && groupForCategory(field.category || "profile") === group.key);
              if (!fields.length) return null;
              const Icon = group.icon;
              return <section key={group.key} className={`border-t-2 border-[#183c36] bg-white ${easy ? "px-6 py-6" : "px-5 py-5"}`}><div className="flex items-center gap-3"><span className={`grid ${easy ? "h-11 w-11" : "h-10 w-10"} place-items-center bg-[#e7f1ee] text-bridge`}><Icon size={easy ? 20 : 18} /></span><div><h4 className={`font-black ${easy ? "text-xl" : "text-lg"}`}>{group.title}</h4><p className={`mt-1 ${easy ? "text-sm" : "text-xs"} text-muted`}>{group.description}</p></div></div><div className="mt-5 grid gap-5">{fields.map((field) => <div key={field.key}><span className={`font-black ${easy ? "text-base" : "text-xs"} text-bridge`}>{field.label}</span><p className={`mt-1.5 ${easy ? "text-lg leading-8" : "text-sm leading-7"} text-ink`}>{field.value}</p></div>)}</div></section>;
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function ContextRow({ field, easy, saving, deleting, onToggle, onPrivacyChange, onEdit, onDeleteRequest, onDeleteCancel, onDeleteConfirm }: { field: ProfileField; easy?: boolean; saving: boolean; deleting: boolean; onToggle: () => void; onPrivacyChange: (level: PrivacyLevel) => void; onEdit: () => void; onDeleteRequest: () => void; onDeleteCancel: () => void; onDeleteConfirm: () => void }) {
  const privacy = PRIVACY_META[field.sensitivity];
  return (
    <article className={`grid gap-4 ${easy ? "px-6 py-6" : "px-5 py-5"} md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${field.enabled ? "" : "bg-zinc-50 text-muted"}`}>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className={`font-black ${easy ? "text-lg" : "text-base"}`}>{field.label}</strong><span className={`font-bold ${easy ? "text-sm" : "text-xs"} text-bridge`}>{categoryLabels[field.category || "profile"]}</span></div><p className={`mt-1.5 break-words ${easy ? "text-lg leading-8" : "text-sm leading-6"} text-muted`}>{field.value}</p></div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <button className={`inline-flex ${easy ? "min-h-10 px-3 text-sm" : "min-h-9 px-2.5 text-xs"} items-center gap-1.5 border font-black ${field.enabled ? "border-[#a8ccc4] bg-[#eef8f5] text-bridge-dark" : "border-line bg-white text-muted"}`} type="button" role="switch" aria-checked={field.enabled} disabled={saving} onClick={onToggle}>{field.enabled ? <Eye size={easy ? 16 : 14} /> : <EyeOff size={easy ? 16 : 14} />}{field.enabled ? "사용 중" : "꺼짐"}</button>
        <label className="relative"><span className="sr-only">{field.label} AI 사용 기준</span><select className={`min-h-9 appearance-none border py-1 pl-2.5 pr-8 ${easy ? "text-sm" : "text-xs"} font-black ${privacy.className}`} value={field.sensitivity} disabled={saving} title={privacy.description} onChange={(event) => onPrivacyChange(event.target.value as PrivacyLevel)}><PrivacyOptions /></select><ChevronDown className="pointer-events-none absolute right-2 top-2.5" size={13} /></label>
        {deleting ? <><button className={`min-h-9 ${easy ? "px-4" : "px-3"} border border-line ${easy ? "text-sm" : "text-xs"} font-black`} type="button" onClick={onDeleteCancel}>취소</button><button className={`min-h-9 ${easy ? "px-4" : "px-3"} bg-red-800 ${easy ? "text-sm" : "text-xs"} font-black text-white`} type="button" disabled={saving} onClick={onDeleteConfirm}>삭제</button></> : <><button className={`grid ${easy ? "h-10 w-10" : "h-9 w-9"} place-items-center border border-line hover:border-bridge`} type="button" title="수정" aria-label={`${field.label} 수정`} onClick={onEdit}><Edit3 size={easy ? 16 : 14} /></button><button className={`grid ${easy ? "h-10 w-10" : "h-9 w-9"} place-items-center border border-line text-red-800 hover:border-red-400`} type="button" title="삭제" aria-label={`${field.label} 삭제`} onClick={onDeleteRequest}><Trash2 size={easy ? 16 : 14} /></button></>}
      </div>
    </article>
  );
}

function PrivacyOptions() { return <><option value="normal">기본 사용</option><option value="sensitive">매번 확인</option><option value="confidential">사용 안 함</option></>; }

function FormField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-black [&_input]:min-h-11 [&_input]:border [&_input]:border-line [&_input]:bg-white [&_input]:px-3 [&_input]:font-normal [&_select]:min-h-11 [&_select]:border [&_select]:border-line [&_select]:bg-white [&_select]:px-3 [&_select]:font-normal">{label}{children}</label>; }

function toProfileInput(profile: UserProfile): ProfileInput { return { displayName: profile.name, personaType: normalizePersona(profile.personaType), profileName: profile.profileName || "내 프로필", icon: profile.icon || "CB", description: profile.description || profile.group }; }

function normalizePersona(personaType: string): PersonaType { if (personaType === "university_student" || personaType === "older_adult") return personaType; return "custom"; }

function groupForCategory(category: ContextCategory): GroupKey {
  if (category === "objective" || category === "goal" || category === "project") return "goals";
  if (category === "capability") return "capability";
  if (category === "resource" || category === "routine") return "resources";
  if (category === "preference" || category === "soft_limit") return "preferences";
  if (category === "hard_limit" || category === "constraint" || category === "relationship") return "limits";
  return "background";
}
