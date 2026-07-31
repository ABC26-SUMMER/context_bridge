import { describe, expect, it } from 'vitest';
import { extractByRules, selectMemoryCandidates } from './memory';
import type { ContextItem } from '../types';

const diverse = [
  ['고령자', '작은 글씨를 보기 어려워요', '작은 글씨 보기 어려움'],
  ['고령자', '아침마다 혈압약을 복용해요', '매일 아침 혈압약 복용'],
  ['고령자', '앱 설치가 어려워요', '앱 설치 어려움'],
  ['고령자', '매주 수요일 복지관에 가요', '매주 수요일 복지관에'],
  ['일반인', '재택근무를 하고 모니터가 있어요', '재택근무 생활 패턴'],
  ['일반인', '재택근무를 하고 모니터가 있어요', '모니터 보유'],
  ['일반인', '고양이와 함께 살아요', '고양이와 함께 거주'],
  ['일반인', '야간 근무를 해요', '야간 근무 생활 패턴'],
  ['일반인', '한국어로 설명해주는 걸 선호해요', '한국어 설명 선호'],
  ['대학생', '캡스톤에서 백엔드를 담당하고 Supabase를 사용해요', '캡스톤 백엔드 역할'],
  ['대학생', '캡스톤에서 백엔드를 담당하고 Supabase를 사용해요', 'Supabase 사용'],
  ['대학생', 'BrainAccess HALO로 EEG 연구를 해요', 'BrainAccess HALO EEG 연구'],
  ['대학생', '왕복 3시간 통학해요', '왕복 3시간 통학'],
] as const;

describe('다양한 페르소나 오프라인 기억 추출', () => {
  it.each(diverse)('%s: %s', (_persona, query, expected) => {
    expect(extractByRules(query).map((m) => m.content)).toContain(expected);
  });

  it('질문 명령을 제외하고 해군 계획만 원자화한다', () => {
    const found = extractByRules('해군 입대 예정이지만 오늘은 군대 이야기를 제외하고 취업 계획만 알려줘');
    expect(found.map((m) => m.content)).toEqual(['해군 입대 예정']);
  });

  it('토익 점수 변경은 CREATE가 아니라 UPDATE다', () => {
    const existing: ContextItem[] = [{
      id: '11111111-1111-4111-8111-111111111111', title: '어학 성적', category: 'capability',
      content: '토익 700점', tags: [], isActive: true, privacyLevel: 'normal', updatedAt: new Date().toISOString(),
    }];
    const [candidate] = selectMemoryCandidates('토익 780점이야', existing, extractByRules('토익 780점이야'));
    expect(candidate.operation).toBe('UPDATE');
    expect(candidate.updateTargetId).toBe(existing[0].id);
    expect(candidate.content).toBe('토익 780점');
  });

  it('계좌번호와 오늘의 일회성 상태는 저장하지 않는다', () => {
    expect(extractByRules('내 계좌번호는 123-456이야 기억해줘')).toEqual([]);
    expect(extractByRules('오늘 우산을 두고 왔어')).toEqual([]);
  });
});
