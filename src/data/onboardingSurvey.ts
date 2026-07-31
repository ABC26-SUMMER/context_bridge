import type { ContextCategory, PersonaType, PrivacyLevel, StructuredContextDraft } from "../../contracts/types";

export type SurveyAnswer = string | string[];
export type SurveyAnswers = Record<string, SurveyAnswer>;
export type PrivacyChoice = "allow" | "ask" | "never";
export type PrivacyAnswers = Record<string, PrivacyChoice>;

const EXCLUSIVE_SURVEY_CHOICES = ["답하지 않음", "특별한 조건 없음", "특별한 주의 없음", "아직 없음", "아직 미정"];

export type SurveyField = {
  id: string;
  label: string;
  helper?: string;
  type: "text" | "single" | "multi";
  options?: string[];
  placeholder?: string;
  required?: boolean;
  defaultValue?: SurveyAnswer;
  cardTitle: string;
  category: ContextCategory;
};

export type PrivacyDomain = {
  id: string;
  label: string;
  helper: string;
  keywords: string[];
  defaultValue: PrivacyChoice;
};

export type SurveyDefinition = {
  title: string;
  intro: string;
  fields: SurveyField[];
  privacyDomains: PrivacyDomain[];
};

export const personaMeta: Record<PersonaType, {
  label: string;
  description: string;
  icon: string;
  profileName: string;
}> = {
  custom: {
    label: "일반인",
    description: "일상, 업무, 여행, 소비와 취미를 폭넓게 도와드려요.",
    icon: "나",
    profileName: "생활 프로필",
  },
  university_student: {
    label: "대학생",
    description: "학업, 자격증, 프로젝트와 진로 준비에 맞춰 질문해요.",
    icon: "학",
    profileName: "대학생 프로필",
  },
  older_adult: {
    label: "고령자",
    description: "큰 글씨와 쉬운 표현으로 생활에 필요한 내용만 여쭤봐요.",
    icon: "편",
    profileName: "쉬운 생활 프로필",
  },
};

