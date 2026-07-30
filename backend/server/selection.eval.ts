/**
 * 선별 정확도 평가 하네스 — 결정론 경로 A/B (재현 가능).
 *
 * 기존(v19) 결정론 선별 = v19relevance() 정규식 표 (아래 동결 baseline)
 * 신규(v20) 결정론 선별 = selectContexts(query, contexts)  [recall→reconcile, LLM 없음]
 *
 * 두 경로 모두 LLM 없는 순수 함수라, 골드 라벨 대비 정밀도/재현율/누락/과선별을
 * 결정론적으로 비교한다. LLM 2단계 경로의 아키텍처 우위는 selection.pipeline.eval.ts.
 */
import { ContextItem } from '../types.js';
import { selectContexts } from './selection.js';
import {
  Role, CASES, score, metrics, fmt,
} from './selection.fixtures.js';

// ── 기존 v19 relevance()를 그대로 동결(baseline). core.ts에서 이 함수를 제거했으므로
//    공정한 A/B를 위해 업로드된 v19 원문 구현을 여기에 보존한다.
function v19normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/[^0-9a-zA-Z가-힣]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function v19tokens(text: string): string[] {
  return v19normalize(text).split(' ').filter((t) => t.length >= 2);
}
function v19relevance(query: string, item: ContextItem): number {
  const q = v19normalize(query);
  const fullText = v19normalize([item.title, item.content, item.category, ...item.tags].join(' '));
  const qTokens = v19tokens(q);
  const uniqueHits = new Set(qTokens.filter((t) => fullText.includes(t))).size;
  const bigrams = (text: string) => {
    const compact = text.replace(/\s/g, '');
    return new Set(Array.from({ length: Math.max(0, compact.length - 1) }, (_, i) => compact.slice(i, i + 2)));
  };
  const qB = bigrams(q), hB = bigrams(fullText);
  const overlap = [...qB].filter((g) => hB.has(g)).length;
  const overlapRatio = qB.size ? overlap / qB.size : 0;
  const intentRules: Array<{ query: RegExp; context: RegExp; boost: number }> = [
    { query: /(공부|학습|시험|자격증|취업|직무|커리어|개발|코드|프로젝트)/, context: /(goal|project|profile|공부|학습|시험|자격증|취업|직무|개발|기술|전공)/, boost: 32 },
    { query: /(맛집|음식|먹|식당|요리|레시피|저녁|점심)/, context: /(constraint|preference|알레르|식단|음식|예산|맛|선호)/, boost: 34 },
    { query: /(외출|친구|만나|여행|걷|이동|장소|카페|데이트)/, context: /(constraint|preference|이동|보행|교통|접근성|장소|실내|좌석|예산)/, boost: 35 },
    { query: /(설명|알려|방법|어떻게|쉽게|자세히|요약)/, context: /(preference|profile|답변|설명|스타일|글씨|문장|단계)/, boost: 25 },
    { query: /(돈|가격|비용|저렴|예산)/, context: /(constraint|예산|가격|비용|학생|저렴)/, boost: 36 },
    { query: /(아프|건강|무릎|허리|알레르|복용|장애)/, context: /(constraint|건강|무릎|허리|알레르|복용|장애|접근성|보행)/, boost: 42 },
  ];
  const semanticBoost = intentRules.reduce((s, r) => s + (r.query.test(q) && r.context.test(fullText) ? r.boost : 0), 0);
  const categoryBoost = ['hard_limit'].includes(item.category) ? 18
    : ['soft_limit', 'resource', 'current_state'].includes(item.category) ? 12
    : ['preference', 'objective', 'capability'].includes(item.category) ? 8
    : item.category === 'constraint' ? 12 : item.category === 'goal' ? 7 : 3;
  const exactContentBoost = qTokens.some((t) => v19normalize(item.content).includes(t)) ? 12 : 0;
  return Math.round(Math.min(99, 8 + uniqueHits * 18 + overlapRatio * 38 + semanticBoost + categoryBoost + exactContentBoost));
}
const V19_THRESHOLD = 50;

function oldRoles(query: string, profile: ContextItem[]): Map<string, Role> {
  return new Map(
    profile.map((c) => {
      if (c.privacyLevel === 'confidential' || !c.isActive) return [c.id, 'ignore' as Role];
      const s = v19relevance(query, c);
      return [c.id, (s >= V19_THRESHOLD ? 'should_use' : 'ignore') as Role];
    }),
  );
}

async function newRoles(query: string, profile: ContextItem[]): Promise<Map<string, Role>> {
  const result = await selectContexts(query, profile); // ranker 없음 → 결정론 폴백
  const roles = new Map<string, Role>();
  for (const c of profile) roles.set(c.id, (result.overrides.get(c.id)?.role || 'ignore') as Role);
  return roles;
}

async function main() {
  const newPred = new Map<string, Map<string, Role>>();
  for (const c of CASES) newPred.set(c.name, await newRoles(c.query, c.profile));

  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(' Context Bridge 선별 정확도 A/B  (LLM 없는 결정론 경로, 골드 라벨 대비)');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  const oldAgg = score(CASES, (c) => oldRoles(c.query, c.profile));
  const newAgg = score(CASES, (c) => newPred.get(c.name)!);
  const oldR = metrics(oldAgg), newR = metrics(newAgg);
  console.log(fmt('기존 v19 relevance()', oldR));
  console.log(fmt('신규 v20 recall→reconcile', newR));

  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(' 사례별 치명적 누락(하드리밋/목표 must → ignore) 상세:');
  for (const c of CASES) {
    const oldP = oldRoles(c.query, c.profile);
    const nwP = newPred.get(c.name)!;
    for (const [id, g] of Object.entries(c.gold)) {
      if (g !== 'must_use') continue;
      const o = oldP.get(id), n = nwP.get(id);
      const flag = (r?: Role) => (r === 'ignore' ? '❌ignore' : r === 'optional' ? '△optional' : '✅' + r);
      if (o === 'ignore' || n === 'ignore') {
        console.log(`   [${c.name}] ${id}: 기존=${flag(o)}  신규=${flag(n)}`);
      }
    }
  }

  console.log('═══════════════════════════════════════════════════════════════════════════');
  const f1Ok = newR.f1 >= oldR.f1;
  const missOk = newR.criticalMiss <= oldR.criticalMiss;
  const precOk = newR.precision >= oldR.precision - 0.03;
  const verdict = f1Ok && missOk && precOk;
  console.log(' 채택 기준(다기준):');
  console.log(`   ① F1 ${(newR.f1 * 100).toFixed(1)}% ${f1Ok ? '≥' : '<'} ${(oldR.f1 * 100).toFixed(1)}%  → ${f1Ok ? 'OK' : 'FAIL'}`);
  console.log(`   ② 치명적 누락 ${newR.criticalMiss} ${missOk ? '≤' : '>'} ${oldR.criticalMiss}  → ${missOk ? 'OK' : 'FAIL'}`);
  console.log(`   ③ 정밀도 ${(newR.precision * 100).toFixed(1)}% ≥ ${(oldR.precision * 100).toFixed(1)}%−3%p  → ${precOk ? 'OK' : 'FAIL'}`);
  console.log(`   * 남은 누락(FN=${newR.fn})은 대부분 순수 의미격차(어휘 겹침 0) — LLM 랭커가 담당.`);
  console.log(` => ${verdict ? '✅ 신규 결정론 폴백 채택' : '⚠️ 재수정 필요'}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
  process.exit(verdict ? 0 : 1);
}

main();
