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
  /** LLM 추출 시 사용자가 실제로 말한 근거 구절. 서버 응답/카드에는 저장하지 않는다. */
  sourceQuote?: string;
  /** CREATE는 새 카드, UPDATE는 동일 슬롯의 기존 카드를 교체한다. */
  operation?: 'CREATE' | 'UPDATE';
  updateTargetId?: string;
}

export const MAX_MEMORY_CANDIDATES = 8;

const ALLOWED_CATEGORIES = new Set<ContextCategory>([
  'identity', 'capability', 'objective', 'preference', 'hard_limit', 'soft_limit',
  'resource', 'routine', 'relationship', 'current_state', 'project',
  'profile', 'goal', 'constraint',
]);

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
    build: (_m, sentence) => ({
      label: '이동 접근성',
      title: '이동 접근성',
      category: 'hard_limit',
      // 실제 발화에 맞춰 내용을 만든다(휠체어/목발까지 '오래 걷기 어려움'으로 뭉개지 않음).
      content: /휠체어/.test(sentence)
        ? '휠체어 이용'
        : /목발/.test(sentence)
          ? '목발 사용'
          : /보행\s*보조/.test(sentence)
            ? '보행 보조 필요'
            : '오래 걷기 어려움',
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
  // 지속적으로 사용하는 개발 도구·기술
  {
    test: /(vscode|vs\s*code|visual\s*studio\s*code|python|파이썬|react|리액트|java|자바|figma|피그마|supabase|수파베이스|brainaccess\s*halo)(?:를|을)?\s*(?:사용|쓰|활용|다루|할\s*줄)/i,
    build: (m) => ({
      label: '사용 기술·도구',
      title: '사용 기술·도구',
      category: 'capability',
      content: `${m[1].replace(/\s+/g, ' ').trim()} 사용`,
      privacyLevel: 'normal',
      tags: ['기술', '도구'],
      semanticGroup: '역량',
    }),
  },
  // 시험·어학 점수처럼 사용자가 명시한 현재 역량
  {
    test: /(토익|toeic|토익스피킹|토스|오픽|opic|토플|toefl|아이엘츠|ielts)\s*(?:점수는?|은|는|이|가)?\s*([0-9]{2,4}|AL|IH|IM[123]?|IL|AM|AH)\s*(?:점|등급)?/i,
    build: (m) => ({
      label: '어학 성적',
      title: '어학 성적',
      category: 'capability',
      content: `${m[1]} ${m[2]}${/^\d+$/.test(m[2]) ? '점' : ''}`,
      privacyLevel: 'normal',
      tags: ['어학', '역량'],
      semanticGroup: '역량',
    }),
  },
  // 입대·진학·지원처럼 앞으로 확정적으로 예정된 진로 계획
  {
    test: /(해군|육군|공군|해병대|군대|대학원|대학|회사|공기업)(?:에|으로)?\s*(?:들어갈|들어가|입대|지원|진학|취업|갈)(?:할)?\s*(?:예정|계획|준비|목표)|(?:예정|계획).{0,6}(해군|육군|공군|해병대|군대|대학원|대학|회사|공기업)/,
    build: (_m, sentence) => ({
      label: '진로 계획',
      title: '진로 계획',
      category: 'objective',
      content: clip(sentence),
      privacyLevel: 'normal',
      tags: ['진로', '계획'],
      semanticGroup: '목표',
    }),
  },

  // 시각 접근성 — 일시적 증상이 아닌 지속적인 UI 제약
  {
    test: /(?:작은|잔)\s*글씨(?:를|가|는)?\s*(?:보기|읽기).{0,8}(?:어렵|어려|힘들|불편|안\s*보)|글자.{0,8}(?:크게|확대).{0,5}(?:필요|해줘)/,
    build: () => ({
      label: '시각 접근성', title: '시각 접근성', category: 'hard_limit',
      content: '작은 글씨 보기 어려움', privacyLevel: 'sensitive',
      tags: ['시각', '접근성'], semanticGroup: '접근성',
    }),
  },
  // 정기 복약 루틴
  {
    test: /(?:(매일|매주|평일|주말)\s*)?(아침|점심|저녁|밤)?\s*(?:마다\s*)?([가-힣A-Za-z0-9]+약|혈압약|당뇨약).{0,8}(?:먹|복용|챙겨)/,
    build: (m) => ({
      label: '복약 루틴', title: '복약 루틴', category: 'routine',
      content: `${m[1] || '매일'}${m[2] ? ` ${m[2]}` : ''} ${m[3]} 복용`.replace(/\s+/g, ' '),
      privacyLevel: 'sensitive', tags: ['복약', '건강'], semanticGroup: '건강루틴',
    }),
  },
  // 디지털 활용 능력/지원 필요
  {
    test: /(?:앱|어플|애플리케이션|프로그램)\s*(?:설치|가입|로그인|설정)(?:가|이|은|는|을|를)?\s*.{0,6}(?:어렵|어려|힘들|잘\s*못|도움)/,
    build: (m, sentence) => ({
      label: '디지털 활용', title: '디지털 활용', category: 'capability',
      content: /설치/.test(sentence) ? '앱 설치 어려움' : '디지털 사용 지원 필요',
      privacyLevel: 'normal', tags: ['디지털', '지원'], semanticGroup: '디지털역량',
    }),
  },
  // 반복 일정
  {
    test: /(?:매주|매달|매일|평일|주말)\s*(월|화|수|목|금|토|일)요일?(?:마다)?\s*([^,.!?]{1,24})(?:가|다니|참여|방문|있)/,
    build: (m) => ({
      label: '정기 일정', title: '정기 일정', category: 'routine',
      content: `매주 ${m[1]}요일 ${m[2].trim()}`,
      privacyLevel: 'normal', tags: ['일정', '루틴'], semanticGroup: '일정',
    }),
  },
  // 근무 형태와 생활 패턴
  {
    test: /(재택근무|원격근무|야간\s*근무|교대\s*근무|주간\s*근무)(?:를|를\s*주로|를\s*하고|해|중|입니다|예요|야)?/,
    build: (m) => ({
      label: '근무 형태', title: '근무 형태', category: 'routine',
      content: `${m[1].replace(/\s+/g, ' ')} 생활 패턴`, privacyLevel: 'normal',
      tags: ['근무', '생활'], semanticGroup: '생활패턴',
    }),
  },
  // 보유 장비·자원
  {
    test: /(모니터|노트북|데스크톱|태블릿|프린터|차량|자차)(?:를|이|가)?\s*(?:있|보유|가지고)/,
    build: (m) => ({
      label: '보유 자원', title: '보유 자원', category: 'resource',
      content: `${m[1]} 보유`, privacyLevel: 'normal', tags: ['자원'], semanticGroup: '보유자원',
    }),
  },
  // 반려동물·동거 관계
  {
    test: /(고양이|강아지|반려견|반려묘|반려동물)(?:와|과|랑|하고)?\s*(?:함께)?\s*(?:살|거주|키우)/,
    build: (m) => ({
      label: '동거 관계', title: '동거 관계', category: 'relationship',
      content: `${m[1]}와 함께 거주`, privacyLevel: 'normal', tags: ['관계', '반려동물'], semanticGroup: '관계',
    }),
  },
  // 언어 선호
  {
    test: /(한국어|영어|일본어|중국어)(?:로|설명을?)?.{0,8}(?:설명|답변|안내).{0,6}(?:선호|좋|편해|해줘)|(?:설명|답변).{0,8}(한국어|영어|일본어|중국어)(?:로)?.{0,5}(?:해줘|선호)/,
    build: (m) => ({
      label: '언어 선호', title: '언어 선호', category: 'preference',
      content: `${m[1] || m[2]} 설명 선호`, privacyLevel: 'normal', tags: ['언어', '답변'], semanticGroup: '언어',
    }),
  },
  // 프로젝트 역할
  {
    test: /(캡스톤|프로젝트|해커톤|연구)(?:에서|에서는|의)?\s*([^,.!?]{0,20}?)(백엔드|프론트엔드|기획|데이터|모델링|팀장|연구)(?:을|를)?\s*(?:담당|역할|하고)/,
    build: (m) => ({
      label: '프로젝트 역할', title: '프로젝트 역할', category: 'project',
      content: `${m[1]} ${m[3]} 역할`, privacyLevel: 'normal', tags: ['프로젝트', '역할'], semanticGroup: '프로젝트',
    }),
  },
  // 연구 주제·장비
  {
    test: /(BrainAccess\s*HALO|브레인액세스\s*헤일로|HALO)(?:로|를|을|와|과)?\s*.{0,15}(EEG|뇌파|연구)|(?:EEG|뇌파).{0,15}(BrainAccess\s*HALO|HALO).{0,8}(?:연구|사용)/i,
    build: () => ({
      label: '연구 주제', title: '연구 주제', category: 'project',
      content: 'BrainAccess HALO EEG 연구', privacyLevel: 'normal', tags: ['EEG', '연구'], semanticGroup: '연구',
    }),
  },
  // 통학·통근 시간
  {
    test: /(왕복|편도)?\s*([0-9]{1,2})\s*시간(?:\s*([0-9]{1,2})\s*분)?.{0,8}(통학|통근)|(?:통학|통근).{0,8}(왕복|편도)?\s*([0-9]{1,2})\s*시간/,
    build: (m) => ({
      label: '통학·통근', title: '통학·통근', category: 'routine',
      content: `${m[1] || m[5] || ''} ${m[2] || m[6]}시간${m[3] ? ` ${m[3]}분` : ''} ${m[4] || '통학'}`.trim().replace(/\s+/g, ' '),
      privacyLevel: 'normal', tags: ['통학', '시간'], semanticGroup: '생활패턴',
    }),
  },

  // 음식 취향 — (A) 긍정형 채식/비건 선언, (B) 특정 음식 회피. 내용은 매칭 토큰으로만
  // 좁게 만들어 복합 문장에서 다른 사실이 섞이지 않게 한다.
  {
    test: /(채식|비건)(?:주의|이에요|이야|이에|해요|합니다|입니다|을?\s*해|를?\s*해|지향)|(매운|매워|채식|비건|해산물|밀가루|글루텐|유제품|우유|견과).{0,6}(?:못\s*먹|안\s*먹|싫|피하|알레르|불내)|(?:못\s*먹|안\s*먹).{0,4}(매운|채식|해산물|밀가루|유제품|견과)/,
    build: (m) => {
      const veg = m[1];                       // 채식/비건 (긍정형)
      const avoid = m[2] || m[3];             // 회피 대상
      let content: string;
      if (veg && !avoid) {
        content = `${veg} 지향`;
      } else {
        const food = avoid || veg || '';
        const name = /매운|매워/.test(food) ? '매운 음식' : food;
        content = name ? `${name} 못 먹음` : '특정 음식 제한';
      }
      return {
        label: '음식 취향',
        title: '음식 취향',
        category: 'preference',
        content,
        privacyLevel: 'normal',
        tags: ['음식', '식단'],
        semanticGroup: '음식',
      };
    },
  },
  // 장기 목표 — 자격증·시험·취업 등 "이루려는 결과". 값은 문장에서 만든다(하드코딩 아님).
  // 두 경로: (A) '목표' 자체가 명시된 경우, (B) 자격증/시험/취업 주제 + 목표 동사(따야·취득·준비 등).
  {
    test: /목표(?:로|는|가|야|이야|이에요|예요|입니다|이라|임|에\s*두)|(?:자격증|자격|면허|토익|토익스피킹|토스|오픽|opic|토플|아이엘츠|ielts|jlpt|한국사|컴활|정보처리|기사|시험|취업|이직|합격|취득)[\s\S]{0,20}(?:목표|따|딸|취득|합격|준비|공부|도전|하려|하고\s*싶)/i,
    build: (_m, sentence) => ({
      label: '목표',
      title: '목표',
      category: 'objective',
      content: clip(sentence),
      privacyLevel: 'normal',
      tags: ['목표', '학습'],
      semanticGroup: '목표',
    }),
  },
];

function allMatches(query: string, rule: Rule): Array<{ match: RegExpMatchArray; sentence: string }> {
  // 모바일 음성 입력은 "요.저는"처럼 문장부호 뒤 공백이 없는 경우가 많다.
  // 공백 유무와 관계없이 문장을 나눠 다른 문장의 '오늘'이 영구 사실을 오염시키지 않게 한다.
  const sentences = query.split(/(?<=[.!?。])\s*|[,，;；]\s*|\s+(?:하지만|그런데|다만|반면에)\s*|(?:이지만|지만)\s*(?=(?:오늘|이번|지금|내일))|\n+/).map((part) => part.trim()).filter(Boolean);
  const pool = sentences.length ? sentences : [query];
  const hits: Array<{ match: RegExpMatchArray; sentence: string }> = [];
  for (const sentence of pool) {
    const flags = rule.test.flags.includes('g') ? rule.test.flags : `${rule.test.flags}g`;
    const matcher = new RegExp(rule.test.source, flags);
    for (const match of sentence.matchAll(matcher)) hits.push({ match, sentence });
  }
  return hits;
}

/**
 * 규칙 기반 추출. 같은 라벨이라도 내용이 다르면 각각 후보로 만든다.
 * 값은 매칭된 문장에서 만들며, 어떤 카테고리도 통짜 하드코딩되어 있지 않다.
 */
export function extractByRules(query: string): ExtractedMemory[] {
  const found: ExtractedMemory[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    for (const hit of allMatches(query, rule)) {
      const mem = rule.build(hit.match, hit.sentence);
      mem.sourceQuote = hit.sentence.trim();
      // 다른 문장의 '오늘'이 영구 사실까지 막지 않도록 해당 근거 문장만 판정한다.
      if (!isSaveWorthyMemory(hit.sentence, mem)) continue;
      const key = memoryFingerprint(mem);
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(mem);
      if (found.length >= MAX_MEMORY_CANDIDATES) return found;
    }
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

  // 기밀·인증정보는 모델이 등급을 잘못 붙여도 AI 장기 기억으로 만들지 않는다.
  if (memory.privacyLevel === 'confidential' || containsSecret(text) || containsSecret(memory.content)) return false;

  // 건강·알레르기·보행 제약은 보존하되 명시적인 일시 증상은 제외한다.
  if (memory.privacyLevel === 'sensitive' && ['hard_limit', 'constraint'].includes(memory.category)) {
    // "엄마가 당뇨가 있어요"를 사용자의 질환으로 저장하거나, 단순히 질환을
    // 질문에 언급한 것만으로 개인 사실을 만드는 것을 결정론적으로 차단한다.
    const thirdPartySubject = /(엄마|아빠|어머니|아버지|부모님|친구|동생|형|누나|언니|오빠|남편|아내|배우자|아들|딸|할머니|할아버지|환자|지인)\s*(?:은|는|이|가|께서)/.test(text);
    const selfCue = /(저는|나는|제가|내\s|나의|제\s|평소|항상|만성)/.test(text);
    if (thirdPartySubject && !selfCue) return false;

    const personalAssertion = selfCue ||
      /(?:있|앓|진단|복용|먹|챙겨|사용|이용|다니|다녀|짚|보기|읽기|못\s*(?:먹|걷|걸)|안\s*(?:좋|보)|불편|아프|아파|어렵|어려|힘들|필요)\S*/.test(text);
    if (!personalAssertion) return false;

    const explicitlyTemporary = oneOffCue.test(text) &&
      /(아프|아파|다쳤|삐었|삐끗|감기|잠깐|일시적)/.test(text) &&
      !/(평소|항상|만성|계속|알레르|당뇨|고혈압|휠체어|목발)/.test(text);
    return !explicitlyTemporary;
  }

  // 장기 목표(objective/goal/project)는 그 자체로 다음 질문에서도 유효한 사실이다.
  // "저는/평소" 같은 일반 표현이 없어도, 목표를 나타내는 단서가 있으면 저장 후보로 삼는다.
  // 단, "오늘만/이번만"처럼 명시적으로 일회성인 경우만 제외한다(마감 기한 "2달 안에"는 목표의 일부).
  if (['objective', 'goal', 'project'].includes(memory.category)) {
    const goalCue = /(목표|자격증|자격|면허|시험|합격|취득|따야|따려|딸|준비|공부|도전|이루|취업|이직|입대|지원|진학|들어갈|예정|계획|연구|프로젝트|캡스톤|해커톤|담당|하고\s*싶)/;
    const strictOneOff = /(오늘만|이번만|지금\s*당장만)/;
    return goalCue.test(text) && !strictOneOff.test(text);
  }

  // 식이 성향/제약(채식·비건·알레르기·특정 음식 회피)은 그 자체로 지속되는 개인 사실이다.
  // 규칙이 이미 실제 식이 신호를 확인했으므로, "저는/평소" 없이 "비건이에요"만 있어도 저장한다.
  // 다만 "오늘/이번"처럼 일회성으로 말한 경우는 제외한다.
  if (memory.label === '음식 취향') {
    return !oneOffCue.test(text);
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
    const explicitOwnership = /(보유|가지고\s*있|(?:이|가|를)\s*있(?:어|습니다|다))/ .test(text);
    return (durableCue.test(text) || explicitOwnership) && !oneOffCue.test(text);
  }

  // 반복 일정·근무·통학과 관계 정보는 표현 자체에 지속성이 있다.
  if (memory.category === 'routine') {
    return /(매일|매주|매달|평일|주말|근무|통학|통근|복용|마다|생활\s*패턴)/.test(text) && !oneOffCue.test(text);
  }
  if (memory.category === 'relationship') {
    return /(함께\s*(?:살|거주)|키우|반려)/.test(text) && !oneOffCue.test(text);
  }

  // 명시적인 도구 사용·시험 점수·디지털 어려움은 주어가 생략돼도 현재 역량 사실이다.
  if (memory.category === 'capability') {
    const capabilityAssertion = /(?:사용|쓰고|활용|다룰|할\s*줄|설치.{0,6}(?:어렵|어려|힘들|못)|점(?:이야|이에요|입니다|임)?|등급|AL|IH|IM[123]?|IL)/i;
    return capabilityAssertion.test(text) && !oneOffCue.test(text);
  }

  // 취향·목표·배경은 자기 사실로 표현됐을 때만 저장 후보가 된다.
  return durableCue.test(text) && !oneOffCue.test(text);
}

function normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/[^0-9a-z가-힣]/gi, '');
}

