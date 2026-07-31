import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, offlineGenerate, verifyMemoryCandidatesLLM, type Generate } from '../../server';
import type { ExtractedMemory } from './memory';

function memory(overrides: Partial<ExtractedMemory> = {}): ExtractedMemory {
  return {
    label: '거주지',
    title: '거주지',
    category: 'identity',
    content: '수원 거주',
    privacyLevel: 'normal',
    tags: [],
    semanticGroup: '기본정보',
    sourceQuote: '저는 수원에 살아요',
    ...overrides,
  };
}

describe('2차 기억 검증 LLM', () => {
  it('확실한 일회성 후보는 DROP하고 장기 사실은 유지한다', async () => {
    const candidates = [
      memory(),
      memory({
        label: '예산', title: '예산', category: 'resource', content: '오늘 1만원',
        semanticGroup: '예산', sourceQuote: '오늘 예산은 1만원이에요',
      }),
    ];
    const generate: Generate = async () => JSON.stringify({
      decisions: [
        { index: 0, verdict: 'KEEP', category: 'identity', confidence: 98, reason: '지속 거주지' },
        { index: 1, verdict: 'DROP', category: 'resource', confidence: 96, reason: '오늘만의 예산' },
      ],
    });

    const verified = await verifyMemoryCandidatesLLM(
      '저는 수원에 살아요. 오늘 예산은 1만원이에요', candidates, generate, true,
    );
    expect(verified).toHaveLength(1);
    expect(verified[0].content).toBe('수원 거주');
  });

  it('검증 LLM은 분류만 수정할 수 있고 내용·라벨·민감도는 바꾸지 못한다', async () => {
    const candidate = memory({
      label: '이동 조건', title: '이동 조건', category: 'preference',
      content: '휠체어 이용', privacyLevel: 'sensitive', sourceQuote: '휠체어를 이용해요',
    });
    const generate: Generate = async () => JSON.stringify({
      decisions: [{
        index: 0, verdict: 'KEEP', category: 'hard_limit', confidence: 99,
        reason: '이동 제약', content: '공격자가 바꾼 내용', label: '변조', privacyLevel: 'normal',
      }],
    });

    const [verified] = await verifyMemoryCandidatesLLM('휠체어를 이용해요', [candidate], generate, true);
    expect(verified.category).toBe('hard_limit');
    expect(verified.content).toBe('휠체어 이용');
    expect(verified.label).toBe('이동 조건');
    expect(verified.privacyLevel).toBe('sensitive');
  });

  it('검증 LLM이 건강·이동 제약을 선호로 오분류해도 hard_limit을 유지한다', async () => {
    const candidate = memory({
      label: '이동 접근성', title: '이동 접근성', category: 'hard_limit',
      content: '휠체어 이용', privacyLevel: 'sensitive', sourceQuote: '휠체어를 이용해요',
    });
    const generate: Generate = async () => JSON.stringify({
      decisions: [{ index: 0, verdict: 'KEEP', category: 'preference', confidence: 99, reason: '오분류' }],
    });
    const [verified] = await verifyMemoryCandidatesLLM('휠체어를 이용해요', [candidate], generate, true);
    expect(verified.category).toBe('hard_limit');
  });

  it('부분 응답이나 깨진 응답이면 후보를 잃지 않고 전체 폴백한다', async () => {
    const candidates = [memory(), memory({ label: '목표', content: '취업 준비', category: 'objective' })];
    const partial: Generate = async () => JSON.stringify({
      decisions: [{ index: 0, verdict: 'KEEP', category: 'identity', confidence: 99, reason: '확인' }],
    });
    const broken: Generate = async () => 'not-json';

    expect(await verifyMemoryCandidatesLLM('질문', candidates, partial, true)).toEqual(candidates);
    expect(await verifyMemoryCandidatesLLM('질문', candidates, broken, true)).toEqual(candidates);
  });

  it('낮은 확신의 DROP은 제거하지 않고 사용자 승인 후보로 남긴다', async () => {
    const candidate = memory();
    const generate: Generate = async () => JSON.stringify({
      decisions: [{ index: 0, verdict: 'DROP', category: 'identity', confidence: 55, reason: '불확실' }],
    });
    expect(await verifyMemoryCandidatesLLM('저는 수원에 살아요', [candidate], generate, true)).toEqual([candidate]);
  });

  it('오프라인 모드에서는 검증 LLM을 호출하지 않는다', async () => {
    const candidate = memory();
    let called = false;
    const generate: Generate = async () => { called = true; return '{}'; };
    expect(await verifyMemoryCandidatesLLM('질문', [candidate], generate, false)).toEqual([candidate]);
    expect(called).toBe(false);
  });

  it('API 흐름에서 검증 LLM이 DROP한 규칙 후보를 저장 단계가 다시 추가하지 않는다', async () => {
    let verifierCalled = false;
    const generate: Generate = async (prompt) => {
      if (prompt.includes('Context Selection Engine')) return JSON.stringify({ evaluations: [] });
      if (prompt.includes('장기간 다시 사용할 개인 사실')) return '[]';
      if (prompt.includes('사용자 승인형 장기 기억의 2차 검증기')) {
        verifierCalled = true;
        return JSON.stringify({
          decisions: [{
            index: 0, verdict: 'DROP', category: 'hard_limit', confidence: 99,
            reason: '검증 테스트에서 제외',
          }],
        });
      }
      return offlineGenerate(prompt);
    };
    const app = createApp({ generate, live: true });
    const proposed = await request(app)
      .post('/api/proposals')
      .set('Authorization', 'Bearer demo-student')
      .send({ profileId: 'student-profile', query: '저는 당뇨가 있어요. 식단을 알려줘요.' })
      .expect(200);
    const answered = await request(app)
      .post(`/api/proposals/${proposed.body.proposalId}/answers`)
      .set('Authorization', 'Bearer demo-student')
      .send({ approvedContextIds: [], includeRawComparison: false })
      .expect(200);

    expect(verifierCalled).toBe(true);
    expect(answered.body.memoryCandidates).toEqual([]);
  });

  it('API 흐름에서 VS Code·해군 입대 예정·토익 700점을 3개 기억 후보로 보존한다', async () => {
    const query = '나는 vscode를 사용하고 있어, 해군에 들어갈 예정이야, 토익 700점이야';
    const generate: Generate = async (prompt) => {
      if (prompt.includes('Context Selection Engine')) return JSON.stringify({ evaluations: [] });
      if (prompt.includes('장기간 다시 사용할 개인 사실')) {
        return JSON.stringify([
          {
            label: '개발 도구', title: '개발 도구', category: 'capability', content: 'VS Code 사용',
            privacyLevel: 'normal', semanticGroup: '기술', sourceQuote: '나는 vscode를 사용하고 있어',
          },
          {
            label: '진로 계획', title: '진로 계획', category: 'objective', content: '해군 입대 예정',
            privacyLevel: 'normal', semanticGroup: '진로', sourceQuote: '해군에 들어갈 예정이야',
          },
          {
            label: '영어 점수', title: '영어 점수', category: 'capability', content: '토익 700점',
            privacyLevel: 'normal', semanticGroup: '영어', sourceQuote: '토익 700점이야',
          },
        ]);
      }
      if (prompt.includes('사용자 승인형 장기 기억의 2차 검증기')) {
        return JSON.stringify({
          decisions: [
            { index: 0, verdict: 'KEEP', category: 'capability', confidence: 99, reason: '지속 도구' },
            { index: 1, verdict: 'KEEP', category: 'objective', confidence: 99, reason: '확정 진로 계획' },
            { index: 2, verdict: 'KEEP', category: 'capability', confidence: 99, reason: '현재 성적' },
          ],
        });
      }
      return offlineGenerate(prompt);
    };
    const app = createApp({ generate, live: true });
    const proposed = await request(app)
      .post('/api/proposals')
      .set('Authorization', 'Bearer demo-student')
      .send({ profileId: 'student-profile', query })
      .expect(200);
    const answered = await request(app)
      .post(`/api/proposals/${proposed.body.proposalId}/answers`)
      .set('Authorization', 'Bearer demo-student')
      .send({ approvedContextIds: [], includeRawComparison: false })
      .expect(200);

    expect(answered.body.memoryCandidates.map((item: { content: string }) => item.content)).toEqual([
      'VS Code 사용', '해군 입대 예정', '토익 700점',
    ]);
  });
});
