import { ContextItem, EvaluatedContext } from '../types.js';
import type { RelevanceOverride } from './proposalStore.types.js';

/**
 * Context Bridge v20 — 2단계 선별 엔진 (Retrieve → Rank → Reconcile)
 *
 * 설계 원칙 (v19 대비 변경점):
 *  1. 고정 의도 분류(learning_plan/outing_plan …) 및 도메인 키워드 정규식 표를 제거.
 *     질문을 미리 정한 버킷에 넣지 않고, 질문과 카드의 "실제 토큰/의미"만 비교한다.
 *  2. 결정론 규칙을 '최종 판정자'가 아니라 'recall 필터 + 안전망'으로 강등한다.
 *     - recall 필터: 값싸게 후보(shortlist)를 만든다. 재현율만 책임진다.
 *     - 정밀도(must/should/optional/ignore 최종 판정)는 semantic ranker(LLM)가 맡는다.
 *     - LLM이 없거나 실패하면 결정론 reconciler가 그대로 최종 판정까지 수행한다(폴백).
 *  3. category 우선순위는 '도메인 하드코딩'이 아니라 '누락 비용' 기반 정책이다.
 *     hard_limit/constraint는 어긋나면 답변이 실패하므로 recall floor를 보장한다.
 *  4. 하드리밋 안전망: ranker가 하드리밋을 낮은 확신으로 버리면 결정론 층이 되살린다.
 *     → 치명적 누락률을 0에 수렴시킨다.
 *  5. 과선별 제어: should_use 상한(질문 복잡도 비례)을 두고 초과분은 optional로 강등한다.
 *
 * 정책(confidential 차단·비활성·stale)은 이 파일이 아니라 core.evaluateContexts가 최종
 * 집행한다. 이 엔진은 '허용된 후보 안에서의 관련성/역할'만 결정한다.
 */

export type SelectionRole = 'must_use' | 'should_use' | 'optional' | 'ignore';

export interface QueryPlan {
  taskType: string;
  userGoal: string;
  requiredFactors: string[];
  responsePlan: string[];
  desiredOutcome?: string;
  currentDecision?: string;
  necessaryConditions?: string[];
  riskDomains?: string[];
  timeHorizon?: string;
  accessibilityOrSafety?: string[];
}

export interface RankedCard {
  id: string;
  role: SelectionRole;
  /** 0~100, 답변 결과 변화량 기준 */
  score: number;
  /** 0~100, 판정 확신도 */
  confidence: number;
  reason?: string;
  impact?: string;
}

export interface RankerInput {
  query: string;
  /** recall 필터가 통과시킨 후보만 랭커에 전달한다(비용·정확도 최적화). */
  candidates: Array<Pick<ContextItem, 'id' | 'category' | 'title' | 'content' | 'tags' | 'privacyLevel'>>;
}

export interface RankerOutput {
  detectedIntent: string;
  questionPlan: QueryPlan;
  cards: RankedCard[];
  suggestedAdditions: string[];
}

/** Semantic ranker 포트. prod=Gemini, test=결정론 목. 없으면 결정론 폴백을 쓴다. */
export type SemanticRanker = (input: RankerInput) => Promise<RankerOutput | undefined>;

