import type { ConversationSession } from "../types";

export const MAX_TURNS_PER_SESSION = 20;

const storageKey = (profileId: string) => `context-bridge:conversations:${profileId}`;

export function loadConversationSessions(profileId: string): ConversationSession[] {
  try {
    const raw = window.localStorage.getItem(storageKey(profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ConversationSession[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((session) => session?.profileId === profileId && Array.isArray(session.turns))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveConversationSessions(profileId: string, sessions: ConversationSession[]) {
  window.localStorage.setItem(storageKey(profileId), JSON.stringify(sessions));
}

export function createConversationSession(profileId: string): ConversationSession {
  const now = new Date().toISOString();
  return {
    id: createId("session"),
    profileId,
    title: "새 대화",
    createdAt: now,
    updatedAt: now,
    turns: [],
  };
}

export function createConversationId() {
  return createId("turn");
}

export function conversationTitle(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized || "새 대화";
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
