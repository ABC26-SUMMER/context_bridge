import { describe, expect, it } from 'vitest';
import { ContextItem } from '../types';
import {
  selectContexts, recallShortlist, SemanticRanker, RankerOutput, RankedCard,
} from './selection';

function card(id: string, category: ContextItem['category'], title: string, content: string, o: Partial<ContextItem> = {}): ContextItem {
  return { id, category, title, content, tags: [], isActive: true, privacyLevel: 'normal', updatedAt: '2026-07-01T00:00:00.000Z', ...o };
}

// 랭커가 특정 role/score/confidence를 반환하도록 만드는 목 빌더.
function rankerReturning(map: Record<string, Partial<RankedCard>>): SemanticRanker {
  return async (input): Promise<RankerOutput> => ({
    detectedIntent: 'test',
    questionPlan: { taskType: 't', userGoal: 'g', requiredFactors: [], responsePlan: [] },
    cards: input.candidates.map((c) => ({
      id: c.id,
      role: (map[c.id]?.role ?? 'ignore'),
      score: map[c.id]?.score ?? 5,
      confidence: map[c.id]?.confidence ?? 50,
    })) as RankedCard[],
    suggestedAdditions: [],
  });
}

describe('안전망: 랭커가 낮은 확신으로 버린 하드리밋을 되살린다', () => {
  it('hard_limit을 ignore+저확신으로 주면 optional 이상으로 복구된다(치명적 누락 방지)', async () => {
    const ctx = [
      card('limit', 'hard_limit', '이동 조건', '장시간 보행 어려움'),
      card('place', 'preference', '장소 취향', '실내 좌석'),
    ];
    // 랭커가 하드리밋을 '관련 없다'며 버림(ignore, confidence 40 < 60).
    const ranker = rankerReturning({ limit: { role: 'ignore', score: 10, confidence: 40 }, place: { role: 'should_use', score: 60, confidence: 70 } });
    const r = await selectContexts('내일 어디 갈까?', ctx, ranker);
    const role = r.overrides.get('limit')?.role;
    expect(role).not.toBe('ignore');           // 되살아났다
    expect(['optional', 'should_use', 'must_use']).toContain(role);
    expect(r.diagnostics.safetyNetRescues).toBeGreaterThanOrEqual(1);
  });

  it('랭커가 하드리밋을 높은 확신으로 버리면 존중한다(억지 복구 안 함)', async () => {
    const ctx = [card('limit', 'hard_limit', '알레르기', '없음')];
    const ranker = rankerReturning({ limit: { role: 'ignore', score: 5, confidence: 90 } }); // 확신 높음
    const r = await selectContexts('무엇이든', ctx, ranker);
    expect(r.overrides.get('limit')?.role).toBe('ignore');
    expect(r.diagnostics.safetyNetRescues).toBe(0);
  });
});

describe('과선별 제어: should_use 상한 초과분을 optional로 강등', () => {
  it('랭커가 8장을 should_use로 줘도 상한(4+복잡도)까지만 유지', async () => {
    const ctx = Array.from({ length: 8 }, (_, i) => card(`c${i}`, 'preference', `취향 ${i}`, `내용 ${i} 카페`));
    const overrides: Record<string, Partial<RankedCard>> = {};
    ctx.forEach((c) => { overrides[c.id] = { role: 'should_use', score: 55, confidence: 70 }; });
    // 복잡도=requiredFactors 수. 목 questionPlan은 factors 0 → cap=4.
    const ranker: SemanticRanker = async (input) => ({
      detectedIntent: 't',
      questionPlan: { taskType: 't', userGoal: 'g', requiredFactors: [], responsePlan: [] },
      cards: input.candidates.map((c) => ({ id: c.id, role: 'should_use', score: 55, confidence: 70 } as RankedCard)),
      suggestedAdditions: [],
    });
    const r = await selectContexts('카페 추천', ctx, ranker);
    const primaries = [...r.overrides.values()].filter((o) => o.role === 'must_use' || o.role === 'should_use');
    expect(primaries.length).toBeLessThanOrEqual(4);
    expect(r.diagnostics.overSelectionTrims).toBeGreaterThanOrEqual(1);
  });

  it('must_use는 상한 강등 대상에서 보호된다', async () => {
    const ctx = Array.from({ length: 6 }, (_, i) => card(`m${i}`, 'objective', `목표 ${i}`, `내용 ${i}`));
    const ranker: SemanticRanker = async (input) => ({
      detectedIntent: 't',
      questionPlan: { taskType: 't', userGoal: 'g', requiredFactors: [], responsePlan: [] },
      cards: input.candidates.map((c) => ({ id: c.id, role: 'must_use', score: 85, confidence: 80 } as RankedCard)),
      suggestedAdditions: [],
    });
    const r = await selectContexts('목표 내용 전부 중요', ctx, ranker);
    const musts = [...r.overrides.values()].filter((o) => o.role === 'must_use');
    expect(musts.length).toBe(6); // 하나도 강등되지 않음
  });
});

