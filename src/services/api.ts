import {
  ContextAnalysisResponse,
  ContextItem,
  ContextProfile,
  MemoryCandidate,
  QueryAuditLog,
} from '../types';

let accessToken = '';
export function setApiAccessToken(token: string) {
  accessToken = token;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || '요청 처리에 실패했습니다.');
  return body as T;
}

export function analyzeQueryContext(
  query: string,
  profileId: string,
): Promise<ContextAnalysisResponse> {
  return fetch('/api/proposals', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ query, profileId }),
  }).then(json<ContextAnalysisResponse>);
}

export interface GenerateAnswerResponse {
  contextBridgeAnswer: string;
  rawAnswer?: string;
  usedContexts: ContextItem[];
  usedContextsCount: number;
  snapshotHash: string;
  memoryCandidates: MemoryCandidate[];
  auditLog: QueryAuditLog;
}

export function generatePersonalizedAnswer(
  proposalId: string,
  approvedIds: string[],
  includeRawComparison = true,
  tempNote?: string,
): Promise<GenerateAnswerResponse> {
  return fetch(`/api/proposals/${proposalId}/generate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      approvedIds,
      includeRawComparison,
      tempNote,
    }),
  }).then(json<GenerateAnswerResponse>);
}

export function resolveMemoryCandidate(
  candidateId: string,
  action: 'save' | 'ignore',
): Promise<{ context?: ContextItem; profileId: string }> {
  return fetch(`/api/memory-candidates/${candidateId}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ action }),
  }).then(json<{ context?: ContextItem; profileId: string }>);
}

export interface AccountData {
  user: { id: string; email: string };
  profiles: ContextProfile[];
  auditLogs: QueryAuditLog[];
  mode: 'supabase' | 'local-demo';
}

export function loadAccountData(): Promise<AccountData> {
  return fetch('/api/bootstrap', { headers: headers() }).then(json<AccountData>);
}

export function persistContext(profileId: string, context: ContextItem) {
  return fetch(`/api/profiles/${profileId}/contexts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ context }),
  }).then(json<{ context: ContextItem }>);
}

export function persistProfile(input: { name: string; icon: string; description: string }) {
  return fetch('/api/profiles', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input),
  }).then(json<{ profile: ContextProfile }>);
}

export async function removeContext(profileId: string, contextId: string) {
  const response = await fetch(`/api/profiles/${profileId}/contexts/${contextId}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!response.ok) await json(response);
}
