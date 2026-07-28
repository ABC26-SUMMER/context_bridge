import { describe, expect, it } from 'vitest';
import { ContextItem } from '../types';
import { enforcePrivacy, evaluateContexts, ProposalStore } from './core';

const NOW = new Date('2026-07-28T00:00:00.000Z');

function card(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    id: 'c1',
    title: '이동 접근성',
    category: 'constraint',
    content: '오래 걷기 어려움',
    tags: ['이동', '외출', '접근성'],
    isActive: true,
    privacyLevel: 'sensitive',
    updatedAt: '2026-07-27T00:00:00.000Z',
    ...overrides,
  };
}

describe('승인 전 정책 평가', () => {
  it('건강·접근성 값을 사용자가 normal로 낮춰도 서버가 sensitive로 올린다', () => {
    expect(enforcePrivacy(card({ privacyLevel: 'normal' })).privacyLevel).toBe('sensitive');
  });
  it('기밀 값은 평가 응답에서도 숨기고 승인 후보에서 제외한다', () => {
    const result = evaluateContexts(
      '내일 친구와 외출',
      [card({ privacyLevel: 'confidential', content: '노출되면 안 되는 값' })],
      NOW,
    )[0];
    expect(result.suggested).toBe(false);
    expect(result.valueVisible).toBe(false);
    expect(result.context.content).not.toContain('노출되면 안 되는 값');
  });

  it('90일 지난 카드를 stale로 표시한다', () => {
    const result = evaluateContexts(
      '내일 친구와 외출',
      [card({ updatedAt: '2026-04-01T00:00:00.000Z' })],
      NOW,
    )[0];
    expect(result.isStale).toBe(true);
  });

  it('꺼둔 카드는 관련성이 높아도 제안하지 않는다', () => {
    const result = evaluateContexts('외출할 때 이동', [card({ isActive: false })], NOW)[0];
    expect(result.suggested).toBe(false);
    expect(result.exclusionReason).toBe('DISABLED');
  });
});

describe('서버 Proposal 승인 경계', () => {
  it('클라이언트는 Proposal에 없는 ID를 승인할 수 없다', () => {
    const store = new ProposalStore();
    const proposal = store.create('u1', 'p1', '외출', [card()], NOW);
    expect(() => store.approve(proposal.id, 'u1', ['forged'])).toThrow();
  });

  it('타 사용자는 Proposal을 승인할 수 없다', () => {
    const store = new ProposalStore();
    const proposal = store.create('u1', 'p1', '외출', [card()], NOW);
    expect(() => store.approve(proposal.id, 'attacker', ['c1'])).toThrow();
  });

  it('최초 승인 즉시 잠가 동시 재승인을 차단한다', () => {
    const store = new ProposalStore();
    const proposal = store.create('u1', 'p1', '외출', [card()], NOW);
    store.approve(proposal.id, 'u1', ['c1']);
    expect(() => store.approve(proposal.id, 'u1', [])).toThrow('이미 처리한');
  });

  it('승인 Snapshot은 서버가 고정한 원본 값으로 해시화한다', () => {
    const store = new ProposalStore();
    const original = card();
    const proposal = store.create('u1', 'p1', '외출', [original], NOW);
    original.content = '클라이언트에서 변경한 값';
    const result = store.approve(proposal.id, 'u1', ['c1']);
    expect(result.approved[0].content).toBe('오래 걷기 어려움');
    expect(result.snapshotHash).toHaveLength(64);
  });
});

describe('승인 기반 기억', () => {
  it('저장 전에는 카드가 아니며 저장과 무시는 한 번만 가능하다', () => {
    const store = new ProposalStore();
    const proposal = store.create(
      'u1',
      'outing',
      '무릎이 안 좋아서 오래 못 걸어요. 친구와 뭐 할까요?',
      [],
      NOW,
    );
    const candidate = store.extractMemories(proposal)[0];
    expect(candidate.status).toBe('PENDING');
    const saved = store.resolveMemory(candidate.id, 'u1', 'save');
    expect(saved.context?.content).toBe('오래 걷기 어려움');
    expect(saved.candidate.profileId).toBe('outing');
    expect(() => store.resolveMemory(candidate.id, 'u1', 'ignore')).toThrow('이미 처리한');
  });

  it('이미 같은 정보가 있으면 기억 후보를 만들지 않는다', () => {
    const store = new ProposalStore();
    const proposal = store.create(
      'u1',
      'outing',
      '무릎이 아파요',
      [card()],
      NOW,
    );
    expect(store.extractMemories(proposal)).toEqual([]);
  });
});
