import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp, offlineGenerate, promptFor } from '../../server.js';
import type { ContextItem } from '../types.js';
import { evaluateContexts, ProposalStore } from './core.js';
import { inspectAnswer } from './answerGuard.js';
import { recallShortlist, selectContexts, structureQuestion } from './selection.js';

function card(
  id: string,
  category: ContextItem['category'],
  title: string,
  content: string,
  options: Partial<ContextItem> = {},
): ContextItem {
  return {
    id,
    category,
    title,
    content,
    tags: [],
    isActive: true,
    privacyLevel: 'normal',
    updatedAt: '2026-07-30T00:00:00.000Z',
    ...options,
  };
}

describe('v20 요구사항 선별 검증', () => {
  const contexts = [
    card('budget', 'resource', '예산', '3만원'),
    card('quiet', 'preference', '장소 선호', '조용한 장소'),
    card('mobility', 'hard_limit', '이동 조건', '15분 이상 걷기 어려움', { privacyLevel: 'sensitive' }),
    card('study', 'goal', '학습 목표', 'SQLD 합격'),
  ];

  it('1. 직접 관련 질문은 해당 카드를 찾는다', () => {
    expect(recallShortlist('예산 3만원으로 추천해줘', contexts).map((row) => row.item.id)).toContain('budget');
  });

  it('2·10. 표현이 달라도 의미가 연결된 간접 질문을 찾는다', () => {
    expect(recallShortlist('소음이 적은 곳을 골라줘', contexts).map((row) => row.item.id)).toContain('quiet');
  });

  it('3. 완전히 무관한 질문은 hard_limit을 최종 사용 대상으로 끌어오지 않는다', async () => {
    const result = await selectContexts('자바스크립트 배열 정렬법', contexts);
    expect(result.overrides.get('mobility')?.role).toBe('ignore');
  });

  it('4. 복합 제약 질문의 예산·이동 영역을 함께 구조화한다', () => {
    const plan = structureQuestion('내일 대중교통으로 3만원 안에서 갈 곳을 추천해줘');
    expect(plan.riskDomains).toEqual(expect.arrayContaining(['예산', '교통', '이동']));
    expect(plan.timeHorizon).toContain('내일');
  });

  it('5. 현재 질문과 프로필의 수치 충돌은 자동 선택하지 않는다', () => {
    const evaluated = evaluateContexts('예산은 5만원이야', [contexts[0]], new Date('2026-07-30'));
    expect(evaluated[0].requiresReview).toBe(true);
    expect(evaluated[0].suggested).toBe(false);
  });

  it('6. 오래된 정보는 확인 전 자동 선택하지 않는다', () => {
    const stale = card('old', 'resource', '예산', '3만원', { updatedAt: '2025-01-01T00:00:00.000Z' });
    const evaluated = evaluateContexts('예산에 맞춰줘', [stale], new Date('2026-07-30'));
    expect(evaluated[0].isStale).toBe(true);
    expect(evaluated[0].suggested).toBe(false);
  });

  it('9. 카드 100개 이상에서도 shortlist는 14개를 넘지 않는다', () => {
    const many = Array.from({ length: 150 }, (_, index) =>
      card(`card-${index}`, 'preference', `장소 ${index}`, `조용한 장소 ${index}`),
    );
    expect(recallShortlist('조용한 장소 추천', many).length).toBeLessThanOrEqual(14);
  });

  it('민감정보는 관련돼도 기본 승인하지 않고 기밀정보는 후보에서 차단한다', () => {
    const secret = card('secret', 'hard_limit', '사내 비밀', '극비 코드', { privacyLevel: 'confidential' });
    const evaluated = evaluateContexts('걷기 어려운데 장소 추천', [...contexts, secret], new Date('2026-07-30'));
    expect(evaluated.find((row) => row.contextId === 'mobility')?.suggested).toBe(false);
    expect(evaluated.find((row) => row.contextId === 'secret')?.exclusionReason).toBe('RESTRICTED');
  });
});

