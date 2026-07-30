import { randomUUID } from 'node:crypto';
import { ContextCategory, ContextItem, MemoryCandidate, PrivacyLevel } from '../types.js';

/**
 * 승인 기반 기억 — 질문에서 "새로 드러난 개인 맥락"을 추출한다.
 *
 * 이전 구현은 '무릎/오래 걷기' 한 문장만 정규식으로 잡고 저장 카드도 하드코딩이라
 * 데모 각본을 벗어나면 기능이 사라졌다. 여기서는 카테고리별 규칙 사전으로 확장하고,
 * 저장될 카드의 제목·태그·등급을 추출 결과에서 만든다(하드코딩 없음).
 *
 * LLM 추출기는 planExtraction()으로 주입 가능. 없으면 규칙 추출기로 폴백한다.
 */

export interface ExtractedMemory {
  label: string;
  category: ContextCategory;
  content: string;
  privacyLevel: PrivacyLevel;
  tags: string[];
  title: string;
  semanticGroup: string;
}

interface Rule {
  test: RegExp;
  build: (m: RegExpMatchArray, sentence: string) => ExtractedMemory;
}

/** 문장에서 실제로 매칭된 조각을 값으로 쓴다 — 통짜 하드코딩이 아니라 사용자 발화 기반. */
function clip(sentence: string, max = 40): string {
  const trimmed = sentence.trim().replace(/\s+/g, ' ');
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

const RULES: Rule[] = [
  // 건강·이동 접근성 (민감)
  {
    test: /(무릎|허리|다리|관절).{0,8}(안\s*좋|아프|아파|불편)|오래\s*(?:걷|걸)\S*\s*(?:어렵|어려|힘들|못|무리)|(?:걷|걸)\S*\s*못\s*(?:걷|걸)|휠체어|목발|보행\s*보조|다리가\s*불편/,
    build: () => ({
      label: '이동 접근성',
      title: '이동 접근성',
      category: 'hard_limit',
      content: '오래 걷기 어려움',
      privacyLevel: 'sensitive',
      tags: ['이동', '접근성', '외출'],
      semanticGroup: '이동',
    }),
  },
  // 만성질환·식이 제약 (민감)
  {
    test: /(당뇨|고혈압|알레르기|알러지|불내증|셀리악|천식|저염|무염)/,
    build: (m) => ({
      label: '건강·식이 제약',
      title: '건강·식이 제약',
      category: 'hard_limit',
      content: `${m[1]} 관련 조건`,
      privacyLevel: 'sensitive',
      tags: ['건강', '식단', '제약'],
      semanticGroup: '건강',
    }),
  },
  // 예산 (금액이 나오면 그 금액을 값으로). '5천원', '2만원', '10,000원' 등 폭넓게.
  {
    test: /(?:예산|가격|비용|돈).{0,8}?([0-9]{1,3}(?:,?[0-9]{3})*\s*(?:천|만)?\s*원)|([0-9]{1,3}(?:,?[0-9]{3})*\s*(?:천|만)?\s*원).{0,6}(?:이하|안|정도|밖|없|뿐)/,
    build: (m) => {
      const amount = (m[1] || m[2] || '').replace(/\s+/g, '').trim();
      return {
        label: '예산',
        title: '예산',
        category: 'resource',
        content: amount ? `${amount} 수준` : '예산 제약 있음',
        privacyLevel: 'normal',
        tags: ['예산', '외출'],
        semanticGroup: '예산',
      };
    },
  },
  // 가용 시간
  {
    test: /(하루|평일|주말|매일).{0,4}?([0-9]{1,2})\s*시간|시간\s*이?\s*(?:없|부족|촉박)|바쁘/,
    build: (m) => {
      const hours = m[2];
      const phrase = m[1] && hours ? `${m[1]} ${hours}시간` : '시간 여유 적음';
      return {
        label: '가용 시간',
        title: '가용 시간',
        category: 'resource',
        content: phrase,
        privacyLevel: 'normal',
        tags: ['시간', '공부'],
        semanticGroup: '시간',
      };
    },
  },
  // 설명 방식 선호
  {
    test: /(쉽게|쉬운|천천히|단계|짧게|간단).{0,6}(?:설명|알려|말)|(?:설명|답변).{0,4}(?:쉽게|짧게|간단|단계)/,
    build: (m, sentence) => ({
      label: '답변 방식 선호',
      title: '답변 방식 선호',
      category: 'preference',
      content: clip(sentence.includes('단계') ? '단계별 설명 선호' : '쉽고 짧은 설명 선호'),
      privacyLevel: 'normal',
      tags: ['답변', '설명'],
      semanticGroup: '답변',
    }),
  },
  // 이동 수단
  {
    test: /(대중교통|버스|지하철|자차|자전거|도보|택시)(?:만|를|로|으로|을)?\s*(?:이용|타|다니|이동)?/,
    build: (m) => ({
      label: '이동 수단',
      title: '이동 수단',
      category: 'resource',
      content: `${m[1]} 이용`,
      privacyLevel: 'normal',
      tags: ['이동', '외출'],
      semanticGroup: '이동수단',
    }),
  },
  // 음식 취향
  {
    test: /(매운|매워|채식|비건|해산물|밀가루).{0,6}(?:못\s*먹|안\s*먹|싫|피하|알레르)|(?:못\s*먹|안\s*먹).{0,4}(매운|채식|해산물)/,
    build: (m, sentence) => ({
      label: '음식 취향',
      title: '음식 취향',
      category: 'preference',
      content: clip(sentence),
      privacyLevel: 'normal',
      tags: ['음식', '식단'],
      semanticGroup: '음식',
    }),
  },
];

function firstSentenceMatching(query: string, rule: Rule): { match: RegExpMatchArray; sentence: string } | null {
  const sentences = query.split(/(?<=[.!?。])\s+|\n+/).filter(Boolean);
  const pool = sentences.length ? sentences : [query];
  for (const sentence of pool) {
    const match = sentence.match(rule.test);
    if (match) return { match, sentence };
  }
  return null;
}

/**
 * 규칙 기반 추출. 한 질문에서 서로 다른 카테고리를 최대 3개까지 뽑는다(중복 라벨 제거).
 * 값은 매칭된 문장에서 만들며, 어떤 카테고리도 통짜 하드코딩되어 있지 않다.
 */
export function extractByRules(query: string): ExtractedMemory[] {
  const found: ExtractedMemory[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    const hit = firstSentenceMatching(query, rule);
    if (!hit) continue;
    const mem = rule.build(hit.match, hit.sentence);
    if (!isSaveWorthyMemory(query, mem)) continue;
    if (seen.has(mem.label)) continue;
    seen.add(mem.label);
    found.push(mem);
    if (found.length >= 3) break;
  }
  return found;
}

/**
 * 저장 질문은 "다음 질문에서도 다시 쓸 가능성이 높은 개인 사실"에만 띄운다.
 * 일회성 요청·현재 한 번의 예산·답변 명령은 답변에는 사용해도 기억 후보로 만들지 않는다.
 */
export function isSaveWorthyMemory(query: string, memory: ExtractedMemory): boolean {
  const text = query.trim();
  const durableCue = /(저는|나는|제가|내\s|나의|평소|항상|주로|매일|평일|주말|앞으로|계속|선호|좋아|싫어|못\s*먹|안\s*먹)/;
  const oneOffCue = /(오늘|내일|이번\s*(?:주|달|한번)|지금|이번만|오늘만)/;

  // 건강·알레르기·보행 제약처럼 반복 사용 가치가 명확한 사실은 보존한다.
  if (memory.privacyLevel === 'sensitive' && ['hard_limit', 'constraint'].includes(memory.category)) {
    return true;
  }

  // 단순한 "쉽게 설명해줘/짧게 알려줘"는 이번 답변 지시이지 장기 선호가 아니다.
  if (memory.label === '답변 방식 선호') {
    return /(평소|항상|앞으로|선호|좋아)/.test(text);
  }

  // 예산은 오늘 한 번의 금액이면 저장하지 않고, 평소 기준이라고 명시된 경우만 저장한다.
  if (memory.label === '예산') {
    return /(평소|보통|항상|매번|제\s*예산|내\s*예산|나의\s*예산)/.test(text) && !oneOffCue.test(text);
  }

  // 시간·이동 수단 등 자원 정보는 반복성 또는 자기 사실 표현이 있어야 한다.
  if (memory.category === 'resource') {
    return durableCue.test(text) && !oneOffCue.test(text);
  }

  // 취향·목표·배경은 자기 사실로 표현됐을 때만 저장 후보가 된다.
  return durableCue.test(text) && !oneOffCue.test(text);
}

function normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/\s+/g, '');
}

