/**
 * 평가용 골드 픽스처 (단일 출처).
 *
 * 결정론 A/B(selection.eval.ts)와 전체 파이프라인 A/B(selection.pipeline.eval.ts)가
 * "같은 페르소나 · 같은 골드 라벨"을 공유해야 비교가 공정하다. 그래서 여기 한 곳에만 둔다.
 */
import { ContextItem } from '../types.js';

export type Role = 'must_use' | 'should_use' | 'optional' | 'ignore';

export function ctx(
  id: string,
  category: ContextItem['category'],
  title: string,
  content: string,
  opts: Partial<ContextItem> = {},
): ContextItem {
  return {
    id, category, title, content,
    tags: [],
    isActive: true,
    privacyLevel: 'normal',
    updatedAt: '2026-07-29T00:00:00.000Z',
    ...opts,
  };
}

// ── 페르소나 1: 전이현(대학생) — v19 taxonomy로 표현 ──────────────────────────
export const student: ContextItem[] = [
  ctx('s_occ', 'identity', '현재 상태', '대학생'),
  ctx('s_major', 'identity', '전공', 'AI·SW학과'),
  ctx('s_grade', 'identity', '학년', '3학년'),
  ctx('s_career', 'objective', '진로 목표', '공기업 전산직'),
  ctx('s_cert', 'objective', '자격증 목표', 'SQLD, 정보처리기사'),
  ctx('s_skills', 'capability', '현재 기술', 'Python, React, Supabase'),
  ctx('s_time', 'resource', '공부 가능 시간', '평일 1시간'),
  ctx('s_transport', 'resource', '이동 방식', '대중교통'),
  ctx('s_budget', 'soft_limit', '예산 수준', '대학생 수준 저렴한 비용', { privacyLevel: 'sensitive' }),
  ctx('s_place', 'preference', '장소 취향', '조용한 장소, 사진 찍기 좋은 공간'),
  ctx('s_style', 'preference', '답변 방식', '구체적이고 단계적인 설명'),
];

// ── 페르소나 2: 김영자(고령) ────────────────────────────────────────────────
export const senior: ContextItem[] = [
  ctx('o_age', 'identity', '연령대', '70대', { privacyLevel: 'sensitive' }),
  ctx('o_digital', 'capability', '디지털 숙련도', '초급'),
  ctx('o_mobility', 'hard_limit', '이동 조건', '장시간 보행 어려움', { privacyLevel: 'sensitive' }),
  ctx('o_transport', 'resource', '이동 방식', '버스와 지하철'),
  ctx('o_place', 'preference', '장소 취향', '좌석이 있는 곳, 실내 공간'),
  ctx('o_access', 'preference', '접근성 선호', '큰 글씨, 짧은 문장, 쉬운 표현, 단계별 안내'),
  ctx('o_style', 'preference', '답변 방식', '짧고 쉬운 설명'),
];

export interface Case {
  name: string;
  query: string;
  profile: ContextItem[];
  gold: Record<string, Role>; // 명시 안 한 카드는 ignore로 간주
}

