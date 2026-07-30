import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp, offlineGenerate, type Generate } from '../../server';

/**
 * v13 이식(Firebase판 장점) 회귀 테스트.
 * 1) 답변 프롬프트에 "반영된 맥락" 요약 지시가 들어간다.
 * 2) bypassAll=true면 승인 맥락을 무시하고 중립 답변을 낸다.
 * 3) structured output은 라이브에서만 활성(테스트는 텍스트 폴백) — 배선 안전성 확인.
 */

function H(token = 'demo-student') {
  return { Authorization: `Bearer ${token}` };
}

/** generate에 전달된 프롬프트를 캡처하는 스텁. */
function capturingApp() {
  const prompts: string[] = [];
  const gen: Generate = async (prompt) => {
    prompts.push(prompt);
    return offlineGenerate(prompt);
  };
  return { app: createApp({ generate: gen, live: false }), prompts };
}

async function makeProposal(app: ReturnType<typeof createApp>, query: string) {
  const res = await request(app)
    .post('/api/proposals')
    .set(H())
    .send({ profileId: 'student-profile', query });
  return res.body as { proposalId: string; evaluations: Array<{ contextId: string; suggested: boolean }> };
}

describe('v13 - 반영된 맥락 요약 지시', () => {
  it('승인 맥락이 있으면 답변 프롬프트에 요약 코너 지시가 포함된다', async () => {
    const { app, prompts } = capturingApp();
    const p = await makeProposal(app, '방학에 클라우드 자격증 준비 계획 세워줘');
    const approved = p.evaluations.filter((e) => e.suggested).slice(0, 2).map((e) => e.contextId);

    await request(app)
      .post(`/api/proposals/${p.proposalId}/answers`)
      .set(H())
      .send({ approvedContextIds: approved, includeRawComparison: false });

    // 개인화 답변 프롬프트(맥락 포함)에 요약 지시가 있어야 한다.
    const personalized = prompts.find((t) => t.includes('[사용자가 승인한 맥락]'));
    expect(personalized).toBeTruthy();
    expect(personalized).toContain('✨ 반영된 맥락');
  });

  it('승인 맥락이 없으면 요약 지시가 붙지 않는다(중립 답변)', async () => {
    const { app, prompts } = capturingApp();
    const p = await makeProposal(app, '오늘 날씨 좋네');

    await request(app)
      .post(`/api/proposals/${p.proposalId}/answers`)
      .set(H())
      .send({ approvedContextIds: [], includeRawComparison: false });

    const neutral = prompts.find((t) => t.includes('일반적이고 중립적인'));
    expect(neutral).toBeTruthy();
    expect(neutral).not.toContain('✨ 반영된 맥락');
  });
});

describe('v13 - bypassAll 스위치', () => {
  it('bypassAll=true면 승인 ID를 보내도 맥락 0개로 중립 답변한다', async () => {
    const { app, prompts } = capturingApp();
    const p = await makeProposal(app, '자격증 공부 계획');
    const approved = p.evaluations.filter((e) => e.suggested).map((e) => e.contextId);

    const res = await request(app)
      .post(`/api/proposals/${p.proposalId}/answers`)
      .set(H())
      .send({ approvedContextIds: approved, bypassAll: true, includeRawComparison: false });

    expect(res.status).toBe(200);
    expect(res.body.bypassed).toBe(true);
    expect(res.body.usedContexts).toHaveLength(0);       // 승인 ID를 보냈어도 0개
    // 프롬프트에도 맥락이 안 실린다.
    const used = prompts.find((t) => t.includes('[사용자가 승인한 맥락]'));
    expect(used).toBeUndefined();
  });

  it('bypassAll=false(기본)면 승인 맥락이 정상 반영된다', async () => {
    const { app } = capturingApp();
    const p = await makeProposal(app, '자격증 공부 계획');
    const approved = p.evaluations.filter((e) => e.suggested).slice(0, 1).map((e) => e.contextId);

    const res = await request(app)
      .post(`/api/proposals/${p.proposalId}/answers`)
      .set(H())
      .send({ approvedContextIds: approved, includeRawComparison: false });

    expect(res.body.bypassed).toBe(false);
    expect(res.body.usedContexts).toHaveLength(1);
  });
});

describe('v13 - structured output 배선 안전성', () => {
  it('generate 주입(테스트) 시 structured 경로를 타지 않고 정상 동작한다', async () => {
    // live=false + generate 주입이면 generateStructured는 undefined여야 하고,
    // scoreRelevance는 그냥 규칙 폴백으로 후보를 만든다(크래시 없음).
    const { app } = capturingApp();
    const p = await makeProposal(app, '무릎이 안 좋아서 오래 못 걸어요. 가까운 곳 추천');
    expect(p.evaluations.length).toBeGreaterThan(0);   // 후보가 정상 생성됨
  });
});
