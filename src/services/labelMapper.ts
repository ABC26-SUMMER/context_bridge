const KNOWN_LABELS: Record<string, string> = {
  residence_location: "거주지",
  phone_number: "전화번호",
  email: "이메일",
  birthdate: "생년월일",
  full_name: "이름",
  address: "주소",
  emergency_contact: "비상 연락처",
  preferred_language: "선호 언어",
  occupation: "직업",
  // 예시: onboarding 등에서 내려오는 영어 라벨에 대한 직접 매핑
  "Strawberry Preference": "딸기 선호",
  "Strawberry preference": "딸기 선호",
  "Strawberry": "딸기",
};

const EN_KO: Record<string, string> = {
  strawberry: "딸기",
  preference: "선호",
  preference_s: "선호",
  preference_type: "선호",
  location: "위치",
  residence: "거주지",
  phone: "전화번호",
  number: "번호",
  email: "이메일",
  birthdate: "생년월일",
  fullname: "이름",
  full_name: "이름",
  name: "이름",
  address: "주소",
  contact: "연락처",
  emergency: "비상",
};

function translateEnglishLabel(label: string) {
  // 단어 단위로 분해해 간단히 매핑
  const words = label.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length) return label;

  // 간단 규칙: 'X Preference' -> 'X 선호' (X는 가능한 번역 사용)
  if (/preference/i.test(label)) {
    const subject = words.filter((w) => !/preference/i.test(w)).join(" ");
    const subjKey = subject.toLowerCase();
    const subjKo = EN_KO[subjKey] || subject.split(/\s+/).map((w) => (EN_KO[w.toLowerCase()] || capitalize(w))).join(" ");
    return `${subjKo} 선호`;
  }

  // 일반적인 영어 라벨은 단어별 번역 시도, 없으면 원문 Title Case
  const translated = words.map((w) => EN_KO[w.toLowerCase()] || capitalize(w)).join(" ");
  return translated;
}

function capitalize(s: string) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

export function humanizeMemoryLabel(key: string | undefined | null) {
  if (!key) return "";
  // 정확한 키 매핑 우선
  if (KNOWN_LABELS[key]) return KNOWN_LABELS[key];

  // snake_case인 경우 기존 동작
  if (/_/.test(key)) {
    const replaced = key.replace(/_/g, " ");
    return replaced.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // 띄어쓰기 포함된 영어 라벨(예: 'Strawberry Preference') 처리
  if (/\b[A-Za-z]+\b/.test(key)) {
    return translateEnglishLabel(key);
  }

  // 폴백: 그대로 표시
  return key;
}