export const CASES: Case[] = [
  {
    name: 'P1 SQLD 공부 순서 (어휘 강함)',
    query: 'SQLD 자격증 공부 순서 알려줘',
    profile: student,
    gold: { s_cert: 'must_use', s_skills: 'should_use', s_time: 'should_use', s_career: 'should_use', s_style: 'optional' },
  },
  {
    name: 'P1 새 언어 추천 (Python 어휘)',
    query: 'Python 말고 새로 배울 언어 추천해줘',
    profile: student,
    gold: { s_skills: 'must_use', s_career: 'should_use', s_cert: 'should_use', s_style: 'optional' },
  },
  {
    name: 'P1 평일 1시간 계획 (시간 어휘)',
    query: '평일에 공부할 시간이 1시간뿐인데 계획 짜줘',
    profile: student,
    gold: { s_time: 'must_use', s_cert: 'should_use', s_career: 'should_use', s_skills: 'should_use', s_style: 'optional' },
  },
  {
    name: 'P1 카페 추천 (장소·사진 어휘)',
    query: '사진 찍기 좋은 조용한 카페 어디 없을까?',
    profile: student,
    gold: { s_place: 'must_use', s_transport: 'should_use', s_budget: 'should_use' },
  },
  {
    name: 'P1 방학 학습 (의미 격차: 공부↔목표)',
    query: '이번 방학에 뭐 공부하면 좋을까?',
    profile: student,
    gold: { s_cert: 'should_use', s_career: 'should_use', s_skills: 'should_use', s_time: 'should_use', s_style: 'optional' },
  },
  {
    name: 'P2 버스 실내 나들이 (교통·실내 어휘)',
    query: '버스 타고 갈 수 있는 실내 나들이 장소 추천',
    profile: senior,
    gold: { o_transport: 'must_use', o_place: 'should_use', o_mobility: 'should_use', o_access: 'optional' },
  },
  {
    name: 'P2 키오스크 사용법 (쉽게 어휘)',
    query: '키오스크 쓰는 법 쉽게 알려줘',
    profile: senior,
    gold: { o_digital: 'should_use', o_access: 'should_use', o_style: 'should_use' },
  },
  {
    name: 'P2 무릎 때문에 외출 (하드리밋 의미격차: 걷다↔보행)',
    query: '무릎 때문에 오래 못 걷는데 갈만한 곳 있어?',
    profile: senior,
    gold: { o_mobility: 'must_use', o_place: 'should_use', o_transport: 'should_use' },
  },
  {
    name: 'P2 딸과 외출 (의미격차: 외출↔이동/장소)',
    query: '내일 딸이랑 어디 가면 좋아?',
    profile: senior,
    gold: { o_mobility: 'must_use', o_place: 'should_use', o_transport: 'should_use', o_access: 'optional' },
  },
  {
    name: 'P1 무관 질문 (과선별 함정)',
    query: '오늘 서울 날씨 어때?',
    profile: student,
    gold: {}, // 아무 개인 맥락도 surfaced되면 안 됨
  },
];

// ── 공용 메트릭 ─────────────────────────────────────────────────────────────
export const surfaced = (r: Role) => r === 'must_use' || r === 'should_use';

export interface Agg { tp: number; fp: number; fn: number; criticalMiss: number; }

export function score(cases: Case[], predict: (c: Case) => Map<string, Role>): Agg {
  const a: Agg = { tp: 0, fp: 0, fn: 0, criticalMiss: 0 };
  for (const c of cases) {
    const pred = predict(c);
    for (const card of c.profile) {
      const g = (c.gold[card.id] || 'ignore') as Role;
      const p = pred.get(card.id) || 'ignore';
      const gs = surfaced(g), ps = surfaced(p);
      if (gs && ps) a.tp++;
      else if (!gs && ps) a.fp++;
      else if (gs && !ps) a.fn++;
      if (g === 'must_use' && p === 'ignore') a.criticalMiss++;
    }
  }
  return a;
}

export function metrics(a: Agg) {
  const precision = a.tp + a.fp ? a.tp / (a.tp + a.fp) : 1;
  const recall = a.tp + a.fn ? a.tp / (a.tp + a.fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const overSel = a.tp + a.fp ? a.fp / (a.tp + a.fp) : 0;
  return { precision, recall, f1, overSel, criticalMiss: a.criticalMiss, fn: a.fn, fp: a.fp };
}

export function fmt(label: string, m: ReturnType<typeof metrics>): string {
  return (
    `${label.padEnd(30)} P=${(m.precision * 100).toFixed(1)}%  R=${(m.recall * 100).toFixed(1)}%  ` +
    `F1=${(m.f1 * 100).toFixed(1)}%  누락(FN)=${m.fn}  과선별(FP)=${m.fp}  치명적누락=${m.criticalMiss}`
  );
}