/**
 * 레거시 카테고리(constraint/goal/profile)와 v19 카테고리(hard_limit/objective/identity)를
 * 같은 의미 축으로 접는다. 중복 판정이 taxonomy 표기 차이 때문에 실패하지 않도록 한다.
 */
function canonicalCategory(category: string): string {
  switch (category) {
    case 'constraint':
    case 'hard_limit':
    case 'soft_limit': return 'limit';
    case 'goal':
    case 'objective': return 'objective';
    case 'profile':
    case 'identity': return 'identity';
    default: return category;
  }
}

/**
 * 이미 프로필에 사실상 '같은 사실'이 있으면 후보에서 뺀다.
 * 태그 겹침(이동·외출 등 광범위한 태그)으로 판정하면 '이동 수단'과 '이동 접근성'처럼
 * 서로 다른 카드를 오검출한다. 제목 일치 또는 내용 문자열 포함으로만 좁게 본다.
 */
export function isDuplicate(extracted: ExtractedMemory, existing: ContextItem[]): boolean {
  const exTitle = normalize(extracted.title);
  const exContent = normalize(extracted.content);
  return existing.some((item) => {
    if (canonicalCategory(item.category) !== canonicalCategory(extracted.category)) return false;
    const itTitle = normalize(item.title);
    const itContent = normalize(item.content);
    if (itTitle === exTitle) return true;
    // 내용이 서로를 포함할 때만 같은 사실로 본다(부분 문자열, 길이 3 이상).
    return (
      exContent.length >= 3 &&
      (itContent.includes(exContent) || exContent.includes(itContent))
    );
  });
}

export function toCandidate(
  extracted: ExtractedMemory,
  userId: string,
  profileId: string,
): MemoryCandidate & { userId: string; profileId: string; blueprint: ExtractedMemory } {
  return {
    id: randomUUID(),
    label: extracted.label,
    category: extracted.category,
    content: extracted.content,
    privacyLevel: extracted.privacyLevel,
    status: 'PENDING',
    userId,
    profileId,
    blueprint: extracted,
  };
}

export function blueprintToContext(blueprint: ExtractedMemory): ContextItem {
  return {
    id: `ctx-${randomUUID()}`,
    title: blueprint.title,
    category: blueprint.category,
    content: blueprint.content,
    tags: [...blueprint.tags],
    isActive: true,
    privacyLevel: blueprint.privacyLevel,
    updatedAt: new Date().toISOString(),
  };
}

/** LLM 추출기 포트. 서버가 Gemini를 주입하면 규칙 대신(또는 규칙과 병합) 쓴다. */
export interface MemoryExtractor {
  extract(query: string): Promise<ExtractedMemory[]>;
}
