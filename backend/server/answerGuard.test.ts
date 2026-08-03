import { describe, expect, it } from 'vitest';
import type { ContextItem } from '../types';
import { inspectAnswer, validateAndRepairAnswer } from './answerGuard';
import { promptFor } from '../../server';

function context(overrides: Partial<ContextItem>): ContextItem {
  return {
    id: overrides.id || crypto.randomUUID(),
    title: overrides.title || '테스트 맥락',
    category: overrides.category || 'identity',
    content: overrides.content || '',
    tags: overrides.tags || [],
    isActive: overrides.isActive ?? true,
    privacyLevel: overrides.privacyLevel || 'normal',
    updatedAt: overrides.updatedAt || '2026-08-03T00:00:00.000Z',
  };
}

describe('개인화 답변 계약', () => {
  it('승인된 프로필 카드를 특정 시나리오가 아닌 일반 개인화 계약으로 전달한다', () => {
    const prompt = promptFor('이번 주 계획을 어떻게 세우면 좋을까?', [
      context({ title: '사용 가능한 시간', category: 'resource', content: '평일 저녁 30분' }),
      context({ title: '설명 방식', category: 'preference', content: '짧은 문장과 단계별 안내' }),
      context({ title: '꼭 지킬 조건', category: 'hard_limit', content: '한 번에 하나씩만 진행해야 한다' }),
    ]);

    expect(prompt).toContain('[개인화 답변 계약]');
    expect(prompt).toContain('답의 선택지, 우선순위, 설명 방식, 실행 난이도');
    expect(prompt).toContain('평일 저녁 30분');
    expect(prompt).toContain('짧은 문장과 단계별 안내');
    expect(prompt).toContain('한 번에 하나씩만 진행해야 한다');
  });

  it('승인된 필수 조건이 답변에서 빠지면 검증 문제로 잡는다', () => {
    const issues = inspectAnswer(
      '이번 주 계획을 어떻게 세우면 좋을까?',
      '먼저 할 일을 정하고 차례대로 진행하세요.',
      [context({ title: '꼭 지킬 조건', category: 'hard_limit', content: '한 번에 하나씩만 진행해야 한다' })],
      [],
    );

    expect(issues).toContain('APPROVED_REQUIRED_CONTEXT_MISSING');
  });

  it('필수 맥락이 빠진 답변은 승인된 프로필 기준으로 다시 쓰게 한다', async () => {
    const result = await validateAndRepairAnswer({
      query: '이번 주 계획을 어떻게 세우면 좋을까?',
      draft: '먼저 할 일을 정하고 차례대로 진행하세요.',
      approved: [context({ title: '꼭 지킬 조건', category: 'hard_limit', content: '한 번에 하나씩만 진행해야 한다' })],
      unapproved: [],
      generate: async (prompt) => {
        expect(prompt).toContain('APPROVED_REQUIRED_CONTEXT_MISSING');
        expect(prompt).toContain('각 승인 맥락이 이번 질문의 선택지, 우선순위, 설명 난이도, 실행 방법 중 무엇을 바꾸는지');
        return '이번 주 계획은 한 번에 하나씩만 진행하는 방식으로 세우세요. 먼저 가장 중요한 일 하나를 고르고, 끝난 뒤 다음 일을 정하세요.';
      },
    });

    expect(result.repaired).toBe(true);
    expect(result.answer).toContain('한 번에 하나씩');
  });
});
