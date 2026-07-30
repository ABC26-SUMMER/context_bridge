import { describe, expect, it } from 'vitest';
import { ContextItem } from '../types';
import {
  ProposalStore,
  evaluateContexts,
  selectableForRelevance,
} from './core';
import { extractByRules, isDuplicate } from './memory';

const NOW = new Date('2026-07-28T00:00:00.000Z');

function card(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    id: 'c1',
    title: '진로 목표',
    category: 'goal',
    content: '클라우드 엔지니어',
    tags: ['취업', '직무'],
    isActive: true,
    privacyLevel: 'normal',
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

// --- P0: 기억 추출이 각본 문장을 벗어나도 작동한다 ---

describe('P0 기억 추출 — 카테고리 확장', () => {
  const cases: Array<[string, string]> = [
    ['저는 당뇨가 있어서 식단 조절이 필요해요', '건강·식이 제약'],
    ['무릎이 안 좋아서 오래 못 걸어요', '이동 접근성'],
    ['평일 1시간밖에 시간이 없어요', '가용 시간'],
    ['저는 평소에 쉽게 단계별로 설명하는 방식을 선호해요', '답변 방식 선호'],
    ['매운 음식은 못 먹어요', '음식 취향'],
    ['제 평소 예산은 5천원 정도예요', '예산'],
  ];

  it.each(cases)('"%s" → 라벨 %s 추출', (query, label) => {
    const found = extractByRules(query);
    expect(found.map((m) => m.label)).toContain(label);
  });

  it('관련 없는 질문은 아무 것도 추출하지 않는다', () => {
    expect(extractByRules('오늘 날씨가 좋네요')).toEqual([]);
  });

  it('이번 답변 명령이나 일회성 예산은 기억 후보로 만들지 않는다', () => {
    expect(extractByRules('쉽게 단계별로 설명해줘')).toEqual([]);
    expect(extractByRules('오늘 예산은 5천원밖에 없어요')).toEqual([]);
  });

  it('한 질문에서 여러 카테고리를 동시에 추출한다', () => {
    const found = extractByRules('무릎이 안 좋아서 오래 못 걷고, 제 평소 예산은 2만원 이하예요');
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it('저장 카드의 제목·태그가 하드코딩이 아니라 추출값에서 나온다', async () => {
    const store = new ProposalStore();
    const proposal = await store.create('u1', 'pr', '당뇨가 있어요', [], NOW);
    const candidate = (await store.extractMemories(proposal))[0];
    const saved = await store.resolveMemory(candidate.id, 'u1', 'save');
    expect(saved.context?.title).toBe('건강·식이 제약');   // '이동 접근성' 고정 아님
    expect(saved.context?.privacyLevel).toBe('sensitive');
  });

  it('LLM 추출 결과가 규칙 결과보다 우선 병합된다', async () => {
    const store = new ProposalStore();
    const proposal = await store.create('u1', 'pr', '무릎이 안 좋아요', [], NOW);
    const llm = [{
      label: '이동 접근성', title: '이동 접근성', category: 'constraint' as const,
      content: 'LLM이 뽑은 값', tags: ['이동'], privacyLevel: 'sensitive' as const,
      semanticGroup: '이동',
    }];
    const candidates = await store.extractMemories(proposal, llm);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].content).toBe('LLM이 뽑은 값');       // 규칙 값이 아니라 LLM 값
  });
});

describe('P0 중복 판정 — 서로 다른 카드 구분', () => {
  it('이동 수단(대중교통)과 이동 접근성(보행 곤란)을 다른 카드로 본다', () => {
    const transport = card({
      title: '이동 수단', category: 'constraint', content: '대중교통', tags: ['이동', '외출'],
    });
    const mobility = extractByRules('오래 걷기 힘들어요')[0];
    expect(isDuplicate(mobility, [transport])).toBe(false);
  });

  it('이미 같은 사실이 있으면 후보에서 제외한다', () => {
    const existing = card({
      title: '이동 접근성', category: 'constraint', content: '오래 걷기 어려움',
      tags: ['이동', '접근성'],
    });
    const mobility = extractByRules('무릎이 아파서 오래 못 걸어요')[0];
    expect(isDuplicate(mobility, [existing])).toBe(true);
  });
});

// --- P1: LLM 관련성 선별 주입 + confidential 미노출 보장 ---

describe('P1 관련성 오버라이드', () => {
  it('LLM 점수가 규칙 점수를 대체한다(허용 후보 안에서만)', () => {
    const scores = new Map([['c1', 90]]);
    const noScore = evaluateContexts('전혀 무관한 질문', [card()], NOW);
    const withScore = evaluateContexts('전혀 무관한 질문', [card()], NOW, scores);
    expect(noScore[0].suggested).toBe(false);       // 규칙으로는 무관
    expect(withScore[0].suggested).toBe(true);       // LLM이 관련으로 올림
  });

  it('confidential 카드는 LLM 선별 대상에서 사전 제외된다', () => {
    const conf = card({ id: 'x', privacyLevel: 'confidential', content: '기밀 값' });
    expect(selectableForRelevance([conf])).toEqual([]);   // 모델에 값이 갈 후보 목록 자체에 없음
  });

  it('LLM 점수를 줘도 confidential은 절대 제안되지 않는다', () => {
    const conf = card({ id: 'x', privacyLevel: 'confidential', content: '기밀 값' });
    const scores = new Map([['x', 100]]);            // 공격적으로 100점 주입
    const evaluated = evaluateContexts('아무 질문', [conf], NOW, scores)[0];
    expect(evaluated.suggested).toBe(false);
    expect(evaluated.valueVisible).toBe(false);
    expect(evaluated.context.content).not.toContain('기밀 값');
  });
});
