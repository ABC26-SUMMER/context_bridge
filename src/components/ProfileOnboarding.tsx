import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  GraduationCap,
  HeartHandshake,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import type { PersonaType, PrivacyLevel } from "../../contracts/types";
import {
  applySurveyPrivacy,
  buildSurveyNarrative,
  categoryLabels,
  hasRequiredSurveyAnswers,
  initialPrivacyAnswers,
  initialSurveyAnswers,
  personaMeta,
  privacyChoiceMeta,
  surveyDefinitions,
  type PrivacyAnswers,
  type PrivacyChoice,
  type SurveyAnswer,
  type SurveyAnswers,
  type SurveyField,
} from "../data/onboardingSurvey";
import type { ContextCardInput, ProfileInput } from "../services/profileRepository";

type OnboardingCandidate = ContextCardInput & { selected: boolean };

type ProfileOnboardingProps = {
  email: string;
  loading: boolean;
  error?: string;
  onCreate: (input: ProfileInput, cards: ContextCardInput[]) => Promise<boolean>;
  onStructure: (text: string) => Promise<ContextCardInput[]>;
  onLogout: () => void;
};

const PERSONA_ICONS = {
  custom: BriefcaseBusiness,
  university_student: GraduationCap,
  older_adult: HeartHandshake,
} satisfies Record<PersonaType, typeof BriefcaseBusiness>;

const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  normal: "기본 사용",
  sensitive: "매번 확인",
  confidential: "사용 안 함",
};

