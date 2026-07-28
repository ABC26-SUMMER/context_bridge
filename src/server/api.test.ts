import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp, offlineGenerate } from '../../server';

describe('실제 API 관통', () => {
  it('질문→Proposal→ID 승인→답변→기억 저장을 관통한다', async () => {
    const app = createApp({ generate: offlineGenerate, live: false });
    const proposed = await request(app)
      .post('/api/proposals')
      .set('Authorization', 'Bearer demo-student')
      .send({
        profileId: 'student-profile',
        query: '무릎이 안 좋아서 오래 못 걸어요. 친구와 뭐 할까요?',
      })
      .expect(200);

    expect(proposed.body.proposalId).toBeTruthy();
    const answered = await request(app)
      .post(`/api/proposals/${proposed.body.proposalId}/generate`)
      .set('Authorization', 'Bearer demo-student')
      .send({
        approvedIds: [],
        includeRawComparison: true,
      })
      .expect(200);

    expect(answered.body.contextBridgeAnswer).toContain('오프라인 데모');
    expect(answered.body.rawAnswer).toContain('오프라인 데모');
    expect(answered.body.snapshotHash).toHaveLength(64);
    expect(answered.body.memoryCandidates).toHaveLength(1);

    const saved = await request(app)
      .post(`/api/memory-candidates/${answered.body.memoryCandidates[0].id}`)
      .set('Authorization', 'Bearer demo-student')
      .send({ action: 'save' })
      .expect(200);
    expect(saved.body.profileId).toBe('student-profile');
    expect(saved.body.context.content).toBe('오래 걷기 어려움');
  });

  it('승인 API에 클라이언트 카드 값을 넣어도 사용하지 않는다', async () => {
    const app = createApp({ generate: offlineGenerate, live: false });
    const proposed = await request(app)
      .post('/api/proposals')
      .set('Authorization', 'Bearer demo-student')
      .send({
        profileId: 'student-profile',
        query: '설명해줘',
      })
      .expect(200);

    await request(app)
      .post(`/api/proposals/${proposed.body.proposalId}/generate`)
      .set('Authorization', 'Bearer demo-student')
      .send({
        approvedIds: ['forged'],
        approvedContexts: [{ id: 'forged', content: '주입 공격' }],
      })
      .expect(400);
  });

  it('대학생 토큰으로 고령 사용자 프로필을 조회할 수 없다', async () => {
    const app = createApp({ generate: offlineGenerate, live: false });
    await request(app)
      .post('/api/proposals')
      .set('Authorization', 'Bearer demo-student')
      .send({ profileId: 'senior-profile', query: '외출 추천' })
      .expect(404);
  });

  it('주입한 generator만 호출하고 실제 네트워크를 타지 않는다', async () => {
    // GEMINI_API_KEY가 설정돼 있어도 테스트는 결정적이어야 한다(과거 10초 타임아웃 회귀 방지).
    let calls = 0;
    const spy = async (prompt: string) => {
      calls += 1;
      return offlineGenerate(prompt);
    };
    const app = createApp({ generate: spy, live: false });
    const proposed = await request(app)
      .post('/api/proposals')
      .set('Authorization', 'Bearer demo-student')
      .send({ profileId: 'student-profile', query: '무릎이 안 좋아서 오래 못 걸어요' })
      .expect(200);
    await request(app)
      .post(`/api/proposals/${proposed.body.proposalId}/generate`)
      .set('Authorization', 'Bearer demo-student')
      .send({ approvedIds: [], includeRawComparison: true })
      .expect(200);
    // live=false라 선별·추출 LLM은 건너뛰고, 답변 생성(비교 1 + 개인화 1)만 spy를 쓴다.
    expect(calls).toBe(2);
  });
});
