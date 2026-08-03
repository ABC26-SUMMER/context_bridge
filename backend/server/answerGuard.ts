import type { ContextItem } from '../types.js';

export type AnswerIssue =
  | 'UNAPPROVED_PRIVATE_CONTEXT'
  | 'APPROVED_REQUIRED_CONTEXT_MISSING'
  | 'QUESTION_NOT_ANSWERED'
  | 'UNNECESSARY_PRIVATE_REPETITION';

export interface GuardResult {
  answer: string;
  repaired: boolean;
  issues: AnswerIssue[];
}

function normalized(text: string): string {
  return text.toLocaleLowerCase().replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
}

function meaningfulFragments(item: ContextItem): string[] {
  return [item.title, item.content]
    .map(normalized)
    .filter((value) => value.length >= 4);
}

export function inspectAnswer(
  query: string,
  answer: string,
  approved: ContextItem[],
  unapproved: ContextItem[],
): AnswerIssue[] {
  const issues = new Set<AnswerIssue>();
  const compact = normalized(answer);

  if (unapproved.some((item) => meaningfulFragments(item).some((value) => compact.includes(value)))) {
    issues.add('UNAPPROVED_PRIVATE_CONTEXT');
  }

  const required = approved.filter((item) => ['hard_limit', 'constraint'].includes(item.category));
  if (required.some((item) => !meaningfulFragments(item).some((value) => compact.includes(value)))) {
    issues.add('APPROVED_REQUIRED_CONTEXT_MISSING');
  }

  if (answer.trim().length < 20 || !normalized(query).slice(0, 4) || answer.trim().endsWith('?')) {
    issues.add('QUESTION_NOT_ANSWERED');
  }

  for (const item of approved) {
    const content = normalized(item.content);
    if (content.length >= 4 && compact.split(content).length - 1 > 2) {
      issues.add('UNNECESSARY_PRIVATE_REPETITION');
    }
  }
  return [...issues];
}

function removeLeakingSentences(answer: string, unapproved: ContextItem[]): string {
  const forbidden = unapproved.flatMap(meaningfulFragments);
  return answer
    .split(/(?<=[.!?。]|다\.)\s+|\n+/)
    .filter((sentence) => {
      const compact = normalized(sentence);
      return !forbidden.some((value) => compact.includes(value));
    })
    .join('\n')
    .trim();
}

export async function validateAndRepairAnswer(input: {
  query: string;
  draft: string;
  approved: ContextItem[];
  unapproved: ContextItem[];
  generate: (prompt: string) => Promise<string>;
}): Promise<GuardResult> {
  const firstIssues = inspectAnswer(input.query, input.draft, input.approved, input.unapproved);
  if (!firstIssues.length) return { answer: input.draft, repaired: false, issues: [] };

  const approvedText = input.approved
    .map((item) => `- [${item.category}] ${item.title}: ${item.content}`)
    .join('\n');
  const sanitizedDraft = removeLeakingSentences(input.draft, input.unapproved);
  const repairPrompt = `[사용자 질문]
${input.query}

[사용자가 승인한 맥락]
${approvedText || '(없음)'}

[수정할 답변]
${sanitizedDraft || '(안전하게 제거된 초안)'}

[검증 문제 코드]
${firstIssues.join(', ')}

승인 목록 밖의 개인정보를 새로 쓰거나 추측하지 말고, 질문에 직접 답하세요.
승인된 맥락은 단순 참고가 아니라 답변의 판단 기준입니다.
각 승인 맥락이 이번 질문의 선택지, 우선순위, 설명 난이도, 실행 방법 중 무엇을 바꾸는지 먼저 해석한 뒤 답변하세요.
승인된 필수 조건은 결론과 실행 방법에 실제로 반영하되 개인정보를 불필요하게 반복하지 마세요.
실시간 확인이 필요한 값은 단정하지 말고 확인 방법을 분리하세요.
수정된 최종 답변만 출력하세요.`;

  let repaired = await input.generate(repairPrompt);
  const remaining = inspectAnswer(input.query, repaired, input.approved, input.unapproved);
  if (remaining.includes('UNAPPROVED_PRIVATE_CONTEXT')) {
    repaired = removeLeakingSentences(repaired, input.unapproved);
  }
  const finalIssues = inspectAnswer(input.query, repaired, input.approved, input.unapproved);
  if (finalIssues.includes('UNAPPROVED_PRIVATE_CONTEXT') || !repaired.trim()) {
    repaired = input.approved.length
      ? `승인한 조건(${input.approved.map((item) => item.content).join(', ')}) 안에서 가능한 선택지를 검토해 주세요. 질문에 필요한 세부 정보가 부족하면 추가 확인 후 결정하는 것이 안전합니다.`
      : `현재 승인된 개인 정보가 없으므로 일반적인 범위에서 답합니다. 구체적인 조건을 직접 알려 주시면 그 범위 안에서 선택지를 좁힐 수 있습니다.`;
  }
  return { answer: repaired, repaired: true, issues: firstIssues };
}
