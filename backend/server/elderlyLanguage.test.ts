import { describe, expect, it } from 'vitest';
import {
  buildDeterministicElderlyGuide,
  cleanElderlyText,
  sanitizeElderlyGuide,
  simplifyForElderly,
} from './elderlyLanguage.js';

describe('simplifyForElderly', () => {
  it('예시로 주어진 전문 용어를 쉬운 표현으로 치환한다', () => {
    expect(simplifyForElderly('QR코드를 스캔하세요')).toBe('네모 모양의 바코드를 스캔하세요');
    expect(simplifyForElderly('결제 승인이 완료됐습니다')).toBe('결제가 완료되었습니다이 완료됐습니다');
    expect(simplifyForElderly('비밀번호 입력 후 확인을 누르세요')).toBe(
      '숫자를 눌러 비밀번호를 입력하세요 후 확인을 누르세요',
    );
    expect(simplifyForElderly('본인 인증이 필요합니다')).toBe('본인 확인이 필요합니다');
  });

  it('사전에 없는 문장은 그대로 둔다', () => {
    expect(simplifyForElderly('오늘 날씨가 좋습니다')).toBe('오늘 날씨가 좋습니다');
  });
});

describe('buildDeterministicElderlyGuide', () => {
  it('원본 답변만으로 STEP과 요약을 구성하고 새 정보를 추가하지 않는다', () => {
    const answer = '가까운 은행에 가세요. 카드를 넣으세요. 비밀번호를 입력하세요. 출금 버튼을 누르세요.';
    const guide = buildDeterministicElderlyGuide(answer, '은행에서 돈 찾는 법 알려줘');

    expect(guide.summary.length).toBeGreaterThan(0);
    expect(guide.steps.length).toBeGreaterThan(0);
    expect(guide.steps.length).toBeLessThanOrEqual(5);
    expect(guide.steps.every((step) => step.body.trim().length > 0)).toBe(true);
    // 결정론 폴백은 준비물·실수 예방을 추론하지 않는다(원문에 없는 정보이므로).
    expect(guide.checklist).toEqual([]);
    expect(guide.commonMistakes).toEqual([]);
    expect(guide.comprehensionPrompt).toBe('여기까지 이해되셨나요?');
    // 화면에는 항상 색 강조 박스가 최소 1개 있어야 한다.
    expect(guide.callouts.length).toBeGreaterThanOrEqual(1);
  });

  it('빈 답변에서도 항상 최소 1개의 STEP을 만든다', () => {
    const guide = buildDeterministicElderlyGuide('', '질문');
    expect(guide.steps.length).toBeGreaterThanOrEqual(1);
  });

  it('마크다운 답변을 고령자 화면용 일반 문장으로 정리한다', () => {
    const guide = buildDeterministicElderlyGuide(
      '### 1. 결론 및 핵심 원리\n**핵심:** 메뉴 고르기 → 결제하기 누르기 → 카드 꽂기\n---',
      '터치 화면 기계 쓰는 법',
    );

    const combined = [guide.summary, ...guide.steps.map((step) => step.body)].join('\n');
    expect(combined).not.toMatch(/[#*_`]|---/);
    expect(guide.steps.map((step) => step.body)).toEqual(['메뉴 고르기', '결제하기 누르기', '카드 꽂기']);
  });
});

describe('sanitizeElderlyGuide', () => {
  const fallback = buildDeterministicElderlyGuide('기본 답변입니다.', '질문');

  it('올바른 구조의 LLM 출력을 그대로 받아들이고 사전 치환을 적용한다', () => {
    const guide = sanitizeElderlyGuide(
      {
        summary: 'QR코드로 결제하는 방법입니다.',
        steps: [{ title: 'STEP 1', body: '인증을 진행하세요.' }],
        callouts: [{ tone: 'warning', text: '비밀번호 입력 후 확인하세요.' }],
        checklist: ['카드'],
        commonMistakes: [],
        nextActions: ['완료 버튼 누르기'],
        comprehensionPrompt: '이해되셨나요?',
      },
      fallback,
    );

    expect(guide.summary).toBe('네모 모양의 바코드로 결제하는 방법입니다.');
    expect(guide.steps[0].body).toBe('본인 확인을 진행하세요.');
    expect(guide.callouts[0].tone).toBe('warning');
    expect(guide.checklist).toEqual(['카드']);
  });

  it('steps가 비어 있으면 폴백으로 대체한다', () => {
    const guide = sanitizeElderlyGuide({ summary: '요약만 있음', steps: [] }, fallback);
    expect(guide).toBe(fallback);
  });

  it('올바르지 않은 입력이면 폴백을 그대로 반환한다', () => {
    expect(sanitizeElderlyGuide(null, fallback)).toBe(fallback);
    expect(sanitizeElderlyGuide('문자열', fallback)).toBe(fallback);
  });

  it('알 수 없는 tone은 remember로 대체한다', () => {
    const guide = sanitizeElderlyGuide(
      {
        summary: '요약',
        steps: [{ title: 'STEP 1', body: '내용' }],
        callouts: [{ tone: 'unknown', text: '문구' }],
        checklist: [],
        commonMistakes: [],
        nextActions: [],
        comprehensionPrompt: '',
      },
      fallback,
    );
    expect(guide.callouts[0].tone).toBe('remember');
  });

  it('LLM이 callouts를 비워도 항상 최소 1개는 채운다', () => {
    const guide = sanitizeElderlyGuide(
      {
        summary: '요약',
        steps: [{ title: 'STEP 1', body: '첫 단계 내용' }],
        callouts: [],
        checklist: [],
        commonMistakes: [],
        nextActions: [],
        comprehensionPrompt: '',
      },
      fallback,
    );
    expect(guide.callouts.length).toBeGreaterThanOrEqual(1);
  });

  it('LLM이 긴 마크다운 문단을 step에 넣으면 짧은 단계로 다시 나눈다', () => {
    const guide = sanitizeElderlyGuide(
      {
        summary: '**핵심:** 메뉴, 결제, 카드만 기억하세요.',
        steps: [
          {
            title: 'STEP 1',
            body: '### 1. 결론 및 핵심 원리\n**핵심:** 메뉴 고르기 → 결제하기 누르기 → 카드 꽂기\n---\n### 2. 상세 설명',
          },
        ],
        callouts: [],
        checklist: [],
        commonMistakes: [],
        nextActions: [],
        comprehensionPrompt: '',
      },
      fallback,
    );

    expect(guide.summary).toBe('메뉴, 결제, 카드만 기억하세요.');
    expect(guide.steps.map((step) => step.body)).toEqual(['메뉴 고르기', '결제하기 누르기', '카드 꽂기', '상세 설명']);
    expect(guide.steps.every((step) => !/[#*_`]|---/.test(step.body))).toBe(true);
  });
});

describe('cleanElderlyText', () => {
  it('화면에 보이면 안 되는 마크다운 기호를 제거한다', () => {
    expect(cleanElderlyText('### 제목\n**중요:** `확인`하세요.\n---')).toBe('제목\n중요: 확인하세요.');
  });
});
