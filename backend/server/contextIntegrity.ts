import type { ContextItem } from '../types.js';

export interface IntegrityResult {
  warnings: string[];
  requiresReview: boolean;
}

function normalized(text: string): string {
  return text.toLocaleLowerCase().replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
}

function amounts(text: string): string[] {
  return [...text.matchAll(/(\d[\d,]*)\s*(원|만원|분|시간|일|주|개월)/g)]
    .map((match) => `${match[1].replace(/,/g, '')}${match[2]}`);
}

export function inspectIntegrity(
  query: string,
  item: ContextItem,
  all: ContextItem[],
  isStale: boolean,
): IntegrityResult {
  const warnings: string[] = [];
  if (isStale) warnings.push('오래된 정보라 사용 전 확인이 필요합니다.');

  const queryAmounts = amounts(query);
  const cardAmounts = amounts(item.content);
  if (queryAmounts.length && cardAmounts.length && queryAmounts.some((q) => !cardAmounts.includes(q))) {
    warnings.push('현재 질문에 적힌 조건과 저장된 값이 다릅니다.');
  }

  const title = normalized(item.title);
  const contradiction = all.some((other) =>
    other.id !== item.id &&
    other.isActive &&
    normalized(other.title) === title &&
    normalized(other.content) !== normalized(item.content),
  );
  if (contradiction) warnings.push('같은 항목의 다른 카드와 값이 다릅니다.');

  return { warnings, requiresReview: warnings.length > 0 };
}