const SECRET_PATTERN = /(?:비밀\s*번호|패스워드|password|api[_\s-]*key|access[_\s-]*token|refresh[_\s-]*token|인증\s*코드|복구\s*코드|주민(?:등록)?번호|카드\s*번호|계좌\s*번호|보안\s*코드|cvv|cvc)/i;
const SENSITIVE_PATTERN = /(?:건강|질환|진단|복용|알레르|알러지|불내증|당뇨|고혈압|천식|셀리악|장애|휠체어|목발|보행|무릎|허리|관절|저염|무염)/i;

function containsSecret(text: string): boolean {
  return SECRET_PATTERN.test(text);
}

function requiresSensitiveHandling(memory: Pick<ExtractedMemory, 'label' | 'content' | 'sourceQuote'>): boolean {
  return SENSITIVE_PATTERN.test([memory.label, memory.content, memory.sourceQuote || ''].join(' '));
}

/**
 * LLM 2가 보기 전에는 의미·장기성을 정규식으로 판정하지 않는다.
 * 여기서는 모델 판단에 맡길 수 없는 기밀 및 명백한 타인 건강정보만 차단한다.
 */
function passesHardMemorySafety(query: string, memory: ExtractedMemory): boolean {
  const evidence = (memory.sourceQuote || query).trim();
  if (memory.privacyLevel === 'confidential') return false;
  if (containsSecret([evidence, memory.label, memory.content].join(' '))) return false;

  if (requiresSensitiveHandling(memory) && ['hard_limit', 'constraint'].includes(memory.category)) {
    const thirdPartySubject = /(엄마|아빠|어머니|아버지|부모님|친구|동생|형|누나|언니|오빠|남편|아내|배우자|아들|딸|할머니|할아버지|환자|지인)\s*(?:은|는|이|가|께서)/.test(evidence);
    const selfCue = /(저는|나는|제가|내\s|나의|제\s|평소|항상|만성)/.test(evidence);
    if (thirdPartySubject && !selfCue) return false;
    const personalAssertion = selfCue ||
      /(?:있|앓|진단|복용|먹|챙겨|사용|이용|다니|다녀|짚|보기|읽기|못\s*(?:먹|걷|걸)|안\s*(?:좋|보)|불편|아프|아파|어렵|어려|힘들|필요)\S*/.test(evidence);
    // 질환 이름을 질문에 언급한 것만으로 사용자의 건강정보를 만들지 않는다.
    if (!personalAssertion) return false;
  }
  return true;
}