export const surveyDefinitions: Record<PersonaType, SurveyDefinition> = {
  custom: {
    title: "평소 생활과 원하는 도움을 알려주세요",
    intro: "생각나는 문장을 길게 쓰지 않아도 괜찮아요. 나와 가까운 항목을 여러 개 골라 주세요.",
    fields: [
      {
        id: "purposes",
        label: "AI에게 주로 어떤 도움을 받고 싶나요?",
        helper: "여러 개 선택할 수 있어요.",
        type: "multi",
        options: ["일정 관리", "업무", "문서 작성", "여행", "운동", "생활 정보", "소비 계획", "육아", "취미"],
        required: true,
        cardTitle: "AI 사용 목적",
        category: "objective",
      },
      {
        id: "ageGroup",
        label: "연령대",
        type: "single",
        options: ["10대", "20대", "30대", "40대", "50대", "60대 이상", "답하지 않음"],
        cardTitle: "연령대",
        category: "identity",
      },
      {
        id: "activity",
        label: "요즘 주로 어떤 생활을 하고 있나요?",
        helper: "여러 가지를 함께 하고 있다면 모두 골라도 돼요.",
        type: "multi",
        options: ["직장 생활", "자영업", "프리랜서", "구직·이직 준비", "가사·육아", "공부", "은퇴 후 생활", "여러 일을 병행", "답하지 않음"],
        cardTitle: "현재 활동",
        category: "identity",
      },
      {
        id: "region",
        label: "집을 기준으로 주로 생활하는 지역",
        helper: "정확한 주소는 필요 없어요. 시·군·구 정도면 충분해요.",
        type: "text",
        placeholder: "예: 수원시 영통구",
        required: true,
        cardTitle: "거주 지역",
        category: "identity",
      },
      {
        id: "goal",
        label: "요즘 중요하게 생각하는 목표는 무엇인가요?",
        helper: "지금 관심이 가는 것을 모두 골라 주세요.",
        type: "multi",
        options: ["건강·운동", "일·커리어", "돈·소비 관리", "가족·육아", "공부·자기계발", "인간관계", "취미·여가", "여행", "생활 안정"],
        cardTitle: "현재 목표",
        category: "objective",
      },
      {
        id: "transport",
        label: "주로 이용하는 이동수단",
        helper: "자주 이용하는 수단을 모두 골라 주세요.",
        type: "multi",
        options: ["도보", "버스", "지하철", "자가용", "택시", "자전거"],
        cardTitle: "이동수단",
        category: "resource",
      },
      {
        id: "availableTime",
        label: "계획에 활용할 수 있는 시간",
        helper: "활용하기 좋은 시간을 모두 골라 주세요.",
        type: "multi",
        options: ["평일 아침", "평일 낮", "평일 저녁", "주말", "하루 1시간 이내", "일정하지 않음"],
        cardTitle: "사용 가능 시간",
        category: "resource",
      },
      {
        id: "recommendationStyle",
        label: "추천을 받을 때 무엇이 중요한가요?",
        helper: "추천을 고를 때 중요하게 보는 기준을 모두 골라 주세요.",
        type: "multi",
        options: ["가성비", "편리함", "검증된 선택", "새로운 경험", "여러 선택지 비교"],
        defaultValue: ["여러 선택지 비교"],
        cardTitle: "추천 기준",
        category: "preference",
      },
      {
        id: "answerStyle",
        label: "어떤 답변이 읽기 편한가요?",
        type: "multi",
        options: ["핵심만 짧게", "먼저 요약하고 자세히", "단계별 설명", "표로 비교", "추천 순위 제시", "전문용어를 쉽게 풀기"],
        required: true,
        defaultValue: ["먼저 요약하고 자세히", "표로 비교"],
        cardTitle: "답변 방식",
        category: "preference",
      },
      {
        id: "constraints",
        label: "답변에서 꼭 고려해야 할 생활 조건이 있나요?",
        helper: "해당하는 조건을 모두 골라 주세요.",
        type: "multi",
        options: ["예산 제한", "이동 거리", "아이 동반", "반려동물 동반", "건강·음식 주의", "시간 제한", "접근성 중요", "특별한 조건 없음"],
        cardTitle: "생활 조건",
        category: "hard_limit",
      },
    ],
    privacyDomains: [
      { id: "location", label: "생활 지역", helper: "시·군·구 수준의 위치", keywords: ["지역", "거주", "수원", "서울", "생활권"], defaultValue: "ask" },
      { id: "schedule", label: "시간과 일정", helper: "가능 시간과 반복 일정", keywords: ["시간", "일정", "평일", "주말"], defaultValue: "allow" },
      { id: "budget", label: "예산과 소비", helper: "비용 범위와 소비 기준", keywords: ["예산", "비용", "소비", "가성비"], defaultValue: "ask" },
      { id: "healthFamily", label: "건강과 가족", helper: "건강 상태와 가족 관계", keywords: ["건강", "질환", "가족", "육아", "아이"], defaultValue: "ask" },
      { id: "work", label: "직업과 활동", helper: "직업, 소속과 현재 활동", keywords: ["직업", "회사", "활동", "업무"], defaultValue: "allow" },
    ],
  },
  university_student: {
    title: "학교생활과 앞으로의 목표를 알려주세요",
    intro: "학교와 생활 지역만 짧게 적고, 나머지는 나와 가까운 항목을 여러 개 골라 주세요.",
    fields: [
      {
        id: "purposes",
        label: "대학생활에서 지금 가장 중요한 것은 무엇인가요?",
        helper: "여러 개 선택할 수 있어요.",
        type: "multi",
        options: ["학점 관리", "전공 공부", "자격증", "취업 준비", "공기업 준비", "대학원", "공모전", "프로젝트", "창업", "어학 공부"],
        required: true,
        cardTitle: "대학생활 목표",
        category: "objective",
      },
      { id: "school", label: "다니는 학교", type: "text", placeholder: "예: 한신대학교", cardTitle: "학교", category: "identity" },
      {
        id: "region",
        label: "학교가 아닌, 집을 기준으로 주로 생활하는 지역",
        helper: "정확한 주소는 필요 없어요. 시·군·구 정도만 적어 주세요.",
        type: "text",
        placeholder: "예: 수원시 영통구",
        required: true,
        cardTitle: "거주 지역",
        category: "identity",
      },
      { id: "major", label: "전공은 어느 분야에 가까운가요?", type: "multi", options: ["인문", "사회", "경영·경제", "교육", "자연과학", "공학", "IT·컴퓨터", "의약·간호", "예체능", "아직 미정"], cardTitle: "전공 분야", category: "identity" },
      { id: "year", label: "학년", type: "single", options: ["1학년", "2학년", "3학년", "4학년", "졸업 예정", "휴학 중"], cardTitle: "학년", category: "current_state" },
      {
        id: "career",
        label: "희망 직무나 관심 분야",
        helper: "아직 정하지 못했다면 관심이 가는 분야만 골라도 돼요.",
        type: "multi",
        options: ["개발·IT", "데이터·AI", "기획·PM", "디자인·콘텐츠", "마케팅·영업", "금융·회계", "공공기관", "연구·교육", "창업", "아직 미정"],
        cardTitle: "진로 관심 분야",
        category: "objective",
      },
      {
        id: "experience",
        label: "준비 중인 자격증, 기술 또는 경험",
        helper: "현재 하고 있거나 해 본 것을 모두 골라 주세요.",
        type: "multi",
        options: ["자격증 준비", "어학 공부", "코딩·도구 학습", "인턴·아르바이트", "팀 프로젝트", "공모전·대외활동", "포트폴리오", "아직 없음"],
        cardTitle: "보유 경험",
        category: "capability",
      },
      {
        id: "studyTime",
        label: "공부하기 좋은 시간은 언제인가요?",
        helper: "가능한 시간을 모두 골라 주세요.",
        type: "multi",
        options: ["평일 아침", "공강 시간", "평일 저녁", "주말", "하루 1시간 이내", "일정하지 않음"],
        cardTitle: "학습 가능 시간",
        category: "resource",
      },
      {
        id: "scheduleConditions",
        label: "계획을 세울 때 고려할 일정이 있나요?",
        type: "multi",
        options: ["통학 시간이 김", "아르바이트 중", "팀 프로젝트 진행 중", "수업이 많은 편", "특별한 조건 없음"],
        cardTitle: "학습 일정 조건",
        category: "routine",
      },
      {
        id: "answerStyle",
        label: "공부하거나 답변을 받을 때 어떤 방식이 잘 맞나요?",
        helper: "이해하기 쉬운 방식과 결과를 정리하는 방식을 함께 골라 주세요.",
        type: "multi",
        options: ["개념부터 차근차근", "예시 중심", "단계별 문제 풀이", "시험 대비 요약", "실습 중심", "핵심부터 요약", "표로 비교", "일정표·계획표", "우선순위 제시", "과제 문장 다듬기"],
        required: true,
        defaultValue: ["예시 중심", "핵심부터 요약"],
        cardTitle: "학습·답변 방식",
        category: "preference",
      },
    ],
    privacyDomains: [
      { id: "school", label: "학교·전공·학년", helper: "학교생활 기본 정보", keywords: ["학교", "전공", "학년", "대학생"], defaultValue: "allow" },
      { id: "grade", label: "성적", helper: "학점과 시험 결과", keywords: ["성적", "학점", "시험 결과"], defaultValue: "ask" },
      { id: "schedule", label: "수업과 일정", helper: "통학, 수업, 아르바이트 시간", keywords: ["시간", "수업", "통학", "아르바이트", "일정"], defaultValue: "ask" },
      { id: "location", label: "현재 위치", helper: "학교나 생활 지역", keywords: ["위치", "지역", "주소"], defaultValue: "ask" },
      { id: "career", label: "진로와 프로젝트", helper: "희망 직무, 기술과 경험", keywords: ["진로", "직무", "프로젝트", "기술", "자격증", "경험"], defaultValue: "allow" },
    ],
  },
  older_adult: {
    title: "어떤 도움을 받으면 좋을지 알려주세요",
    intro: "사는 지역만 짧게 적고, 나머지는 나와 가까운 큰 버튼을 모두 눌러 주세요.",
    fields: [
      {
        id: "purposes",
        label: "어떤 도움을 받고 싶으세요?",
        helper: "원하는 것을 모두 눌러 주세요.",
        type: "multi",
        options: ["건강 정보 이해", "병원 일정", "약 복용 알림", "일상 일정", "교통과 이동", "가족과 연락", "생활 정보", "취미"],
        required: true,
        cardTitle: "도움받을 영역",
        category: "objective",
      },
      {
        id: "region",
        label: "집을 기준으로 주로 생활하는 지역은 어디인가요?",
        helper: "정확한 주소는 쓰지 마세요. 시·군·구 정도면 충분해요.",
        type: "text",
        placeholder: "예: 수원시 영통구",
        required: true,
        cardTitle: "거주 지역",
        category: "identity",
      },
      { id: "ageGroup", label: "연령대", type: "single", options: ["50대", "60대", "70대", "80대 이상", "답하지 않음"], cardTitle: "연령대", category: "identity" },
      {
        id: "dailyActivities",
        label: "평소에 자주 하거나 좋아하는 일은 무엇인가요?",
        helper: "여러 개를 눌러도 괜찮아요.",
        type: "multi",
        options: ["산책·운동", "장보기", "병원 방문", "복지관·경로당", "종교·모임", "가족 만나기", "집에서 취미", "여행·나들이"],
        cardTitle: "평소 활동",
        category: "routine",
      },
      {
        id: "mobility",
        label: "외출할 때 어떤 도움이 필요하세요?",
        helper: "해당하는 내용을 모두 눌러 주세요.",
        type: "multi",
        options: ["혼자 편하게 외출함", "가끔 가족 도움이 필요함", "오래 걷기 어려움", "계단 이용이 어려움", "답하지 않음"],
        cardTitle: "이동 조건",
        category: "hard_limit",
      },
      {
        id: "transport",
        label: "주로 무엇을 타고 이동하세요?",
        helper: "자주 이용하는 것을 모두 눌러 주세요.",
        type: "multi",
        options: ["도보", "버스", "지하철", "자가용", "택시", "가족 차량"],
        cardTitle: "이동수단",
        category: "resource",
      },
      {
        id: "familyHelp",
        label: "가족이나 보호자의 도움을 받으시나요?",
        type: "single",
        options: ["혼자 해결함", "필요할 때 도움받음", "자주 도움받음", "답하지 않음"],
        cardTitle: "가족 도움",
        category: "relationship",
      },
      {
        id: "answerStyle",
        label: "어떻게 설명해 드리면 편하세요?",
        type: "multi",
        options: ["큰 글씨", "쉬운 단어", "짧은 문장", "한 번에 한 단계", "마지막에 다시 요약"],
        required: true,
        defaultValue: ["큰 글씨", "쉬운 단어", "한 번에 한 단계"],
        cardTitle: "설명 방식",
        category: "preference",
      },
      {
        id: "voice",
        label: "말로 질문하고 답변을 소리로 들을까요?",
        type: "single",
        options: ["질문과 답변 모두 음성 사용", "답변만 소리로 듣기", "글자로 사용"],
        defaultValue: "질문과 답변 모두 음성 사용",
        cardTitle: "음성 사용",
        category: "preference",
      },
      {
        id: "healthNotes",
        label: "항상 조심해야 할 점이 있나요?",
        helper: "해당하는 내용을 모두 눌러 주세요.",
        type: "multi",
        options: ["오래 걷는 일정 피하기", "계단 적은 곳", "중간에 쉴 곳 필요", "음식 주의", "약 복용 시간 고려", "시력·청력 고려", "복잡한 곳 피하기", "특별한 주의 없음"],
        cardTitle: "생활 주의사항",
        category: "hard_limit",
      },
    ],
    privacyDomains: [
      { id: "health", label: "건강 정보", helper: "건강 상태와 약 관련 내용", keywords: ["건강", "약", "병원", "질환", "음식"], defaultValue: "ask" },
      { id: "mobility", label: "이동의 어려움", helper: "걷기와 계단 이용 조건", keywords: ["걷", "계단", "이동 조건", "외출"], defaultValue: "ask" },
      { id: "family", label: "가족과 보호자", helper: "도움 여부와 관계 정보", keywords: ["가족", "보호자", "관계"], defaultValue: "ask" },
      { id: "location", label: "생활 지역", helper: "주로 생활하는 지역", keywords: ["위치", "지역", "주소"], defaultValue: "ask" },
    ],
  },
};

