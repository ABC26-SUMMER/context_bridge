import { intentRules } from "../data/intentRules";
import type { DetectedIntent } from "../types";

export function detectIntent(question: string): DetectedIntent {
  const normalized = question.trim().toLowerCase();
  let best = intentRules[0];
  let bestScore = -1;

  for (const rule of intentRules) {
    const score = rule.keywords.reduce(
      (sum, keyword) => (normalized.includes(keyword) ? sum + 1 : sum),
      0,
    );

    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }

  if (bestScore <= 0) {
    return { ...intentRules[2], confidence: 64, lowConfidence: true };
  }

  return best;
}
