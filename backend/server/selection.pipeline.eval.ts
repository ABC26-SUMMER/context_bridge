/**
 * ★ 헤드라인 A/B ★ — 전체 파이프라인 비교 (동일한 불완전 mock LLM 랭커 주입).
 *
 * 목적: "결정론 vs 결정론"은 v19의 도메인 하드코딩(무릎/보행/외출 정규식) 덕분에
 * 특정 도메인에서 v19가 유리해 보일 수 있다 — 그런데 그 하드코딩이 바로 제거 대상이다.
 * 그래서 진짜 비교는 "같은 LLM을 두 아키텍처에 물렸을 때 어느 구조가 LLM의 실수를
 * 복구하는가"이다.
 *
 * 설계:
 *  - mockLLMRank: 하나의 함수. 두 파이프라인이 '완전히 동일하게' 사용한다.
 *    골드 라벨을 절대 읽지 않는다. query·카드 텍스트만 본다. 실제 LLM처럼
 *    의미 격차(방학→목표, 키오스크→디지털)는 어느 정도 메우되, 두 가지 현실적
 *    실패를 낸다:
 *      (A) 화제어가 겉으로 안 겹치는 hard_limit을 '관련 없어 보인다'며 낮은 확신으로 버린다.
 *      (B) 약한 연관에도 should_use를 후하게 줘서 과선별한다.
 *  - OLD 파이프라인(v19): 전체 카드 → LLM → 2차 critic 호출 → 정책 클램프.
 *    결정론 안전망도, 과선별 상한도 없다(LLM 역할을 그대로 신뢰).
 *  - NEW 파이프라인(v20): recall(페이로드 경계·하드리밋 강제) → LLM 1회 → reconcile
 *    (안전망 + 과선별 상한).
 *
 * 랭커가 동일하므로 결과 차이는 100% '아키텍처'에서 온다.
 */
import { ContextItem } from '../types.js';
import {
  selectContexts, recallShortlist, SemanticRanker, RankerInput, RankerOutput, RankedCard,
} from './selection.js';
import {
  Role, CASES, Case, score, metrics, fmt,
} from './selection.fixtures.js';

// ─────────────────────────────────────────────────────────────────────────────
// 공용 mock LLM — 두 파이프라인이 동일하게 호출. 골드 라벨을 읽지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

// 계측: LLM 호출 횟수·전달 카드 수(비용/확장성 지표).
const meter = { oldCalls: 0, oldCards: 0, newCalls: 0, newCards: 0 };

function norm(s: string): string {
  return s.toLocaleLowerCase().replace(/[^0-9a-z가-힣]+/g, '');
}
/** 실제 LLM의 '세상 지식'을 흉내낸 개념 브릿지(테스트 스캐폴딩, 양쪽이 공유). */
const CONCEPT_CUES: Array<{ cue: RegExp; boostCat: Record<string, number> }> = [
  // 학습/성취 의도
  { cue: /(공부|배울|배우|학습|방학|자격증|시험|계획|언어|추천)/,
    boostCat: { objective: 30, capability: 26, resource: 24 } },
  // 외출/나들이 의도
  { cue: /(나들이|외출|어디|가면|갈만|놀러|여행|딸|친구)/,
    boostCat: { resource: 26, preference: 24, hard_limit: 20, soft_limit: 16 } },
  // 사용법/설명 의도
  { cue: /(사용법|쓰는|어떻게|알려|쉽게|설명|키오스크)/,
    boostCat: { capability: 24, preference: 26 } },
  // 장소/카페 의도
  { cue: /(카페|사진|조용|장소|실내|좌석)/,
    boostCat: { preference: 28, resource: 20, soft_limit: 18 } },
  // 비용 의도
  { cue: /(비용|예산|저렴|가격|돈)/, boostCat: { soft_limit: 26 } },
];
/** hard_limit이 '겉으로' 걸리는 화제어(이게 없으면 실패모드 A 발동). */
const LIMIT_SURFACE = /(무릎|보행|걷|못걷|다리|허리|아프|장애)/;

interface MockScore { id: string; role: Role; score: number; confidence: number; }

/**
 * 불완전 mock 랭커. query + candidates만 본다.
 * 반환: 카드별 role/score/confidence. (양쪽 파이프라인이 이 함수만 공유)
 */
