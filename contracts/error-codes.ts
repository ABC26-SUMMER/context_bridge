/**
 * 프론트 오류 처리 기준.
 *
 * ⚠️ v12 현재: 서버가 { error: string } 만 보낸다. code가 없다.
 * 따라서 지금은 HTTP status로 분기하고, 아래 code 상수는 백엔드가
 * { error: { code } } 형태로 올린 뒤(§9 P1) 쓰기 위한 예약이다.
 *
 * 프론트 원칙: message 문자열로 분기하지 말 것(문구는 언제든 바뀐다).
 * 지금은 status, 나중엔 code로.
 */

// 백엔드가 code를 올린 뒤 사용할 표준 코드
export const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  CONTEXT_RESTRICTED: 'CONTEXT_RESTRICTED',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
  PROPOSAL_ALREADY_PROCESSED: 'PROPOSAL_ALREADY_PROCESSED',
  PROPOSAL_EXPIRED: 'PROPOSAL_EXPIRED',
  MEMORY_ALREADY_RESOLVED: 'MEMORY_ALREADY_RESOLVED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  LLM_UNAVAILABLE: 'LLM_UNAVAILABLE',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// v12 과도기: status → 화면 처리 방침
export interface HandledError {
  userMessage: string;   // 사용자에게 보여줄 문구
  action: 'retry' | 'relogin' | 'goBack' | 'none';
}

export function handleStatus(status: number, serverMessage?: string): HandledError {
  switch (status) {
    case 401:
      return { userMessage: '로그인이 필요합니다. 다시 로그인해주세요.', action: 'relogin' };
    case 403:
      return { userMessage: serverMessage || '권한이 없습니다.', action: 'goBack' };
    case 404:
      return { userMessage: '대상을 찾을 수 없습니다.', action: 'goBack' };
    case 409:
      return { userMessage: '이미 처리된 요청입니다.', action: 'none' };
    case 429:
      return { userMessage: '요청이 많습니다. 잠시 후 다시 시도해주세요.', action: 'retry' };
    case 502:
    case 503:
      return { userMessage: '일시적 오류입니다. 다시 시도해주세요.', action: 'retry' };
    case 400:
    case 422:
      return { userMessage: serverMessage || '입력을 확인해주세요.', action: 'none' };
    default:
      return { userMessage: '문제가 발생했습니다. 다시 시도해주세요.', action: 'retry' };
  }
}
