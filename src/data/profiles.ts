import type { DemoAccount, UserProfile } from "../types";

export const demoAccounts: DemoAccount[] = [
  {
    id: "acct-jeon-ihyeon",
    email: "ihyeon.demo@contextbridge.local",
    displayName: "전이현",
    personaType: "university_student",
    description: "대학생 / 공기업 전산직 준비",
    profileId: "profile-jeon-ihyeon",
    source: "demo",
  },
  {
    id: "acct-kim-youngja",
    email: "youngja.demo@contextbridge.local",
    displayName: "김영자",
    personaType: "older_adult",
    description: "고령 사용자 / 쉬운 설명 필요",
    profileId: "profile-kim-youngja",
    source: "demo",
  },
];

export const demoProfiles: UserProfile[] = [
  {
    id: "profile-jeon-ihyeon",
    accountId: "acct-jeon-ihyeon",
    name: "전이현",
    group: "대학생 / 공기업 전산직 준비",
    personaType: "university_student",
    source: "demo",
    uiMode: "standard",
    defaultQuestion: "이번 방학에 뭐 공부해야 해?",
    examples: ["이번 방학에 뭐 공부해야 해?", "공기업 전산직 준비하려면 뭐부터 해야 해?", "우리 동네에서 공부하기 좋은 곳을 추천해 줘"],
    fields: [
      { key: "occupation", label: "현재 상태", value: "대학생", sensitivity: "normal", enabled: true, tags: ["learning_plan"] },
      { key: "major", label: "전공", value: "AI·SW학과", sensitivity: "normal", enabled: true, tags: ["learning_plan"] },
      { key: "grade", label: "학년", value: "3학년", sensitivity: "normal", enabled: true, tags: ["learning_plan"] },
      { key: "living_environment", label: "거주 환경", value: "수원 거주, 대중교통과 공원 이용이 편리함", sensitivity: "normal", enabled: true, tags: [] },
      { key: "career_goal", label: "진로 목표", value: "공기업 전산직", sensitivity: "normal", enabled: true, tags: ["learning_plan"] },
      { key: "certificate_goal", label: "자격증 목표", value: "SQLD, 정보처리기사", sensitivity: "normal", enabled: true, tags: ["learning_plan"] },
      { key: "current_skills", label: "현재 기술", value: "Python, React, Supabase", sensitivity: "normal", enabled: true, tags: ["learning_plan"] },
      { key: "available_study_time", label: "공부 가능 시간", value: "평일 1시간", sensitivity: "normal", enabled: true, tags: ["learning_plan"] },
      { key: "transportation", label: "이동 방식", value: "대중교통", sensitivity: "normal", enabled: true, tags: ["outing_plan"] },
      { key: "budget_level", label: "예산 수준", value: "대학생 수준", sensitivity: "sensitive", enabled: true, tags: ["outing_plan", "low_budget_activity"] },
      { key: "place_preference", label: "장소 취향", value: "조용한 장소, 사진 찍기 좋은 공간", sensitivity: "normal", enabled: true, tags: ["outing_plan"] },
      { key: "response_style", label: "답변 방식", value: "구체적이고 단계적인 설명", sensitivity: "normal", enabled: true, tags: ["learning_plan", "outing_plan"] },
    ],
  },
  {
    id: "profile-kim-youngja",
    accountId: "acct-kim-youngja",
    name: "김영자",
    group: "고령 사용자 / 쉬운 설명 필요",
    personaType: "older_adult",
    source: "demo",
    uiMode: "easy",
    defaultQuestion: "내일 딸이랑 어디 가면 좋아?",
    examples: ["내일 딸이랑 어디 가면 좋아?", "키오스크 쓰는 법 쉽게 알려줘", "집 근처에서 오래 걷지 않고 갈 곳을 알려줘"],
    fields: [
      { key: "age_group", label: "연령대", value: "70대", sensitivity: "sensitive", enabled: true, tags: ["easy_explanation", "outing_plan"] },
      { key: "digital_literacy", label: "디지털 숙련도", value: "초급", sensitivity: "normal", enabled: true, tags: ["how_to", "easy_explanation"] },
      { key: "living_environment", label: "거주 환경", value: "버스 정류장과 실내 복지시설이 가까움", sensitivity: "normal", enabled: true, tags: [] },
      { key: "mobility", label: "이동 조건", value: "장시간 보행 어려움", sensitivity: "sensitive", enabled: true, tags: ["outing_plan"] },
      { key: "transportation", label: "이동 방식", value: "버스와 지하철", sensitivity: "normal", enabled: true, tags: ["outing_plan"] },
      { key: "place_preference", label: "장소 취향", value: "좌석이 있는 곳, 실내 공간", sensitivity: "normal", enabled: true, tags: ["outing_plan"] },
      { key: "accessibility_preferences", label: "접근성 선호", value: "큰 글씨, 짧은 문장, 쉬운 표현, 단계별 안내", sensitivity: "normal", enabled: true, tags: ["easy_explanation", "how_to", "outing_plan"] },
      { key: "response_style", label: "답변 방식", value: "짧고 쉬운 설명", sensitivity: "normal", enabled: true, tags: ["easy_explanation", "how_to", "outing_plan"] },
    ],
  },
];

export const profiles = demoProfiles;