export function initialSurveyAnswers(personaType: PersonaType): SurveyAnswers {
  return Object.fromEntries(
    surveyDefinitions[personaType].fields.map((field) => [
      field.id,
      field.defaultValue ?? (field.type === "multi" ? [] : ""),
    ]),
  );
}

export function initialPrivacyAnswers(personaType: PersonaType): PrivacyAnswers {
  return Object.fromEntries(
    surveyDefinitions[personaType].privacyDomains.map((domain) => [domain.id, domain.defaultValue]),
  );
}

export function toggleSurveyChoice(selected: string[], value: string): string[] {
  if (selected.includes(value)) return selected.filter((item) => item !== value);
  if (EXCLUSIVE_SURVEY_CHOICES.includes(value)) return [value];
  return [...selected.filter((item) => !EXCLUSIVE_SURVEY_CHOICES.includes(item)), value];
}

export function buildSurveyNarrative(personaType: PersonaType, answers: SurveyAnswers): string {
  const definition = surveyDefinitions[personaType];
  const lines = definition.fields.flatMap((field) => {
    const value = answers[field.id];
    const content = Array.isArray(value)
      ? value.filter((item) => item && !EXCLUSIVE_SURVEY_CHOICES.includes(item)).join(", ")
      : value?.trim();
    if (!content || EXCLUSIVE_SURVEY_CHOICES.includes(content)) return [];
    return [`${field.cardTitle}: ${content}`];
  });
  return [`사용자 유형: ${personaMeta[personaType].label}`, ...lines].join("\n");
}