/** 라벨이 아니라 실제 의미축+내용으로 구분해 같은 종류의 여러 사실을 보존한다. */
export function memoryFingerprint(memory: ExtractedMemory): string {
  return `${canonicalCategory(memory.category)}|${normalize(memory.semanticGroup)}|${normalize(memory.content)}`;
}

/** 런타임 LLM 출력의 타입·길이·필드를 방어적으로 정리한다. */
export function sanitizeExtractedMemory(value: unknown): ExtractedMemory | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const category = String(raw.category || '') as ContextCategory;
  const privacyLevel = String(raw.privacyLevel || '') as PrivacyLevel;
  const label = String(raw.label || '').trim().slice(0, 60);
  const content = String(raw.content || '').trim().replace(/\s+/g, ' ').slice(0, 240);
  if (!label || !content || !ALLOWED_CATEGORIES.has(category)) return null;
  if (!['normal', 'sensitive', 'confidential'].includes(privacyLevel)) return null;
  const sanitized: ExtractedMemory = {
    label,
    title: String(raw.title || label).trim().slice(0, 60) || label,
    category,
    content,
    privacyLevel,
    tags: Array.isArray(raw.tags)
      ? raw.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 8)
      : [],
    semanticGroup: String(raw.semanticGroup || category).trim().slice(0, 60) || category,
    sourceQuote: typeof raw.sourceQuote === 'string' ? raw.sourceQuote.trim().slice(0, 240) : undefined,
    operation: raw.operation === 'UPDATE' ? 'UPDATE' : 'CREATE',
    updateTargetId: typeof raw.updateTargetId === 'string' ? raw.updateTargetId : undefined,
  };
  // 비밀번호·토큰 등은 privacyLevel을 모델이 normal로 잘못 반환해도 폐기한다.
  if (containsSecret([sanitized.label, sanitized.content, sanitized.sourceQuote || ''].join(' '))) return null;
  // 건강·장애·접근성은 모델 판단과 무관하게 최소 sensitive를 강제한다.
  if (requiresSensitiveHandling(sanitized)) sanitized.privacyLevel = 'sensitive';
  return sanitized;
}