describe('recall 단계가 페이로드를 경계짓는다(확장성)', () => {
  it('대형 vault라도 shortlist는 14개로 제한되고 무관한 하드리밋은 제외된다', () => {
    const many = Array.from({ length: 200 }, (_, i) => card(`x${i}`, 'identity', `기타 ${i}`, `무관 메모 ${i}`));
    const crit = card('crit', 'hard_limit', '이동 조건', '보행 어려움');
    const shortlist = recallShortlist('SQLD 자격증 공부', [...many, crit]);
    expect(shortlist.length).toBeLessThanOrEqual(14);
    expect(shortlist.some((s) => s.item.id === 'crit')).toBe(false);
  });

  it('confidential/비활성 카드는 recall 후보에서 제외된다(정책 존중)', () => {
    const ctx = [
      card('ok', 'resource', '공부 시간', '평일 1시간'),
      card('secret', 'resource', '비밀', '노출 금지', { privacyLevel: 'confidential' }),
      card('off', 'resource', '비활성', '옛 정보', { isActive: false }),
    ];
    const shortlist = recallShortlist('공부 시간 계획', ctx);
    const ids = shortlist.map((s) => s.item.id);
    expect(ids).toContain('ok');
    expect(ids).not.toContain('secret');
    expect(ids).not.toContain('off');
  });
});

describe('랭커 부재·실패 시 결정론 폴백', () => {
  it('랭커가 없으면 결정론 경로로 동작한다', async () => {
    const ctx = [card('t', 'resource', '공부 시간', '평일 1시간')];
    const r = await selectContexts('공부 시간 계획 짜줘', ctx);
    expect(r.diagnostics.mode).toBe('local-hybrid');
    expect(r.overrides.get('t')?.role).not.toBe(undefined);
  });

  it('랭커가 예외를 던지면 폴백으로 안전하게 동작한다', async () => {
    const ctx = [card('t', 'resource', '공부 시간', '평일 1시간')];
    const throwing: SemanticRanker = async () => { throw new Error('LLM down'); };
    const r = await selectContexts('공부 시간 계획', ctx, throwing);
    expect(r.diagnostics.mode).toBe('local-hybrid');
  });
});

describe('비용: 랭커는 정확히 1회만 호출된다(2패스 아님)', () => {
  it('selectContexts는 랭커를 1회 호출한다', async () => {
    let calls = 0;
    const ctx = [card('a', 'resource', '시간', '평일 1시간'), card('b', 'preference', '취향', '조용한 곳')];
    const counting: SemanticRanker = async (input) => {
      calls++;
      return {
        detectedIntent: 't',
        questionPlan: { taskType: 't', userGoal: 'g', requiredFactors: [], responsePlan: [] },
        cards: input.candidates.map((c) => ({ id: c.id, role: 'should_use', score: 50, confidence: 60 } as RankedCard)),
        suggestedAdditions: [],
      };
    };
    await selectContexts('평일 공부 시간 계획', ctx, counting);
    expect(calls).toBe(1);
  });

  it('민감 카드도 선별 정확도를 위해 semantic ranker가 실제 의미를 읽는다', async () => {
    const ctx = [
      card('health', 'hard_limit', '건강 조건', '고혈압 약 복용 중', {
        privacyLevel: 'sensitive',
      }),
    ];
    let received = '';
    const ranker: SemanticRanker = async (input) => {
      received = input.candidates[0]?.content || '';
      return {
        detectedIntent: 't',
        questionPlan: { taskType: 't', userGoal: 'g', requiredFactors: [], responsePlan: [] },
        cards: input.candidates.map((c) => ({
          id: c.id,
          role: 'optional',
          score: 30,
          confidence: 60,
        })),
        suggestedAdditions: [],
      };
    };
    await selectContexts('건강 계획', ctx, ranker);
    expect(received).toContain('고혈압 약 복용 중');
  });
});
