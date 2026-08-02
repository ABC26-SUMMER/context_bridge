import type { ElderlyAnswerGuide, ElderlyCallout } from '../types.js';

/**
 * 고령자(older_adult) 페르소나 전용 답변 재구성.
 *
 * 중요: 이 모듈은 새로운 컨텍스트 접근 경로가 아니다. 입력은 항상
 * `answerGuard.validateAndRepairAnswer`를 이미 통과한 안전한 답변 텍스트이며,
 * 이 모듈은 그 텍스트를 고령자가 읽기 쉬운 구조(STEP/체크리스트/콜아웃)로
 * "재포장"만 한다. 새 개인정보를 만들어내거나 추론하지 않는다.
 */

const DEFAULT_COMPREHENSION_PROMPT = '여기까지 이해되셨나요?';

/** 어려운 용어를 쉬운 표현으로 바꾸는 사전. LLM이 놓쳐도 항상 적용되는 안전망이다. */
const ELDERLY_TERM_MAP: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /QR\s*코드/gi, replacement: '네모 모양의 바코드' },
  { pattern: /결제\s*승인/g, replacement: '결제가 완료되었습니다' },
  { pattern: /비밀번호\s*입력/g, replacement: '숫자를 눌러 비밀번호를 입력하세요' },
  { pattern: /본인\s*인증/g, replacement: '본인 확인' },
  { pattern: /인증/g, replacement: '본인 확인' },
  { pattern: /키오스크/g, replacement: '터치 화면 기계' },
  { pattern: /로그인/g, replacement: '접속하기' },
  { pattern: /와이파이|Wi-?Fi/gi, replacement: '인터넷 연결' },
  { pattern: /애플리케이션|어플리케이션/g, replacement: '휴대폰 프로그램(앱)' },
  { pattern: /다운로드/g, replacement: '내려받기' },
  { pattern: /업로드/g, replacement: '올리기' },
  { pattern: /클릭/g, replacement: '누르기' },
];

/** 사전 기반 치환만 하는 순수 함수. LLM 출력·결정론 폴백 양쪽에 동일하게 적용한다. */
export function simplifyForElderly(text: string): string {
  return ELDERLY_TERM_MAP.reduce((acc, { pattern, replacement }) => acc.replace(pattern, replacement), text);
}

export const ELDERLY_GUIDE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['title', 'body'],
      },
    },
    callouts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tone: { type: 'string', enum: ['warning', 'remember', 'next', 'first_action'] },
          text: { type: 'string' },
        },
        required: ['tone', 'text'],
      },
    },
    checklist: { type: 'array', items: { type: 'string' } },
    commonMistakes: { type: 'array', items: { type: 'string' } },
    nextActions: { type: 'array', items: { type: 'string' } },
    comprehensionPrompt: { type: 'string' },
  },
  required: ['summary', 'steps', 'callouts', 'checklist', 'commonMistakes', 'nextActions', 'comprehensionPrompt'],
};

interface ReformatOptions {
  /** true면 "다시 설명해주세요" 요청 — 더 쉽고 다른 방식(예시 중심)으로 다시 설명한다. */
  retry?: boolean;
}

/**
 * 이미 안전한 답변 텍스트를 고령자용 구조로 바꾸라는 지시 프롬프트.
 * 새 사실을 추가하거나 추측하지 말라고 명시해 재가공 단계에서 환각을 막는다.
 */
export function buildElderlyGuidePrompt(
  answerText: string,
  query: string,
  options: ReformatOptions = {},
): string {
  const extra = options.retry
    ? '\n\n이전과 똑같은 표현을 반복하지 말고, 더 쉽게(초등학생도 이해할 수 있는 수준으로) 그리고 다른 방식으로(예: 구체적인 예시를 들어서) 다시 설명하세요. 문장을 더 짧게 쪼개세요.'
    : '';
  return `당신은 고령자를 위한 안내문을 만드는 도우미입니다.
아래 [원본 답변]에 있는 내용만 사용해서, 고령자가 읽기 쉬운 구조로 다시 정리하세요.
[원본 답변]에 없는 새로운 정보나 추측을 절대 추가하지 마세요.

[사용자 질문]
${query}

[원본 답변]
${answerText}

작성 규칙:
1. 쉬운 단어만 사용하세요. 전문 용어는 쉬운 말로 풀어서 쓰세요(예: QR코드→네모 모양의 바코드, 인증→본인 확인).
2. 한 문장은 20~25자 정도로 짧게 쓰세요. 긴 문단을 만들지 마세요.
3. 실행 순서가 있으면 한 번에 한 단계씩 STEP으로 나누세요(steps).
4. 중요한 내용은 callouts로 분리하세요. callouts는 반드시 최소 1개 이상 포함하세요.
   - warning: 반드시 조심해야 하는 것
   - remember: 꼭 기억해야 하는 것
   - next: 다음에 할 행동
   - first_action: 가장 먼저 해야 하는 행동
5. 준비물이 있으면 checklist에, 실수하기 쉬운 부분이 있으면 commonMistakes에 담으세요. 없으면 빈 배열로 두세요.
6. nextActions에는 답변을 읽은 뒤 사용자가 할 다음 행동을 순서대로 담으세요.
7. summary는 전체 내용을 한 줄로 요약하세요.
8. comprehensionPrompt는 "여기까지 이해되셨나요?"처럼 이해를 확인하는 짧은 질문으로 쓰세요.
9. 중요한 문장은 steps 안에서 한 번 더 반복해도 됩니다.${extra}`;
}