/**
 * LLM+규칙 결과를 합친다. 의미·장기성 판정은 LLM 2가 담당하고,
 * 이 단계는 스키마·하드 안전·중복만 검사해 후보를 미리 잃지 않는다.
 */
export function selectMemoryCandidates(
  query: string,
  existing: ContextItem[],
  inputs: ExtractedMemory[],
): ExtractedMemory[] {
  const selected: ExtractedMemory[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const memory = sanitizeExtractedMemory(input);
    if (!memory || !passesHardMemorySafety(query, memory)) continue;

    // 점수·거주지·근무 형태처럼 한 슬롯에 최신값 하나가 맞는 정보는 CREATE가 아니라 UPDATE로 표시한다.
    // 같은 값이면 중복으로 제거하고, 값이 달라졌으면 기존 카드 ID를 유지해 승인 시 교체한다.
    const replaceableLabels = new Set(['어학 성적', '거주지', '근무 형태', '언어 선호', '통학·통근', '디지털 활용']);
    const target = replaceableLabels.has(memory.label)
      ? existing.find((item) => canonicalCategory(item.category) === canonicalCategory(memory.category) && normalize(item.title) === normalize(memory.title))
      : undefined;
    if (target) {
      const comparable = { ...memory, content: target.content };
      if (sameMemory(memory, comparable)) continue;
      memory.operation = 'UPDATE';
      memory.updateTargetId = target.id;
    } else {
      if (isDuplicate(memory, existing)) continue;
      memory.operation = 'CREATE';
    }
    const key = memoryFingerprint(memory);
    if (
      seen.has(key) ||
      selected.some((prior) => sameMemory(prior, memory) || sameEvidence(prior, memory))
    ) continue;
    seen.add(key);
    selected.push(memory);
    if (selected.length >= MAX_MEMORY_CANDIDATES) break;
  }
  return selected;
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
 * 제목이 같아도 내용이 다르면 별도 사실이다. 제목만으로 중복 처리하면 알레르기·목표 등
 * 같은 종류의 여러 정보를 하나밖에 저장하지 못하므로 실제 내용만 비교한다.
 */
export function isDuplicate(extracted: ExtractedMemory, existing: ContextItem[]): boolean {
  return existing.some((item) => {
    return sameMemory(extracted, {
      label: item.title,
      title: item.title,
      category: item.category,
      content: item.content,
      privacyLevel: item.privacyLevel,
      tags: item.tags,
      semanticGroup: item.title,
    });
  });
}

function sameMemory(left: ExtractedMemory, right: ExtractedMemory): boolean {
  if (canonicalCategory(left.category) !== canonicalCategory(right.category)) return false;
  const a = normalize(left.content);
  const b = normalize(right.content);
  return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
}

/** 같은 발화 조각에서 나온 같은 의미축 후보는 LLM의 선행 후보 하나만 보존한다. */
function sameEvidence(left: ExtractedMemory, right: ExtractedMemory): boolean {
  if (canonicalCategory(left.category) !== canonicalCategory(right.category)) return false;
  const a = normalize(left.sourceQuote || '');
  const b = normalize(right.sourceQuote || '');
  return a.length >= 4 && a === b;
}

export function toCandidate(
  extracted: ExtractedMemory,
  userId: string,
  profileId: string,
): MemoryCandidate & { userId: string; profileId: string; blueprint: ExtractedMemory } {
  const { sourceQuote: _sourceQuote, ...blueprint } = extracted;
  return {
    id: blueprint.updateTargetId || randomUUID(),
    label: extracted.label,
    category: extracted.category,
    content: extracted.content,
    privacyLevel: extracted.privacyLevel,
    status: 'PENDING',
    operation: extracted.operation || 'CREATE',
    updateTargetId: extracted.updateTargetId,
    userId,
    profileId,
    blueprint,
  };
}

export function blueprintToContext(blueprint: ExtractedMemory): ContextItem {
  return {
    // context_cards.id는 Postgres uuid 컬럼이다. 'ctx-' 같은 접두사를 붙이면
    // Supabase insert가 "invalid input syntax for type uuid"로 실패한다(데모 모드는
    // JS Map이라 통과해 회귀가 숨는다). 반드시 순수 UUID여야 한다.
    id: blueprint.updateTargetId || randomUUID(),
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