export interface SelectionResult {
  overrides: Map<string, RelevanceOverride>;
  detectedIntent: string;
  questionPlan: QueryPlan;
  suggestedAdditions: string[];
  /** 관측용 진단. 어떤 경로로 선별했는지, 안전망이 몇 번 개입했는지 등. */
  diagnostics: {
    mode: 'query-structured-hybrid' | 'local-hybrid';
    vaultCount: number;
    shortlistCount: number;
    safetyNetRescues: number;
    overSelectionTrims: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 한국어 인지형 경량 토크나이저 (외부 의존성 없음, 도메인 사전 없음)
// ─────────────────────────────────────────────────────────────────────────────

/** 문법적 조사 + 고빈도 용언 어미를 벗긴다. 도메인 단어가 아니라 언어 정규화다. */
const JOSA = [
  // 조사
  '으로써', '으로서', '에게서', '이라고', '라고', '에서', '에게', '으로', '까지', '부터',
  '처럼', '만큼', '보다', '한테', '이나', '나마', '조차', '마저', '밖에', '이란', '이든',
  '으론', '들', '은', '는', '이', '가', '을', '를', '과', '와', '도', '만', '의', '에', '로',
  '랑', '이랑', '든지', '거나',
  // 용언 어미(걷는데→걷, 배울→배우 등 최소한의 활용 정규화)
  '는데', '니까', '어서', '아서', '으면', '지만', '다가', '으니', '어요', '아요',
  '해요', '해서', '하고', '하는', '려고', '으려', '자', '음',
];

/** 도메인 무관 기능어(내용을 담지 않는 말)만 제거한다. */
const STOPWORDS = new Set([
  '그리고', '그런데', '하지만', '그래서', '어떻게', '무엇', '뭐가', '뭘', '좀', '해줘', '알려줘',
  '알려', '해주', '하는', '있는', '있어', '없어', '해야', '할까', '한지', '이번', '지금', '오늘',
  '내가', '나는', '제가', '저는', '너무', '정말', '진짜', '그냥', '거의', '요즘', '요새',
]);

function normalize(text: string): string {
  return (text || '')
    .toLocaleLowerCase()
    .replace(/[^0-9a-z가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stem(token: string): string {
  // 한글 토큰에서 뒤쪽 조사를 한 번만 벗긴다(과다 절단 방지).
  if (!/[가-힣]$/.test(token)) return token;
  for (const j of JOSA) {
    if (token.length > j.length + 1 && token.endsWith(j)) {
      return token.slice(0, token.length - j.length);
    }
  }
  return token;
}

/**
 * 고빈도 한국어 형태 정규화(동의 접기). 도메인 의도 사전이 아니라, 같은 개념의
 * 서로 다른 표기를 한 표제어로 모으는 형태론 처리다(예: '걷다'와 '보행'은 같은 개념).
 * 의도적으로 소수(신체·행위·비용)만 둔다. 나머지 의미 다리는 LLM 랭커가 담당한다.
 */
const SYNONYM: Record<string, string> = {
  걷: '보행', 걸음: '보행', 걸어: '보행', 걸을: '보행',
  값: '비용', 돈: '비용', 가격: '비용', 요금: '비용',
  먹: '식사', 식당: '음식점', 맛집: '음식점',
  조용: '정숙', 조용한: '정숙', 소음: '정숙', 한적한: '정숙',
  버스: '대중교통', 지하철: '대중교통',
  집: '생활권', 동네: '생활권', 근처: '생활권', 주변: '생활권',
  거주: '생활권', 주거: '생활권',
};

function fold(token: string): string {
  return SYNONYM[token] || token;
}

export function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of normalize(text).split(' ')) {
    if (raw.length < 2) continue;
    if (STOPWORDS.has(raw)) continue;
    const s = fold(stem(raw));
    if (s.length >= 2 && !STOPWORDS.has(s)) out.add(s);
    // 합성어 내부의 접힘 표제어도 노출('못걷' 같은 결합 대비 원형도 보존)
    const inner = fold(raw);
    if (inner !== s && inner.length >= 2) out.add(inner);
  }
  return out;
}

function charBigrams(text: string): Set<string> {
  const compact = normalize(text).replace(/\s/g, '');
  const out = new Set<string>();
  for (let i = 0; i < compact.length - 1; i++) out.add(compact.slice(i, i + 2));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. recall 필터 — 값싸게 shortlist를 만든다. 재현율만 책임진다.
//    (도메인 키워드 표 없음. 카드 자기 텍스트 vs 질문 토큰만 본다.)
// ─────────────────────────────────────────────────────────────────────────────

/** 누락 비용 기반 category 정책. 도메인이 아니라 '틀리면 답변이 실패하는 정도'다. */
function missCostFloor(category: string): number {
  if (category === 'hard_limit' || category === 'constraint') return 8;
  if (category === 'soft_limit' || category === 'resource' || category === 'current_state') return 8;
  if (category === 'objective' || category === 'goal' || category === 'capability') return 6;
  return 0; // identity/preference/routine/relationship/project 등은 어휘 신호로만 승부
}

export interface RecallScored {
  item: ContextItem;
  recall: number;
  lexicalHit: boolean;
  /** 구조적 co-activation으로만 올라온 카드인지(어휘 근거 없음). reconcile 확신도에 반영. */
  coActivatedOnly: boolean;
}

const RECALL_ENTRY_THRESHOLD = 15; // shortlist 진입 최소 recall
export const SHORTLIST_CAP = 14;
const ANCHOR_LEXICAL = 22; // 이 이상 어휘 점수면 '앵커'(질문이 실제로 이 카드를 가리킴)

type AnchorMode = 'achieve' | 'experience';

/** 앵커 카드들의 category로 질문의 구조적 성격을 판단한다(도메인 무관). */
function anchorMode(anchorCategories: string[]): AnchorMode {
  // 목표·능력·프로젝트·자원을 직접 가리키면 '성취형' 질문(무엇을 이룰지/실행할지).
  // 자원(시간·예산·도구)은 대개 무언가를 '하기 위해' 언급되므로 성취형으로 본다.
  return anchorCategories.some((c) => ['objective', 'goal', 'capability', 'project', 'resource'].includes(c))
    ? 'achieve'
    : 'experience'; // 장소·상태·취향만 가리키면 '경험형'(무엇을 겪을지) 질문.
}

/**
 * 구조적 co-activation. 도메인 사전이 아니라 'category 그래프' 추론이다.
 * 어떤 행동이든 제약(limit)·가용 자원(resource)은 항상 확인해야 하고,
 * '성취형' 질문은 추가로 능력(난이도)·목표(성공 기준)를 커플링한다.
 * 학습·외출·요리 등 어떤 도메인에서도 동일하게 성립한다.
 */
function coActivationBoost(category: string, mode: AnchorMode): number {
  switch (category) {
    case 'hard_limit':
    case 'constraint': return 34;                       // 제약은 항상
    case 'resource': return 32;                         // 실행 가능성은 항상
    case 'soft_limit': return 22;
    case 'current_state': return 20;
    case 'preference': return 16;                       // 출력 형식은 대체로 적용(약하게)
    case 'capability': return mode === 'achieve' ? 30 : 0; // 난이도는 성취형에서만
    case 'objective':
    case 'goal': return mode === 'achieve' ? 30 : 0;    // 성공 기준은 성취형에서만
    default: return 0;                                  // identity/routine/relationship: 자체 어휘 필요
  }
}

function lexicalScore(qTokens: Set<string>, qBigrams: Set<string>, item: ContextItem): number {
  const full = `${item.title} ${item.content} ${(item.tags || []).join(' ')}`;
  const cTokens = contentTokens(full);
  let lexical = 0;
  for (const t of qTokens) {
    if (cTokens.has(t)) lexical += 26; // 정확한 내용 토큰 겹침
    else for (const c of cTokens) {
      if ((c.length >= 3 && c.includes(t)) || (t.length >= 3 && t.includes(c))) { lexical += 12; break; }
    }
  }
  const bigram = jaccard(qBigrams, charBigrams(full)) * 45; // 어미 차이 백오프
  return lexical + bigram;
}

export function recallShortlist(query: string, contexts: ContextItem[], plan?: QueryPlan): RecallScored[] {
  const qTokens = contentTokens(query);
  const qBigrams = charBigrams(query);

  // 1단계: 순수 어휘 점수.
  const lex = contexts.map((item) => ({ item, lexical: lexicalScore(qTokens, qBigrams, item) }));
  // 2단계: 앵커 탐지 → 질문이 '성취형'인지 '경험형'인지 구조적으로 판단.
  const anchors = lex.filter((l) => l.lexical >= ANCHOR_LEXICAL);
  const hasAnchor = anchors.length > 0;
  const mode = anchorMode(anchors.map((a) => a.item.category));

  const riskTokens = contentTokens([
    ...(plan?.riskDomains || []),
    ...(plan?.accessibilityOrSafety || []),
    ...(plan?.necessaryConditions || []),
  ].join(' '));
  const scored: RecallScored[] = lex.map(({ item, lexical }) => {
    const cardTokens = contentTokens(`${item.title} ${item.content} ${(item.tags || []).join(' ')}`);
    let riskOverlap = 0;
    for (const token of riskTokens) if (cardTokens.has(token)) riskOverlap += 26;
    const prior =
      ['hard_limit', 'constraint'].includes(item.category) ? 8 :
      ['resource', 'capability', 'objective', 'goal', 'soft_limit', 'current_state'].includes(item.category) ? 5 : 2;
    // 앵커가 있을 때만 co-activation을 적용한다(무관 질문에는 발동 안 함 → 과선별 억제).
    const critical = ['hard_limit', 'constraint'].includes(item.category);
    const coact = critical
      ? (riskOverlap > 0 ? coActivationBoost(item.category, mode) : 0)
      : (hasAnchor ? coActivationBoost(item.category, mode) : 0);
    const relevantCriticalBoost =
      ['hard_limit', 'constraint'].includes(item.category) && riskOverlap > 0 ? 38 : 0;
    const recall = Math.min(100, 6 + lexical + riskOverlap + relevantCriticalBoost + prior + coact);
    return {
      item,
      recall,
      lexicalHit: lexical > 0,
      coActivatedOnly: lexical < ANCHOR_LEXICAL && coact > 0,
    };
  });

  const selectable = (s: RecallScored) => s.item.privacyLevel !== 'confidential' && s.item.isActive;
  const restAll = scored.filter(selectable).sort((a, b) => b.recall - a.recall);

  // 재현율 우선 원칙: shortlist 상한(=페이로드 경계) 안에서는 문턱 없이 전부 통과시킨다.
  //   후보를 버리는 순간 랭커는 그 카드를 영원히 못 본다 → 재현율 상한이 recall 필터에
  //   묶여버린다. 정밀도는 랭커(또는 결정론 reconcile의 점수→역할 매핑)가 책임진다.
  //   상한을 초과할 때만(대형 vault) 문턱을 적용해 노이즈 꼬리를 잘라 비용을 지킨다.
  // 일반적인 소형 프로필(14장 이하)은 전부 LLM 랭커에 보여 의미 누락을 막는다.
  // 대형 Vault에서만 lexical recall로 상한을 적용해 비용을 제한한다.
  const rest = restAll.length <= SHORTLIST_CAP
    ? restAll
    : restAll.filter((s) => s.recall >= RECALL_ENTRY_THRESHOLD).slice(0, SHORTLIST_CAP);
  return rest;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. reconciler — 랭커 출력(or recall)을 최종 역할로 확정한다.
//    안전망 + 과선별 제어 + 결정론 폴백을 여기서 한다.
// ─────────────────────────────────────────────────────────────────────────────

function roleFromScore(score: number): SelectionRole {
  if (score >= 78) return 'must_use';
  if (score >= 40) return 'should_use';
  if (score >= 26) return 'optional';
  return 'ignore';
}

const VALID_ROLES = new Set<SelectionRole>(['must_use', 'should_use', 'optional', 'ignore']);
const SAFETY_NET_CONFIDENCE = 60;

interface ReconcileOpts {
  /** 질문 복잡도. requiredFactors 수에 비례해 should_use 상한을 정한다. */
  complexity: number;
}

/**
 * 후보(shortlist)에 대한 랭커 결과 Map을 받아, 전체 카드에 대한 최종 override를 만든다.
 * ranked가 없으면(LLM 폴백) recall 점수를 그대로 역할로 매핑한다.
 */
export function reconcile(
  query: string,
  contexts: ContextItem[],
  shortlist: RecallScored[],
  ranked: Map<string, RankedCard> | undefined,
  opts: ReconcileOpts,
): { overrides: Map<string, RelevanceOverride>; safetyNetRescues: number; overSelectionTrims: number } {
  const shortById = new Map(shortlist.map((s) => [s.item.id, s]));
  const overrides = new Map<string, RelevanceOverride>();
  let safetyNetRescues = 0;

  for (const item of contexts) {
    const sl = shortById.get(item.id);
    // 소형 프로필에서는 재현율을 위해 모든 카드를 랭커에 보여주지만, 어휘·위험 근거가
    // 없는 제약까지 안전망으로 되살리지는 않는다.
    const isCritical =
      ['hard_limit', 'constraint'].includes(item.category) &&
      Boolean(sl) &&
      sl!.recall >= RECALL_ENTRY_THRESHOLD;

    // shortlist에 없으면 recall 미달 → ignore. (critical은 항상 shortlist에 있음)
    if (!sl) {
      overrides.set(item.id, {
        score: 0,
        role: 'ignore',
        reason: `질문에 답하는 데 '${item.title}' 정보의 직접 기여도가 낮아 후보에서 제외했습니다.`,
        confidence: 70,
      });
      continue;
    }

    const r = ranked?.get(item.id);
    let score = r && Number.isFinite(r.score)
      ? Math.max(0, Math.min(100, Math.round(r.score)))
      : Math.round(sl.recall);
    let role: SelectionRole = r && VALID_ROLES.has(r.role) ? r.role : roleFromScore(score);
    let confidence = r && Number.isFinite(r.confidence)
      ? Math.max(0, Math.min(100, Math.round(r.confidence)))
      : (sl.lexicalHit ? 62 : 45);
    let reason = r?.reason;
    let impact = r?.impact;

    // 점수와 역할이 충돌하면 더 보수적인 역할로 보정한다.
    // LLM이 약한 연관을 관대하게 should_use로 주는 과선별을 줄이되,
    // 높은 점수의 순수 의미 연결은 보존한다.
    if (ranked) {
      if (role === 'must_use' && score < 70) role = score >= 45 ? 'should_use' : 'optional';
      if (role === 'should_use' && score < 45) role = score >= 26 ? 'optional' : 'ignore';
    }
    // ── 하드리밋 안전망: 낮은 확신으로 버린 필수 조건은 사용자 확인 후보로 유지한다.
    // 높은 확신의 무관 판정까지 모두 되살리면 모든 질문에 건강 카드가 나타나는 역효과가 난다.
    if (isCritical && role === 'ignore' && confidence < SAFETY_NET_CONFIDENCE) {
      role = 'optional';
      score = Math.max(score, 30);
      reason = reason
        ? `${reason} (안전망: 위반 시 답변이 실패할 수 있어 확인 후보로 유지)`
        : `'${item.title}'은(는) 반드시 지켜야 할 조건이라, 관련성이 낮게 판정돼도 확인 후보로 유지합니다.`;
      confidence = Math.max(confidence, 55);
      safetyNetRescues++;
    }

    overrides.set(item.id, { score, role, confidence, reason, impact });
  }

  // ── co-activation 정밀도 제어: 어휘 근거 없이 구조적으로만 올라온 should_use는
  //    결정론이 '진짜 관련 resource(공부시간)'와 '무관 resource(이동수단)'를 구분할 수
  //    없다. 따라서 category 결정도 순으로 소수만 should_use로 유지하고 나머지는 optional.
  //    (LLM 랭커가 붙으면 이 경로는 타지 않는다 — 랭커가 의미로 구분하므로.)
  let overSelectionTrims = 0;
  if (!ranked) {
    const crit = (cat: string) =>
      cat === 'hard_limit' || cat === 'constraint' ? 5 :
      cat === 'resource' ? 4 : cat === 'capability' ? 3 :
      cat === 'objective' || cat === 'goal' ? 2 : cat === 'soft_limit' ? 1 : 0;
    const contextById0 = new Map(contexts.map((c) => [c.id, c]));
    const coActShould = [...overrides.entries()]
      .filter(([id, o]) => o.role === 'should_use' && shortById.get(id)?.coActivatedOnly)
      .sort((a, b) => {
        const ca = crit(contextById0.get(a[0])?.category || '');
        const cb = crit(contextById0.get(b[0])?.category || '');
        return cb - ca || (b[1].score ?? 0) - (a[1].score ?? 0);
      });
    const COACT_KEEP = 4;
    for (const [id, o] of coActShould.slice(COACT_KEEP)) {
      if (['hard_limit', 'constraint'].includes(contextById0.get(id)?.category || '') && shortById.has(id)) continue;
      overrides.set(id, {
        ...o,
        role: 'optional',
        reason: `${o.reason || ''} (정밀도 제어: 어휘 근거가 약해 보조 후보로 이동)`.trim(),
      });
      overSelectionTrims++;
    }
  }

  // ── 과선별 제어: must_use + should_use가 상한을 넘으면 하위를 optional로 강등.
  //    상한 = 질문 복잡도에 따라 3~6개. requiredFactors를 그대로 더하면 LLM이
  //    요인을 많이 적을수록 상한이 느슨해지는 자기증폭 문제가 있어 완만하게 증가시킨다.
  const cap = ranked
    ? Math.min(5, Math.max(3, 2 + Math.ceil(opts.complexity / 3)))
    : Math.max(4, 4 + opts.complexity);
  const primaries = [...overrides.entries()]
    .filter(([, o]) => o.role === 'must_use' || o.role === 'should_use')
    .sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0) || (b[1].confidence ?? 0) - (a[1].confidence ?? 0));

  if (primaries.length > cap) {
    const contextById = new Map(contexts.map((c) => [c.id, c]));
    for (const [id, o] of primaries.slice(cap)) {
      if (o.role === 'must_use') continue; // must는 강등 안 함
      if (['hard_limit', 'constraint'].includes(contextById.get(id)?.category || '') && shortById.has(id)) continue;
      overrides.set(id, {
        ...o,
        role: 'optional',
        reason: `${o.reason || ''} (과선별 제어: 더 결정적인 맥락 우선, 보조 후보로 이동)`.trim(),
      });
      overSelectionTrims++;
    }
  }

  return { overrides, safetyNetRescues, overSelectionTrims };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 오케스트레이터 — 입력분석 → recall → rank → reconcile
// ─────────────────────────────────────────────────────────────────────────────

/** LLM 없이도 동작하는 최소 질문 계획(도메인 분류 없이 구조만). */
export function structureQuestion(query: string): QueryPlan {
  const q = query.trim();
  const timeMatches = q.match(/(?:오늘|내일|이번\s*주|이번\s*달|\d+\s*(?:일|주|개월|시간|분))/g) || [];
  const access = contentTokens(q);
  const accessibilityOrSafety = [...access].filter((token) =>
    ['보행', '이동', '건강', '안전', '알레르기', '장애', '복용'].some((cue) => token.includes(cue)),
  );
  const outingRisk = /(갈\s*만한|어디\s*갈|어디\s*가면|외출|나들이|여행|장소|추천)/i.test(q)
    ? ['이동', '교통', '예산', '장소']
    : [];
  const riskDomains = [
    ...accessibilityOrSafety,
    ...[...access].filter((token) => ['예산', '비용', '시간', '교통'].some((cue) => token.includes(cue))),
    ...outingRisk,
  ];
  return {
    taskType: 'open_domain',
    userGoal: q,
    requiredFactors: [],
    responsePlan: ['질문에 직접 답하기', '승인된 맥락만 반영', '실행 가능한 다음 단계 제시'],
    desiredOutcome: q,
    currentDecision: q,
    necessaryConditions: riskDomains,
    riskDomains,
    timeHorizon: timeMatches.join(', ') || '명시되지 않음',
    accessibilityOrSafety,
  };
}

function deterministicPlan(query: string, shortlist: RecallScored[]): QueryPlan {
  const factors = shortlist
    .filter((s) => s.recall >= RECALL_ENTRY_THRESHOLD)
    .slice(0, 6)
    .map((s) => s.item.title);
  return {
    ...structureQuestion(query),
    requiredFactors: factors,
  };
}

/** LLM 없이 동작하는 결정론 선별(동기). core 폴백과 오프라인 데모가 공유한다. */
export function selectDeterministic(query: string, contexts: ContextItem[]): SelectionResult {
  const q = query.trim();
  const basePlan = structureQuestion(q);
  const shortlist = recallShortlist(q, contexts, basePlan);
  const plan = deterministicPlan(q, shortlist);
  const { overrides, safetyNetRescues, overSelectionTrims } = reconcile(
    q, contexts, shortlist, undefined, { complexity: plan.requiredFactors.length },
  );
  return {
    overrides,
    detectedIntent: '질문과 카드의 실제 내용을 토큰·의미 기준으로 비교해 필요한 맥락만 선별했습니다.',
    questionPlan: plan,
    suggestedAdditions: [],
    diagnostics: {
      mode: 'local-hybrid',
      vaultCount: contexts.length,
      shortlistCount: shortlist.length,
      safetyNetRescues,
      overSelectionTrims,
    },
  };
}

export async function selectContexts(
  query: string,
  contexts: ContextItem[],
  ranker?: SemanticRanker,
): Promise<SelectionResult> {
  const q = query.trim();
  const shortlist = recallShortlist(q, contexts, structureQuestion(q));

  // LLM 랭커 호출(있으면). shortlist만 전달 → 페이로드/비용/정확도 최적화.
  let rankerOut: RankerOutput | undefined;
  if (ranker && shortlist.length) {
    try {
      rankerOut = await ranker({
        query: q,
        candidates: shortlist.map((s) => ({
          id: s.item.id,
          category: s.item.category,
          title: s.item.title,
          // 사용자가 등록한 민감 카드도 선별 LLM은 실제 의미를 읽는다.
          // confidential은 recall 단계에서 이미 완전히 제외된다.
          content: s.item.content,
          tags: s.item.tags,
          privacyLevel: s.item.privacyLevel,
        })),
      });
    } catch {
      rankerOut = undefined;
    }
  }

  // 랭커가 없거나 실패하면 결정론 폴백을 그대로 쓴다.
  if (!rankerOut) return selectDeterministic(q, contexts);

  const rankedMap = new Map(
    rankerOut.cards.filter((c) => shortlist.some((s) => s.item.id === c.id)).map((c) => [c.id, c]),
  );
  const plan = rankerOut.questionPlan;
  const { overrides, safetyNetRescues, overSelectionTrims } = reconcile(
    q, contexts, shortlist, rankedMap, { complexity: plan.requiredFactors.length },
  );

  return {
    overrides,
    detectedIntent: rankerOut.detectedIntent,
    questionPlan: plan,
    suggestedAdditions: rankerOut.suggestedAdditions?.slice(0, 3) || [],
    diagnostics: {
      mode: 'query-structured-hybrid',
      vaultCount: contexts.length,
      shortlistCount: shortlist.length,
      safetyNetRescues,
      overSelectionTrims,
    },
  };
}

/**
 * core.evaluateContexts와 호환되는 형태로 override Map만 뽑는 헬퍼.
 * (server.ts scoreRelevance 대체용)
 */
export function toOverrideScores(result: SelectionResult): Map<string, RelevanceOverride> {
  return result.overrides;
}

export type { EvaluatedContext };