/** 문장을 분리한다(마침표/느낌표/물음표/줄바꿈 기준). */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** 문장을 20~25자 내외로 다시 쪼갠다(쉼표 우선, 없으면 길이 기준). */
function toShortSentences(sentence: string): string[] {
  if (sentence.length <= 26) return [sentence];
  const byComma = sentence.split(/,\s*/).map((part) => part.trim()).filter(Boolean);
  if (byComma.length > 1) return byComma;
  const out: string[] = [];
  for (let i = 0; i < sentence.length; i += 24) out.push(sentence.slice(i, i + 24).trim());
  return out.filter(Boolean);
}

/**
 * generateStructured 실패·오프라인일 때 쓰는 결정론적 폴백.
 * 안전한 답변 텍스트를 문장 단위로 나눠 STEP 3~5개로 배분한다.
 * 준비물·실수 예방처럼 원문에 없는 정보는 추론하지 않고 빈 배열로 둔다.
 */
export function buildDeterministicElderlyGuide(answerText: string, _query: string): ElderlyAnswerGuide {
  const sentences = splitSentences(simplifyForElderly(answerText)).flatMap(toShortSentences);
  const meaningful = sentences.length ? sentences : [simplifyForElderly(answerText) || '답변을 준비하지 못했습니다.'];

  const stepCount = Math.min(5, Math.max(1, Math.ceil(meaningful.length / 2)));
  const perStep = Math.ceil(meaningful.length / stepCount);
  const rawSteps = Array.from({ length: stepCount }, (_, index) => {
    const chunk = meaningful.slice(index * perStep, index * perStep + perStep);
    return { title: `STEP ${index + 1}`, body: chunk.join(' ') || meaningful[meaningful.length - 1] };
  }).filter((step) => step.body.trim());
  const steps = rawSteps.length ? rawSteps : [{ title: 'STEP 1', body: meaningful[0] || '' }];

  return {
    summary: meaningful[0] || '',
    steps,
    // 화면에는 항상 색 강조 박스가 최소 1개 보여야 하므로, 폴백에서도 반드시 채운다.
    callouts: [{ tone: 'remember', text: '한 번에 한 단계씩 천천히 진행하세요.' }],
    checklist: [],
    commonMistakes: [],
    nextActions: [],
    comprehensionPrompt: DEFAULT_COMPREHENSION_PROMPT,
  };
}

/** LLM 결과를 안전하게 정리한다. 배열/문자열이 아니면 기본값으로 대체한다. */
export function sanitizeElderlyGuide(value: unknown, fallback: ElderlyAnswerGuide): ElderlyAnswerGuide {
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Record<string, unknown>;
  const strings = (input: unknown): string[] =>
    Array.isArray(input) ? input.map(String).map((item) => simplifyForElderly(item.trim())).filter(Boolean) : [];
  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item, index) => ({
          title: String(item.title || `STEP ${index + 1}`).trim(),
          body: simplifyForElderly(String(item.body || '').trim()),
        }))
        .filter((step) => step.body)
    : [];
  const validTones = new Set(['warning', 'remember', 'next', 'first_action']);
  const callouts = Array.isArray(raw.callouts)
    ? raw.callouts
        .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          tone: validTones.has(String(item.tone)) ? (item.tone as ElderlyCallout['tone']) : 'remember',
          text: simplifyForElderly(String(item.text || '').trim()),
        }))
        .filter((callout) => callout.text)
    : [];

  if (!steps.length) return fallback;

  // 화면에는 항상 색 강조 박스가 최소 1개 있어야 하므로, LLM이 callouts를 비워서
  // 주면 첫 STEP 내용을 기반으로 하나를 만들어 채운다.
  const finalCallouts: ElderlyCallout[] = callouts.length
    ? callouts
    : [{ tone: 'remember', text: steps[0].body || fallback.callouts[0]?.text || '한 번에 한 단계씩 천천히 진행하세요.' }];

  return {
    summary: simplifyForElderly(String(raw.summary || '').trim()) || fallback.summary,
    steps,
    callouts: finalCallouts,
    checklist: strings(raw.checklist),
    commonMistakes: strings(raw.commonMistakes),
    nextActions: strings(raw.nextActions),
    comprehensionPrompt: String(raw.comprehensionPrompt || '').trim() || DEFAULT_COMPREHENSION_PROMPT,
  };
}