export function ProfileOnboarding({
  email,
  loading,
  error,
  onCreate,
  onStructure,
  onLogout,
}: ProfileOnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [input, setInput] = useState<ProfileInput>({
    displayName: "",
    personaType: "custom",
    profileName: personaMeta.custom.profileName,
    icon: personaMeta.custom.icon,
    description: "",
  });
  const [answers, setAnswers] = useState<SurveyAnswers>(() => initialSurveyAnswers("custom"));
  const [privacy, setPrivacy] = useState<PrivacyAnswers>(() => initialPrivacyAnswers("custom"));
  const [candidates, setCandidates] = useState<OnboardingCandidate[]>([]);
  const [structuring, setStructuring] = useState(false);
  const [localError, setLocalError] = useState("");

  const definition = surveyDefinitions[input.personaType];
  const easy = input.personaType === "older_adult";
  const selectedCount = candidates.filter((candidate) => candidate.selected).length;
  const canContinueProfile = Boolean(input.displayName.trim() && input.profileName.trim());
  const canContinueSurvey = hasRequiredSurveyAnswers(input.personaType, answers);

  const answeredCount = useMemo(
    () => definition.fields.filter((field) => {
      const value = answers[field.id];
      return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
    }).length,
    [answers, definition.fields],
  );

  const choosePersona = (personaType: PersonaType) => {
    const meta = personaMeta[personaType];
    setInput((current) => ({
      ...current,
      personaType,
      profileName: meta.profileName,
      icon: meta.icon,
      description: `${meta.label} 맞춤 프로필`,
    }));
    setAnswers(initialSurveyAnswers(personaType));
    setPrivacy(initialPrivacyAnswers(personaType));
    setCandidates([]);
    setLocalError("");
  };

  const updateAnswer = (field: SurveyField, value: string) => {
    setAnswers((current) => {
      if (field.type !== "multi") return { ...current, [field.id]: value };
      const selected = Array.isArray(current[field.id]) ? current[field.id] as string[] : [];
      return {
        ...current,
        [field.id]: selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value],
      };
    });
  };

  const makeCandidates = async () => {
    if (!canContinueSurvey) {
      setLocalError("필수 질문에 답해 주세요.");
      return;
    }
    setStructuring(true);
    setLocalError("");
    try {
      const structured = await onStructure(buildSurveyNarrative(input.personaType, answers));
      const privacyApplied = applySurveyPrivacy(
        input.personaType,
        structured.map((draft) => ({
          title: draft.label,
          category: draft.category,
          content: draft.valueText,
          privacyLevel: draft.sensitivity,
          rationale: draft.rationale || "설문 답변을 바탕으로 정리했습니다.",
        })),
        privacy,
      );
      setCandidates(privacyApplied.map((draft) => ({
        label: draft.title,
        valueText: draft.content,
        category: draft.category,
        semanticGroup: draft.category,
        tags: [],
        enabled: true,
        sensitivity: draft.privacyLevel,
        rationale: draft.rationale,
        selected: true,
      })));
      setStep(3);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "설문 답변을 정리하지 못했습니다.");
    } finally {
      setStructuring(false);
    }
  };

  const finish = async () => {
    const cards = candidates
      .filter((candidate) => candidate.selected && candidate.label.trim() && candidate.valueText.trim())
      .map(({ selected: _selected, ...candidate }) => candidate);
    if (!cards.length) {
      setLocalError("저장할 정보 카드를 한 개 이상 선택해 주세요.");
      return;
    }
    setLocalError("");
    await onCreate(input, cards);
  };

  const goBack = () => {
    setLocalError("");
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
    else onLogout();
  };

  const backLabel = step === 3 ? "맞춤 설문" : step === 2 ? "기본 정보" : "로그인";

  return (
    <main className={`min-h-screen bg-[#f8f7f2] px-5 py-8 text-ink ${easy ? "text-lg" : ""}`}>
      <div className="mx-auto max-w-6xl">
        <header className="sticky top-0 z-30 -mx-2 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-[#f8f7f2]/95 px-2 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex min-h-11 items-center gap-2 border border-line bg-white px-3 text-sm font-black text-ink transition hover:border-bridge hover:text-bridge"
              type="button"
              aria-label={`${backLabel} 단계로 돌아가기`}
              onClick={goBack}
            >
              <ArrowLeft size={17} />
              <span>{backLabel}</span>
            </button>
            <div className="grid h-11 w-11 place-items-center bg-[#122824] font-black text-[#f8d7ad]">CB</div>
            <div className="max-sm:hidden">
              <strong className="block text-sm text-bridge">Context Bridge</strong>
              <span className="text-sm text-muted">나를 이해하는 첫 설정</span>
            </div>
          </div>
          <div className="flex items-center gap-2" aria-label="프로필 생성 진행 단계">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center border text-sm font-black ${step >= item ? "border-bridge bg-bridge text-white" : "border-line bg-white text-muted"}`}>
                  {step > item ? <Check size={15} /> : item}
                </span>
                <span className={`hidden text-sm font-bold sm:block ${step === item ? "text-ink" : "text-muted"}`}>
                  {item === 1 ? "기본 정보" : item === 2 ? "맞춤 설문" : "카드 확인"}
                </span>
                {item < 3 && <span className="mx-1 h-px w-5 bg-line" />}
              </div>
            ))}
          </div>
        </header>

        {step === 1 && (
          <section className="grid gap-10 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:py-16">
            <div className="max-w-md">
              <div className="grid h-14 w-14 place-items-center bg-[#122824] text-[#f8d7ad]">
                <UserRoundPlus size={24} />
              </div>
              <div className="mt-6 text-xs font-black uppercase text-bridge">First profile</div>
              <h1 className="mt-2 text-5xl font-black leading-[1.12] max-sm:text-4xl">첫 프로필을<br />함께 만들어요</h1>
              <p className="mt-5 text-base leading-8 text-muted">
                나를 한 번에 설명하기 어려워도 괜찮아요. 나에게 맞는 질문에 답하면 AI가 사용할 정보 카드로 정리해 드려요.
              </p>
              <div className="mt-8 border-l-4 border-accent pl-4 text-sm leading-7 text-muted">
                설문 답변은 바로 저장되지 않아요.<br />마지막 단계에서 직접 확인한 정보만 저장됩니다.
              </div>
            </div>

            <div className="border border-line bg-white p-6 shadow-[0_18px_50px_rgba(18,40,36,0.06)] max-sm:p-4">
              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <FormField label="불러드릴 이름" required>
                  <input
                    autoFocus
                    value={input.displayName}
                    placeholder="이름 또는 닉네임"
                    onChange={(event) => setInput({ ...input, displayName: event.target.value })}
                  />
                </FormField>
                <FormField label="프로필 이름" required>
                  <input
                    value={input.profileName}
                    onChange={(event) => setInput({ ...input, profileName: event.target.value })}
                  />
                </FormField>
              </div>

              <fieldset className="mt-7">
                <legend className="text-base font-black">나는 어디에 가까운가요?</legend>
                <p className="mt-1 text-sm leading-6 text-muted">선택한 유형에 맞는 질문을 준비할게요.</p>
                <div className="mt-4 grid grid-cols-3 gap-3 max-md:grid-cols-1">
                  {(Object.keys(personaMeta) as PersonaType[]).map((personaType) => {
                    const meta = personaMeta[personaType];
                    const Icon = PERSONA_ICONS[personaType];
                    const active = input.personaType === personaType;
                    return (
                      <button
                        key={personaType}
                        className={`min-h-44 border p-4 text-left transition ${active ? "border-bridge bg-[#eef8f5] shadow-[inset_0_0_0_1px_#116a67]" : "border-line bg-white hover:border-bridge"}`}
                        type="button"
                        aria-pressed={active}
                        onClick={() => choosePersona(personaType)}
                      >
                        <span className={`grid h-10 w-10 place-items-center ${active ? "bg-bridge text-white" : "bg-[#eef0ec] text-ink"}`}>
                          <Icon size={20} />
                        </span>
                        <strong className="mt-4 block text-lg">{meta.label}</strong>
                        <span className="mt-2 block text-sm leading-6 text-muted">{meta.description}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <span className="text-sm text-muted">{email}</span>
                <div className="flex flex-wrap gap-2">
                  <button className="min-h-12 border border-line bg-white px-4 text-sm font-black" type="button" onClick={onLogout}>
                    다른 계정
                  </button>
                  <button
                    className="inline-flex min-h-12 items-center gap-2 bg-bridge px-5 text-sm font-black text-white disabled:opacity-45"
                    type="button"
                    disabled={!canContinueProfile}
                    onClick={() => { setLocalError(""); setStep(2); }}
                  >
                    맞춤 설문 시작 <ArrowRight size={17} />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="py-10">
            <div className="grid items-end gap-6 border-b border-line pb-7 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="text-xs font-black uppercase text-bridge">{personaMeta[input.personaType].label} 맞춤 설문</div>
                <h1 className={`${easy ? "text-4xl" : "text-4xl"} mt-2 font-black leading-tight max-sm:text-3xl`}>{definition.title}</h1>
                <p className="mt-3 max-w-3xl leading-7 text-muted">{definition.intro}</p>
              </div>
              <div className="border border-line bg-white px-4 py-3 text-sm text-muted">
                <strong className="text-ink">{answeredCount}</strong> / {definition.fields.length}개 답변
              </div>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {definition.fields.map((field, index) => (
                <SurveyQuestion
                  key={field.id}
                  index={index + 1}
                  field={field}
                  value={answers[field.id]}
                  easy={easy}
                  onChange={(value) => updateAnswer(field, value)}
                />
              ))}
            </div>

            <section className="mt-8 border border-[#bfd4cf] bg-[#f1f7f5] p-6 max-sm:p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center bg-bridge text-white"><ShieldCheck size={20} /></span>
                <div>
                  <h2 className="text-xl font-black">내 정보는 어떻게 사용할까요?</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">정보 종류마다 기본 기준을 정해요. AI가 정리한 뒤 카드별로 다시 바꿀 수 있어요.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {definition.privacyDomains.map((domain) => (
                  <div key={domain.id} className="grid items-center gap-4 border border-[#d6e3df] bg-white p-4 lg:grid-cols-[minmax(180px,1fr)_2fr]">
                    <div>
                      <strong className="block">{domain.label}</strong>
                      <span className="mt-1 block text-sm text-muted">{domain.helper}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label={`${domain.label} 활용 기준`}>
                      {(Object.keys(privacyChoiceMeta) as PrivacyChoice[]).map((choice) => {
                        const active = privacy[domain.id] === choice;
                        return (
                          <button
                            key={choice}
                            className={`${easy ? "min-h-16" : "min-h-12"} border px-2 text-sm font-black transition ${active ? "border-bridge bg-bridge text-white" : "border-line bg-white text-muted hover:border-bridge"}`}
                            type="button"
                            aria-pressed={active}
                            title={privacyChoiceMeta[choice].description}
                            onClick={() => setPrivacy((current) => ({ ...current, [domain.id]: choice }))}
                          >
                            {privacyChoiceMeta[choice].label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {(localError || error) && <ErrorNotice message={localError || error || ""} />}

            <div className="mt-7 flex flex-wrap justify-between gap-3">
              <button className="inline-flex min-h-12 items-center gap-2 border border-line bg-white px-5 font-black" type="button" onClick={() => setStep(1)}>
                <ArrowLeft size={17} /> 이전
              </button>
              <button
                className={`${easy ? "min-h-16 text-lg" : "min-h-12"} inline-flex items-center gap-2 bg-bridge px-6 font-black text-white disabled:opacity-45`}
                type="button"
                disabled={!canContinueSurvey || structuring}
                onClick={() => void makeCandidates()}
              >
                {structuring ? <LoaderCircle className="animate-spin" size={19} /> : <Sparkles size={19} />}
                {structuring ? "내 정보를 정리하고 있어요" : "AI가 내 정보 정리하기"}
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="py-10">
            <div className="grid gap-6 border-b border-line pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="text-xs font-black uppercase text-bridge">Final check</div>
                <h1 className="mt-2 text-4xl font-black leading-tight max-sm:text-3xl">AI가 정리한 내 정보를 확인해 주세요</h1>
                <p className="mt-3 max-w-3xl leading-7 text-muted">체크된 카드만 저장됩니다. 내용과 사용 기준을 직접 고치거나, 원하지 않는 카드는 제외할 수 있어요.</p>
              </div>
              <div className="bg-[#122824] px-5 py-4 text-white">
                <strong className="text-2xl">{selectedCount}</strong>
                <span className="ml-2 text-sm text-white/70">개 저장 예정</span>
              </div>
            </div>

            <div className="mt-7 grid gap-4">
              {candidates.map((candidate, index) => (
                <article key={`${candidate.label}-${index}`} className={`grid gap-4 border p-5 transition lg:grid-cols-[32px_1fr_220px] ${candidate.selected ? "border-line bg-white" : "border-line bg-[#efefeb] opacity-65"}`}>
                  <label className="pt-1" title={candidate.selected ? "저장함" : "저장하지 않음"}>
                    <input
                      className="h-6 w-6 accent-bridge"
                      type="checkbox"
                      checked={candidate.selected}
                      aria-label={`${candidate.label} 저장 여부`}
                      onChange={(event) => setCandidates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, selected: event.target.checked } : item))}
                    />
                  </label>
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-[#eef8f5] px-2 py-1 text-xs font-black text-bridge">{categoryLabels[candidate.category]}</span>
                      <input
                        className="min-w-0 flex-1 border-0 border-b border-line bg-transparent px-1 py-2 text-base font-black outline-none focus:border-bridge"
                        value={candidate.label}
                        disabled={!candidate.selected}
                        aria-label="정보 카드 제목"
                        onChange={(event) => setCandidates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))}
                      />
                    </div>
                    <textarea
                      className="min-h-20 resize-y border border-line bg-white p-3 text-sm leading-6 outline-none focus:border-bridge disabled:bg-[#f4f4f1]"
                      value={candidate.valueText}
                      disabled={!candidate.selected}
                      aria-label={`${candidate.label} 내용`}
                      onChange={(event) => setCandidates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, valueText: event.target.value } : item))}
                    />
                    {candidate.rationale && <p className="text-xs leading-5 text-muted">{candidate.rationale}</p>}
                  </div>
                  <label className="grid content-start gap-2 text-sm font-black">
                    AI 사용 기준
                    <select
                      className="min-h-12 border border-line bg-white px-3 font-normal outline-none focus:border-bridge"
                      value={candidate.sensitivity}
                      disabled={!candidate.selected}
                      onChange={(event) => setCandidates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, sensitivity: event.target.value as PrivacyLevel } : item))}
                    >
                      {(Object.keys(PRIVACY_LABELS) as PrivacyLevel[]).map((level) => <option key={level} value={level}>{PRIVACY_LABELS[level]}</option>)}
                    </select>
                    <span className="font-normal leading-5 text-muted">
                      {candidate.sensitivity === "normal" ? "관련 질문에 기본 선택됩니다." : candidate.sensitivity === "sensitive" ? "사용할 때마다 직접 확인합니다." : "AI 답변에 사용하지 않습니다."}
                    </span>
                  </label>
                </article>
              ))}
            </div>

            {(localError || error) && <ErrorNotice message={localError || error || ""} />}

            <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-line pt-6">
              <button className="inline-flex min-h-12 items-center gap-2 border border-line bg-white px-5 font-black" type="button" onClick={() => setStep(2)}>
                <ArrowLeft size={17} /> 설문 수정
              </button>
              <button
                className={`${easy ? "min-h-16 text-lg" : "min-h-12"} inline-flex items-center gap-2 bg-bridge px-7 font-black text-white disabled:opacity-45`}
                type="button"
                disabled={loading || selectedCount === 0}
                onClick={() => void finish()}
              >
                {loading ? <LoaderCircle className="animate-spin" size={19} /> : <Check size={19} />}
                {loading ? "프로필을 저장하고 있어요" : "확인한 정보로 시작하기"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function SurveyQuestion({
  index,
  field,
  value,
  easy,
  onChange,
}: {
  index: number;
  field: SurveyField;
  value: SurveyAnswer;
  easy: boolean;
  onChange: (value: string) => void;
}) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <fieldset className={`border border-line bg-white p-5 ${field.type === "text" ? "content-start" : ""}`}>
      <legend className="sr-only">{field.label}</legend>
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center bg-[#eef0ec] text-sm font-black text-bridge">{index}</span>
        <div>
          <h2 className={`${easy ? "text-xl" : "text-base"} font-black leading-7`}>{field.label}{field.required && <span className="ml-1 text-accent">*</span>}</h2>
          {field.helper && <p className="mt-1 text-sm leading-6 text-muted">{field.helper}</p>}
        </div>
      </div>

      {field.type === "text" ? (
        <textarea
          className={`${easy ? "min-h-28 text-lg" : "min-h-24 text-sm"} mt-4 w-full resize-y border border-line p-3 leading-7 outline-none focus:border-bridge focus:ring-4 focus:ring-bridge/10`}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {field.options?.map((option) => {
            const active = field.type === "multi" ? selected.includes(option) : value === option;
            return (
              <button
                key={option}
                className={`${easy ? "min-h-14 px-5 text-base" : "min-h-11 px-4 text-sm"} border font-bold transition ${active ? "border-bridge bg-[#e8f5f1] text-bridge-dark shadow-[inset_0_0_0_1px_#116a67]" : "border-line bg-white text-muted hover:border-bridge hover:text-ink"}`}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(option)}
              >
                {active && <Check className="mr-1 inline" size={15} />}{option}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-black [&_input]:min-h-12 [&_input]:border [&_input]:border-line [&_input]:px-3 [&_input]:font-normal [&_input]:outline-none [&_input]:focus:border-bridge [&_input]:focus:ring-4 [&_input]:focus:ring-bridge/10">
      <span>{label}{required && <span className="ml-1 text-accent">*</span>}</span>
      {children}
    </label>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <div className="mt-5 border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900" role="alert">{message}</div>;
}