describe('v20 승인 경계와 생성 후 검증', () => {
  it('해커톤 데모: 같은 질문에서 이동 제약 해제 시 prompt와 답변에서 완전히 사라진다', async () => {
    const query = '내일 딸과 갈 만한 곳 추천해줘.';
    const mobility = card('mobility', 'hard_limit', '이동 조건', '15분 이상 걷기 어려움', {
      privacyLevel: 'sensitive',
    });
    const approved = [
      mobility,
      card('transport', 'resource', '교통', '대중교통 이용'),
      card('budget', 'resource', '예산', '3만원'),
      card('quiet', 'preference', '장소 선호', '조용한 장소'),
    ];
    const rawPrompt = promptFor(query, []);
    const fullPrompt = promptFor(query, approved);
    const withoutMobilityPrompt = promptFor(query, approved.filter((item) => item.id !== mobility.id));
    const [raw, personalized, withoutMobility] = await Promise.all([
      offlineGenerate(rawPrompt),
      offlineGenerate(fullPrompt),
      offlineGenerate(withoutMobilityPrompt),
    ]);

    expect(raw).toContain('일반 답변');
    expect(personalized).toContain('15분 이상 걷기 어려움');
    expect(withoutMobilityPrompt).not.toContain(mobility.id);
    expect(withoutMobilityPrompt).not.toContain(mobility.title);
    expect(withoutMobilityPrompt).not.toContain(mobility.content);
    expect(withoutMobility).not.toContain(mobility.content);
  });

  it('7·8·12. 거절한 민감 카드의 값·제목·ID·존재가 프롬프트·로그·답변에 남지 않는다', async () => {
    const store = new ProposalStore();
    const rejected = card('private-health-id', 'hard_limit', '민감한 건강 제목', '절대노출금지 건강값', {
      privacyLevel: 'sensitive',
    });
    const approved = card('approved-budget-id', 'resource', '예산', '3만원');

    const prompts: string[] = [];
    let answerCall = 0;
    const generate = async (prompt: string) => {
      prompts.push(prompt);
      if (prompt.includes('[수정할 답변]')) return '3만원 안에서 가까운 실내 장소를 우선 비교해 보세요.';
      answerCall += 1;
      if (answerCall === 1) return offlineGenerate(prompt);
      return '민감한 건강 제목과 절대노출금지 건강값을 고려하세요.';
    };
    const app = createApp({ generate, live: false, store });
    const createCard = async (item: ContextItem) => request(app)
      .post('/api/profiles/student-profile/contexts')
      .set('Authorization', 'Bearer demo-student')
      .send({
        title: item.title,
        category: item.category,
        content: item.content,
        privacyLevel: item.privacyLevel,
      })
      .expect(200);
    const rejectedResponse = await createCard(rejected);
    const approvedResponse = await createCard(approved);
    rejected.id = rejectedResponse.body.context.id;
    approved.id = approvedResponse.body.context.id;

    const proposal = await request(app)
      .post('/api/proposals')
      .set('Authorization', 'Bearer demo-student')
      .send({ profileId: 'student-profile', query: '내일 갈 곳 추천' })
      .expect(200);
    const response = await request(app)
      .post(`/api/proposals/${proposal.body.proposalId}/answers`)
      .set('Authorization', 'Bearer demo-student')
      .send({ approvedContextIds: [approved.id], includeRawComparison: true })
      .expect(200);

    const serializedPrompts = JSON.stringify(prompts);
    const serializedAudit = JSON.stringify(response.body.auditLog);
    for (const forbidden of [rejected.id, rejected.title, rejected.content]) {
      expect(serializedPrompts).not.toContain(forbidden);
      expect(serializedAudit).not.toContain(forbidden);
      expect(response.body.contextBridgeAnswer).not.toContain(forbidden);
    }
    expect(response.body.auditLog.totalVaultCount).toBe(response.body.usedContextsCount);
    expect(response.body.auditLog.privacySavedCount).toBe(0);
  });

  it('11. 승인된 필수 제약이 빠진 초안을 감지한다', () => {
    const required = card('limit', 'hard_limit', '이동 조건', '15분 이상 걷기 어려움');
    expect(inspectAnswer('장소 추천', '가까운 공원을 추천합니다. 자세한 운영시간을 확인하세요.', [required], []))
      .toContain('APPROVED_REQUIRED_CONTEXT_MISSING');
  });

  it('답변 뒤 기억은 PENDING이며 save 승인 전에는 카드가 생성되지 않는다', async () => {
    const store = new ProposalStore();
    const proposal = await store.create('u', 'p', '오래 걷기 어려워요', []);
    const candidates = await store.extractMemories(proposal);
    expect(candidates[0]?.status).toBe('PENDING');
    const ignored = await store.resolveMemory(candidates[0].id, 'u', 'ignore');
    expect(ignored.context).toBeUndefined();
  });

  it('선별 결과는 질문과 모든 카드의 ID·값을 외부 랭커 없이도 만든다', async () => {
    const result = await selectContexts('예산 3만원 장소 추천', [
      card('budget', 'resource', '예산', '3만원'),
      card('secret', 'hard_limit', '비밀', '기밀', { privacyLevel: 'confidential' }),
    ]);
    expect(result.diagnostics.mode).toBe('local-hybrid');
    expect(result.overrides.get('secret')?.role).toBe('ignore');
  });
});
