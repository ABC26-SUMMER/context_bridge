import type { ContextCategory, PersonaType, PrivacyLevel, StructuredContextDraft } from "../../contracts/types";

export type SurveyAnswer = string | string[];
export type SurveyAnswers = Record<string, SurveyAnswer>;
export type PrivacyChoice = "allow" | "ask" | "never";
export type PrivacyAnswers = Record<string, PrivacyChoice>;

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

export const personaMeta: Record<PersonaType, { label: string; description: string; icon: string; profileName: string }> = {
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
    intro: "정확한 주소나 민감한 정보는 필요하지 않아요. 답변에 도움이 되는 만큼만 선택해 주세요.",
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
        label: "현재 주로 하는 일이나 활동",
        type: "text",
        placeholder: "예: 마케팅 회사원, 프리랜서, 육아 중",
        cardTitle: "현재 활동",
        category: "identity",
      },
      {
        id: "region",
        label: "주로 생활하는 지역",
        helper: "시·군·구 정도면 충분해요.",
        type: "text",
        placeholder: "예: 수원시 영통구",
        cardTitle: "생활 지역",
        category: "identity",
      },
      {
        id: "goal",
        label: "요즘 가장 중요하게 생각하는 목표",
        type: "text",
        placeholder: "예: 퇴근 후 꾸준히 운동하기",
        cardTitle: "현재 목표",
        category: "objective",
      },
      {
        id: "transport",
        label: "주로 이용하는 이동수단",
        type: "single",
        options: ["도보", "대중교통", "자가용", "자전거", "상황에 따라 다름"],
        cardTitle: "이동수단",
        category: "resource",
      },
      {
        id: "availableTime",
        label: "계획에 활용할 수 있는 시간",
        type: "single",
        options: ["평일 낮", "평일 저녁", "주말", "매일 1시간 이내", "일정하지 않음"],
        cardTitle: "사용 가능 시간",
        category: "resource",
      },
      {
        id: "recommendationStyle",
        label: "추천을 받을 때 무엇이 중요한가요?",
        type: "single",
        options: ["가성비", "편리함", "검증된 선택", "새로운 경험", "여러 선택지 비교"],
        defaultValue: "여러 선택지 비교",
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
        type: "text",
        placeholder: "예: 반려견과 함께 갈 수 있는 장소가 필요해요.",
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
    intro: "성적과 학번은 묻지 않아요. 공부 계획과 진로 답변에 필요한 내용부터 가볍게 시작해요.",
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
      { id: "school", label: "학교", type: "text", placeholder: "예: 한신대학교", cardTitle: "학교", category: "identity" },
      { id: "major", label: "전공", type: "text", placeholder: "예: 컴퓨터공학", cardTitle: "전공", category: "identity" },
      { id: "year", label: "학년", type: "single", options: ["1학년", "2학년", "3학년", "4학년", "졸업 예정", "휴학 중"], cardTitle: "학년", category: "current_state" },
      {
        id: "career",
        label: "희망 직무나 관심 분야",
        type: "text",
        placeholder: "예: 백엔드 개발자, 아직 정하지 못함",
        cardTitle: "진로 관심 분야",
        category: "objective",
      },
      {
        id: "experience",
        label: "준비 중인 자격증, 기술 또는 경험",
        type: "text",
        placeholder: "예: 정보처리기사 준비 중, Java 기초 경험",
        cardTitle: "보유 경험",
        category: "capability",
      },
      {
        id: "studyTime",
        label: "공부에 사용할 수 있는 시간",
        type: "single",
        options: ["하루 1시간 이내", "하루 2~3시간", "하루 4시간 이상", "주말 중심", "일정하지 않음"],
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
        id: "learningStyle",
        label: "어떤 방식으로 공부할 때 잘 이해되나요?",
        type: "multi",
        options: ["개념부터 설명", "예시 중심", "단계별 문제 풀이", "시험 대비 요약", "실습 중심"],
        defaultValue: ["예시 중심"],
        cardTitle: "학습 방식",
        category: "preference",
      },
      {
        id: "answerStyle",
        label: "원하는 답변 형태",
        type: "multi",
        options: ["핵심 요약", "단계별 설명", "표로 비교", "일정표", "우선순위", "과제 문장 다듬기"],
        required: true,
        defaultValue: ["핵심 요약", "우선순위"],
        cardTitle: "답변 방식",
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
    intro: "어려운 내용은 쓰지 않아도 괜찮아요. 큰 버튼을 눌러 편하게 알려주세요.",
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
      { id: "ageGroup", label: "연령대", type: "single", options: ["50대", "60대", "70대", "80대 이상", "답하지 않음"], cardTitle: "연령대", category: "identity" },
      {
        id: "mobility",
        label: "외출할 때 어떤 도움이 필요하세요?",
        type: "single",
        options: ["혼자 편하게 외출함", "가끔 가족 도움이 필요함", "오래 걷기 어려움", "계단 이용이 어려움", "답하지 않음"],
        cardTitle: "이동 조건",
        category: "hard_limit",
      },
      {
        id: "transport",
        label: "주로 무엇을 타고 이동하세요?",
        type: "single",
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
        helper: "쓰고 싶지 않으면 비워 두셔도 됩니다.",
        type: "text",
        placeholder: "예: 오래 걷기 어렵거나 피해야 하는 음식",
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

export function buildSurveyNarrative(personaType: PersonaType, answers: SurveyAnswers): string {
  const definition = surveyDefinitions[personaType];
  const lines = definition.fields.flatMap((field) => {
    const value = answers[field.id];
    const content = Array.isArray(value) ? value.filter(Boolean).join(", ") : value?.trim();
    if (!content || content === "답하지 않음" || content === "특별한 조건 없음") return [];
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