function choiceToPrivacy(choice: PrivacyChoice): PrivacyLevel {
  if (choice === "allow") return "normal";
  if (choice === "never") return "confidential";
  return "sensitive";
}

export function applySurveyPrivacy(
  personaType: PersonaType,
  drafts: StructuredContextDraft[],
  privacy: PrivacyAnswers,
): StructuredContextDraft[] {
  const domains = surveyDefinitions[personaType].privacyDomains;
  return drafts.map((draft) => {
    const haystack = `${draft.title} ${draft.content}`.toLocaleLowerCase();
    const domain = domains.find((item) => item.keywords.some((keyword) => haystack.includes(keyword.toLocaleLowerCase())));
    return domain ? { ...draft, privacyLevel: choiceToPrivacy(privacy[domain.id] || domain.defaultValue) } : draft;
  });
}

export function hasRequiredSurveyAnswers(personaType: PersonaType, answers: SurveyAnswers): boolean {
  return surveyDefinitions[personaType].fields
    .filter((field) => field.required)
    .every((field) => {
      const value = answers[field.id];
      return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
    });
}

export const privacyChoiceMeta: Record<PrivacyChoice, { label: string; description: string }> = {
  allow: { label: "기본 사용", description: "관련 질문이면 바로 추천" },
  ask: { label: "매번 확인", description: "질문할 때 직접 선택" },
  never: { label: "사용 안 함", description: "AI 답변에서 제외" },
};

export const categoryLabels: Record<ContextCategory, string> = {
  identity: "나의 배경",
  capability: "능력·경험",
  objective: "목표",
  preference: "선호",
  hard_limit: "꼭 지킬 조건",
  soft_limit: "가능하면 고려",
  resource: "시간·예산·수단",
  routine: "일정·습관",
  relationship: "가족·관계",
  current_state: "현재 상황",
  project: "진행 중인 일",
  profile: "기본 정보",
  goal: "목표",
  constraint: "제약 조건",
};
