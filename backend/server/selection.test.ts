import { describe, expect, it, vi } from 'vitest';
import { ContextItem } from '../types.js';
import {
  recallShortlist,
  selectContexts,
  reconcile,
  RankedCard,
  SemanticRanker,
  RankerOutput,
} from './selection.js';

function ctx(id: string, category: ContextItem['category'], title: string, content: string, o: Partial<ContextItem> = {}): ContextItem {
  return { id, category, title, content, tags: [], isActive: true, privacyLevel: 'normal', updatedAt: '2026-07-29T00:00:00.000Z', ...o };
}

const senior: ContextItem[] = [
  ctx('o_age', 'identity', '연령대', '70대', { privacyLevel: 'sensitive' }),
  ctx('o_digital', 'capability', '디지털 숙련도', '초급'),
  ctx('o_mobility', 'hard_limit', '이동 조건', '장시간 보행 어려움', { privacyLevel: 'sensitive' }),
  ctx('o_transport', 'resource', '이동 방식', '버스와 지하철'),
  ctx('o_place', 'preference', '장소 취향', '좌석이 있는 곳, 실내 공간'),
];

// ─────────────────────────────────────────────────────────────────────────────
describe('1단계 recall 필터 — 확장성/재현율', () => {
  it('대용량 Vault에서도 shortlist가 상한으로 제한된다(LLM 페이로드 경계)', () => {
    const big: ContextItem[] = Array.from({ length: 200 }, (_, i) =>
      ctx(`c${i}`, 'identity', `카드${i}`, `내용${i}`),
    );
    const shortlist = recallShortlist('완전히 무관한 질문 xyz', big);
    // hard_limit이 없으므로 강제 포함 0, 어휘 미달로 대부분 탈락 → 상한(14) 이하.
    expect(shortlist.length).toBeLessThanOrEqual(14);
  });

  it('소형 프로필은 재현율을 위해 전체를 후보로 보되 무관 hard_limit의 근거 점수는 낮다', () => {
    const shortlist = recallShortlist('키오스크 쓰는 법', senior);
    const mobility = shortlist.find((s) => s.item.id === 'o_mobility');
    expect(mobility).toBeDefined();
    expect(mobility!.recall).toBeLessThan(15);
  });

  it('confidential/비활성 hard_limit은 강제 포함하지 않는다(정책 경계 준수)', () => {
    const contexts = [
      ctx('secret', 'hard_limit', '기밀 제약', 'x', { privacyLevel: 'confidential' }),
      ctx('off', 'hard_limit', '꺼둔 제약', 'y', { isActive: false }),
    ];
    const shortlist = recallShortlist('아무 질문', contexts);
    expect(shortlist.length).toBe(0);
  });

  it('집 근처 질문은 거주 환경 카드를 recall 후보로 연결한다', () => {
    const contexts = [
      ctx('home', 'identity', '거주 환경', '수원 거주, 버스 정류장과 공원이 가까움'),
      ...Array.from({ length: 20 }, (_, i) => ctx(`other-${i}`, 'identity', `기타 ${i}`, `무관한 정보 ${i}`)),
    ];
    const shortlist = recallShortlist('집 근처에서 산책할 곳을 알려줘', contexts);
    expect(shortlist.some((item) => item.item.id === 'home')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('3단계 reconcile — 안전망/과선별 제어', () => {
  // reconcile를 고립 검증하기 위해 shortlist를 직접 구성한다(recall 세부에 의존 안 함).
  const full = senior.map((item) => ({ item, recall: 50, lexicalHit: true, coActivatedOnly: false }));

  it('안전망: 랭커가 하드리밋을 낮은 확신으로 버리면 optional로 되살린다', () => {
    const ranked = new Map<string, RankedCard>([
      ['o_mobility', { id: 'o_mobility', role: 'ignore', score: 10, confidence: 30 }],
    ]);
    const { overrides, safetyNetRescues } = reconcile('q', senior, full, ranked, { complexity: 3 });
    expect(overrides.get('o_mobility')?.role).toBe('optional');
    expect(safetyNetRescues).toBe(1);
  });

  it('안전망 오작동 방지: 랭커가 높은 확신으로 무관하다고 하면 그 판정을 존중한다', () => {
    const ranked = new Map<string, RankedCard>([
      ['o_mobility', { id: 'o_mobility', role: 'ignore', score: 5, confidence: 92 }],
    ]);
    const { overrides, safetyNetRescues } = reconcile('q', senior, full, ranked, { complexity: 3 });
    expect(overrides.get('o_mobility')?.role).toBe('ignore');
    expect(safetyNetRescues).toBe(0);
  });

  it('과선별 제어: should_use 폭주 시 상한까지 잘라 optional로 강등한다(must는 보호)', () => {
    const ranked = new Map<string, RankedCard>(
      senior.map((c) => [c.id, { id: c.id, role: 'should_use' as const, score: 60, confidence: 80 }]),
    );
    ranked.set('o_place', { id: 'o_place', role: 'must_use', score: 95, confidence: 95 });
    const { overrides, overSelectionTrims } = reconcile('q', senior, full, ranked, { complexity: 0 });
    // 상한 = max(4, 4+0) = 4. must_use(o_place)는 보호. 초과분은 optional로.
    const primaries = [...overrides.values()].filter((o) => o.role === 'must_use' || o.role === 'should_use');
    expect(primaries.length).toBeLessThanOrEqual(4);
    expect(overrides.get('o_place')?.role).toBe('must_use');
    expect(overSelectionTrims).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('오케스트레이션 — 비용/폴백', () => {
  it('semantic ranker는 정확히 1회만 호출된다(v19의 2콜 대비 비용 절반)', async () => {
    const ranker = vi.fn<SemanticRanker>(async ({ candidates }) => ({
      detectedIntent: 'x',
      questionPlan: { taskType: 't', userGoal: 'g', requiredFactors: [], responsePlan: [] },
      cards: candidates.map((c) => ({ id: c.id, role: 'optional' as const, score: 40, confidence: 70 })),
      suggestedAdditions: [],
    }));
    await selectContexts('내일 어디 갈까', senior, ranker);
    expect(ranker).toHaveBeenCalledTimes(1);
  });

  it('랭커가 실패(throw)하면 결정론 경로로 폴백해 여전히 override를 만든다', async () => {
    const failing: SemanticRanker = async () => { throw new Error('LLM down'); };
    const result = await selectContexts('무릎 때문에 오래 못 걷는데 갈만한 곳', senior, failing);
    expect(result.diagnostics.mode).toBe('local-hybrid');
    expect(result.overrides.size).toBe(senior.length);
  });

  it('랭커 없이도 무관한 하드리밋은 제외한다', async () => {
    const result = await selectContexts('키오스크 쓰는 법 알려줘', senior);
    const role = result.overrides.get('o_mobility')?.role;
    expect(role).toBe('ignore');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 아키텍처 A/B: 동일한 '불완전 mock LLM'을 두 오케스트레이션에 각각 적용.
// 목적 — 랭커 품질을 고정하고 '오케스트레이션 차이'만 측정한다.
//   신규: recall→rank→reconcile(안전망+상한)
//   v19 : 전체 카드→랭커→그대로 통과(안전망/상한 없음)  ← server.ts scoreRelevance의 clamp 재현
// mock LLM은 실제 LLM의 두 가지 알려진 실패를 주입한다:
//   (a) 화제성에 쏠려 관련 hard_limit을 낮은 확신으로 누락
//   (b) 느슨하게 관련된 카드를 과잉 should_use
// ─────────────────────────────────────────────────────────────────────────────
describe('아키텍처 A/B — 동일 mock LLM 하에서 오케스트레이션 비교', () => {
  // 어휘 앵커가 확실한 질문 + 12장 프로필. 랭커가 후보를 실제로 받도록 구성.
  const query = '버스 타고 실내 좌석 있는 곳으로 나들이 계획 세워줘';
  const profile: ContextItem[] = [
    ctx('mobility', 'hard_limit', '이동 조건', '장시간 보행 어려움'),      // gold: 반드시 반영
    ctx('transport', 'resource', '이동 방식', '버스와 지하철'),            // gold: 반영
    ctx('place', 'preference', '장소 취향', '실내 좌석 있는 공간'),         // gold: 반영
    // 아래 9장은 이 질문과 무관 — LLM이 느슨하게 과잉 추천하는 대상.
    ...Array.from({ length: 9 }, (_, i) => ctx(`noise${i}`, 'preference', `취향${i}`, `무관한 취향 내용 ${i}`)),
  ];

  // 불완전 mock LLM: (a) hard_limit을 낮은 확신으로 누락, (b) 후보 대부분을 should_use로 과잉.
  const flawedLLM = (cards: { id: string }[]): RankedCard[] =>
    cards.map((c) => {
      if (c.id === 'mobility') return { id: c.id, role: 'ignore', score: 18, confidence: 42 }; // (a)
      if (c.id === 'place') return { id: c.id, role: 'must_use', score: 92, confidence: 90 };
      if (c.id === 'transport') return { id: c.id, role: 'should_use', score: 74, confidence: 82 };
      return { id: c.id, role: 'should_use', score: 58, confidence: 55 }; // (b) 나머지 전부 과잉
    });

  it('안전망: 신규는 랭커가 버린 하드리밋을 보존하고, v19은 그대로 누락시킨다', async () => {
    const ranker: SemanticRanker = async ({ candidates }): Promise<RankerOutput> => ({
      detectedIntent: '외출 계획',
      questionPlan: { taskType: 'outing', userGoal: query, requiredFactors: ['이동', '장소'], responsePlan: [] },
      cards: flawedLLM(candidates),
      suggestedAdditions: [],
    });
    const result = await selectContexts(query, profile, ranker);
    const newRole = result.overrides.get('mobility')?.role;
    const v19Role = flawedLLM([{ id: 'mobility' }])[0].role; // v19: 통과

    expect(newRole).not.toBe('ignore'); // 안전망이 되살림
    expect(v19Role).toBe('ignore');     // v19은 LLM 누락을 그대로 방치
  });

  it('과선별 억제: 랭커가 후보를 폭주시켜도 신규는 상한으로 제한, v19은 전부 통과', async () => {
    const ranker: SemanticRanker = async ({ candidates }): Promise<RankerOutput> => ({
      detectedIntent: '외출 계획',
      questionPlan: { taskType: 'outing', userGoal: query, requiredFactors: ['이동', '장소'], responsePlan: [] },
      cards: flawedLLM(candidates),
      suggestedAdditions: [],
    });
    const result = await selectContexts(query, profile, ranker);
    const newPrimary = [...result.overrides.values()].filter((o) => o.role === 'must_use' || o.role === 'should_use').length;

    // v19 재현: shortlist 없이 전체 카드를 랭커에 넣고 그대로 통과.
    const v19Primary = flawedLLM(profile).filter((c) => c.role === 'must_use' || c.role === 'should_use').length;

    expect(newPrimary).toBeLessThan(v19Primary);          // 신규가 과선별을 줄인다
    expect(newPrimary).toBeLessThanOrEqual(4 + 2);        // 상한(4+복잡도) 근처로 제한
    expect(v19Primary).toBeGreaterThanOrEqual(10);        // v19은 폭주분을 그대로 노출
  });
});