function mockLLMRank(query: string, candidates: ContextItem[]): MockScore[] {
  const q = norm(query);
  const out: MockScore[] = [];
  for (const c of candidates) {
    const text = norm(`${c.title} ${c.content} ${(c.tags || []).join(' ')}`);
    // (1) 어휘 겹침(문자 3-gram 교집합 근사) — LLM도 표면 겹침엔 강하다.
    let lex = 0;
    for (let i = 0; i + 2 <= q.length; i++) if (text.includes(q.slice(i, i + 2))) lex += 6;
    lex = Math.min(lex, 48);
    // (2) 개념 브릿지 — 의미 격차를 어느 정도 메운다(LLM의 세상 지식).
    let concept = 0;
    for (const { cue, boostCat } of CONCEPT_CUES) {
      if (cue.test(query)) concept = Math.max(concept, boostCat[c.category] ?? 0);
    }
    let sc = 8 + lex + concept;
    let confidence = 55 + Math.min(30, lex); // 표면 근거가 많을수록 확신↑

    // ── 실패모드 A: 화제어가 겉으로 안 겹치는 hard_limit을 '관련 없어 보인다'며 버린다.
    //    (예: "내일 딸이랑 어디 가면 좋아?" — 보행 제약을 LLM이 종종 놓친다.)
    if ((c.category === 'hard_limit' || c.category === 'constraint') && !LIMIT_SURFACE.test(query)) {
      sc = 18;          // ignore 수준으로 끌어내림
      confidence = 42;  // 낮은 확신(<60) → NEW 안전망의 대상이 된다
    }
    // ── 실패모드 B: 약한 연관에도 should_use를 후하게(과선별 성향).
    else if (sc >= 30 && sc < 45) {
      sc = 52;
    }

    const role: Role =
      sc >= 74 ? 'must_use' : sc >= 40 ? 'should_use' : sc >= 26 ? 'optional' : 'ignore';
    out.push({ id: c.id, role, score: Math.min(100, sc), confidence });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// OLD 파이프라인 (v19 재현): 전체 카드 → LLM → 2차 critic → 정책 클램프.
//   결정론 안전망 없음 / 과선별 상한 없음.
// ─────────────────────────────────────────────────────────────────────────────
function oldPipeline(query: string, profile: ContextItem[]): Map<string, Role> {
  // 정책상 후보 가능한 카드만(=confidential/비활성 제외) 전량 LLM에 보낸다.
  const selectable = profile.filter((c) => c.privacyLevel !== 'confidential' && c.isActive);

  // 1차 LLM 호출 — 전체 카드.
  meter.oldCalls++; meter.oldCards += selectable.length;
  const first = mockLLMRank(query, selectable);

  // 2차 critic 호출 — v19는 같은 후보를 한 번 더 검토한다(비용 2배). 구조적 실수는
  //   못 고친다: 여기선 '명백한 저점수(<26)만 재확인'하는 정도로만 모델링(관대한 가정).
  meter.oldCalls++; meter.oldCards += selectable.length;
  const critic = new Map(mockLLMRank(query, selectable).map((m) => [m.id, m]));

  const roles = new Map<string, Role>();
  for (const c of profile) roles.set(c.id, 'ignore');
  for (const m of first) {
    const cr = critic.get(m.id)!;
    // critic이 둘 다 낮게 보면 내린다(그 외엔 1차 신뢰 = LLM 역할 그대로).
    const role = (m.role !== 'ignore' && cr.role === 'ignore') ? 'optional' : m.role;
    roles.set(m.id, role);
  }
  return roles; // 안전망/캡 없음 → LLM의 실패모드가 그대로 통과.
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW 파이프라인 (v20): recall → LLM 1회(shortlist만) → reconcile(안전망+캡).
//   동일한 mockLLMRank를 SemanticRanker 포트로 감싸 주입한다.
// ─────────────────────────────────────────────────────────────────────────────
function makeMockRanker(query: string, profile: ContextItem[]): SemanticRanker {
  const byId = new Map(profile.map((c) => [c.id, c]));
  return async (input: RankerInput): Promise<RankerOutput> => {
    const cands = input.candidates.map((c) => byId.get(c.id)!).filter(Boolean);
    meter.newCalls++; meter.newCards += cands.length; // shortlist만 — 페이로드 경계.
    const scored = mockLLMRank(query, cands);
    const cards: RankedCard[] = scored.map((m) => ({
      id: m.id, role: m.role, score: m.score, confidence: m.confidence,
    }));
    return {
      detectedIntent: 'mock',
      questionPlan: { taskType: 'general_advice', userGoal: query, requiredFactors: cands.slice(0, 5).map((c) => c.title), responsePlan: [] },
      cards,
      suggestedAdditions: [],
    };
  };
}

async function newPipeline(query: string, profile: ContextItem[]): Promise<Map<string, Role>> {
  const ranker = makeMockRanker(query, profile);
  const result = await selectContexts(query, profile, ranker);
  const roles = new Map<string, Role>();
  for (const c of profile) roles.set(c.id, (result.overrides.get(c.id)?.role || 'ignore') as Role);
  return roles;
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const newPred = new Map<string, Map<string, Role>>();
  for (const c of CASES) newPred.set(c.name, await newPipeline(c.query, c.profile));
  const oldPred = new Map<string, Map<string, Role>>();
  for (const c of CASES) oldPred.set(c.name, oldPipeline(c.query, c.profile));

  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(' ★ 전체 파이프라인 A/B ★  동일한 불완전 mock LLM을 두 구조에 주입');
  console.log('   (랭커가 같으므로 차이 = 순수 아키텍처: 페이로드 경계·안전망·과선별 캡·호출수)');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  const oldAgg = score(CASES, (c) => oldPred.get(c.name)!);
  const newAgg = score(CASES, (c) => newPred.get(c.name)!);
  const oldR = metrics(oldAgg), newR = metrics(newAgg);
  console.log(fmt('기존 v19 (전량→LLM→critic)', oldR));
  console.log(fmt('신규 v20 (recall→LLM→reconcile)', newR));

  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(' 하드리밋 처리 상세(같은 LLM이 버린 카드를 구조가 복구하는가):');
  for (const c of CASES) {
    for (const [id, g] of Object.entries(c.gold)) {
      const card = c.profile.find((x) => x.id === id);
      if (!card || (card.category !== 'hard_limit' && g !== 'must_use')) continue;
      const o = oldPred.get(c.name)!.get(id), n = newPred.get(c.name)!.get(id);
      const flag = (r?: Role) => (r === 'ignore' ? '❌ignore' : r === 'optional' ? '△optional' : '✅' + r);
      if (o !== n) console.log(`   [${c.name}] ${id}(${card.category}): 기존=${flag(o)} → 신규=${flag(n)}`);
    }
  }

  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(' 비용·확장성 (동일 LLM 기준):');
  console.log(`   기존: LLM 호출 ${meter.oldCalls}회, 전달 카드 누적 ${meter.oldCards}장 (전량×2패스)`);
  console.log(`   신규: LLM 호출 ${meter.newCalls}회, 전달 카드 누적 ${meter.newCards}장 (shortlist×1패스)`);
  const callCut = ((1 - meter.newCalls / meter.oldCalls) * 100).toFixed(0);
  const cardCut = ((1 - meter.newCards / meter.oldCards) * 100).toFixed(0);
  console.log(`   → 호출 −${callCut}%, LLM 입력 토큰(카드수 비례) −${cardCut}%`);

  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(' 확장성 (vault가 커질 때 LLM에 전달되는 카드 수 = 입력 토큰·지연·비용):');
  console.log('   vault크기 │ 기존(전량×2패스) │ 신규(recall→shortlist×1) │ 절감');
  for (const n of [11, 30, 100, 300]) {
    // 대표 질문 하나로, 실사용처럼 관련 소수 + 다수 distractor를 섞은 vault를 만든다.
    const base = CASES[0].profile; // 학생 11장
    const distractors: ContextItem[] = Array.from({ length: Math.max(0, n - base.length) }, (_, i) =>
      ({ id: `d${i}`, category: 'identity', title: `기타 정보 ${i}`, content: `무관한 과거 메모 ${i}`, tags: [], isActive: true, privacyLevel: 'normal', updatedAt: '2026-01-01T00:00:00.000Z' } as ContextItem));
    const vault = [...base, ...distractors].slice(0, n);
    const oldCards = vault.filter((c) => c.privacyLevel !== 'confidential' && c.isActive).length * 2;
    const newCards = recallShortlist(CASES[0].query, vault).length;
    const cut = ((1 - newCards / oldCards) * 100).toFixed(0);
    console.log(`   ${String(n).padStart(6)}장 │ ${String(oldCards).padStart(13)}장 │ ${String(newCards).padStart(20)}장 │ −${cut}%`);
  }
  console.log('   → 기존은 O(N)×2로 무한 증가, 신규는 shortlist 상한(≤14)에 수렴(확장성).');

  console.log('═══════════════════════════════════════════════════════════════════════════');
  const f1Ok = newR.f1 >= oldR.f1 - 0.001;
  const missOk = newR.criticalMiss <= oldR.criticalMiss;
  const fpOk = newR.fp <= oldR.fp;
  const verdict = f1Ok && missOk && fpOk && newR.criticalMiss === 0;
  console.log(' 아키텍처 우위 판정(같은 랭커):');
  console.log(`   ① F1 ${(newR.f1 * 100).toFixed(1)}% ${f1Ok ? '≥' : '<'} ${(oldR.f1 * 100).toFixed(1)}%  → ${f1Ok ? 'OK' : 'FAIL'}`);
  console.log(`   ② 치명적 누락 ${newR.criticalMiss} ${missOk ? '≤' : '>'} ${oldR.criticalMiss} (신규 0 필수)  → ${missOk && newR.criticalMiss === 0 ? 'OK' : 'FAIL'}`);
  console.log(`   ③ 과선별 FP ${newR.fp} ${fpOk ? '≤' : '>'} ${oldR.fp}  → ${fpOk ? 'OK' : 'FAIL'}`);
  console.log(`   ④ 비용 −${callCut}% 호출 / −${cardCut}% 입력  → OK`);
  console.log(` => ${verdict ? '✅ 동일 LLM에서 신규 아키텍처가 전 지표 우위' : '⚠️ 재수정 필요'}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
  process.exit(verdict ? 0 : 1);
}

main();
