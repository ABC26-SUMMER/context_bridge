import { describe, expect, it } from 'vitest';
import { extractByRules, selectMemoryCandidates } from './memory';

type ExpectedMemory = {
  label: string;
  category: string;
  content: string;
  privacyLevel: 'normal' | 'sensitive';
};

const cases: Array<{
  persona: string;
  query: string;
  expected: ExpectedMemory[];
  mustNotPersist: string[];
}> = [
  {
    persona: '고령자',
    query: '나는 무릎이 안 좋아 오래 못 걷고, 버스를 주로 이용해요. 내일 딸과 오래 걷지 않고 갈 수 있는 곳을 추천해줘.',
    expected: [
      { label: '이동 접근성', category: 'hard_limit', content: '오래 걷기 어려움', privacyLevel: 'sensitive' },
      { label: '이동 수단', category: 'resource', content: '버스 이용', privacyLevel: 'normal' },
    ],
    mustNotPersist: ['내일', '딸'],
  },
  {
    persona: '일반인',
    query: '나는 비건이에요. 대중교통을 주로 이용해요. 이번 주말 수원에서 식당을 추천해줘.',
    expected: [
      { label: '이동 수단', category: 'resource', content: '대중교통 이용', privacyLevel: 'normal' },
      { label: '음식 취향', category: 'preference', content: '비건 지향', privacyLevel: 'normal' },
    ],
    mustNotPersist: ['이번 주말', '수원'],
  },
  {
    persona: '대학생',
    query: '나는 vscode를 사용하고 있어, 해군에 들어갈 예정이야, 토익 700점이야. 이번 방학 공부 계획을 세워줘.',
    expected: [
      { label: '사용 기술·도구', category: 'capability', content: 'vscode 사용', privacyLevel: 'normal' },
      { label: '어학 성적', category: 'capability', content: '토익 700점', privacyLevel: 'normal' },
      { label: '진로 계획', category: 'objective', content: '해군에 들어갈 예정이야', privacyLevel: 'normal' },
    ],
    mustNotPersist: ['이번 방학', '공부 계획을 세워줘'],
  },
];

describe('페르소나별 승인 기반 기억 회귀', () => {
  it.each(cases)('$persona 질문에서 장기 사실만 원자 후보로 만든다', ({ query, expected, mustNotPersist }) => {
    const candidates = selectMemoryCandidates(query, [], extractByRules(query));
    expect(candidates.map(({ label, category, content, privacyLevel }) => ({
      label, category, content, privacyLevel,
    }))).toEqual(expected);

    const persistedText = candidates.map((candidate) => candidate.content).join(' ');
    for (const temporary of mustNotPersist) expect(persistedText).not.toContain(temporary);
  });
});
