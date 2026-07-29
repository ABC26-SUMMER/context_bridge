import type { ErrorResponseV12 } from "../../contracts/types";

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";

export class ApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token: string;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const url = `${configuredBaseUrl}/api${path.startsWith("/") ? path : `/${path}`}`;
  const { body, token: _token, ...requestOptions } = options;
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${options.token}`);

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...requestOptions,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("API 서버에 연결할 수 없습니다. Mock 서버 실행 상태를 확인해 주세요.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const serverMessage = isErrorResponse(payload) ? payload.error : undefined;
    throw new ApiError(serverMessage || getStatusMessage(response.status), response.status);
  }

  return payload as T;
}

function getStatusMessage(status: number) {
  switch (status) {
    case 400:
      return "요청 내용을 확인한 뒤 다시 시도해 주세요.";
    case 401:
      return "로그인이 필요하거나 세션이 만료되었습니다.";
    case 403:
      return "이 작업을 수행할 권한이 없습니다.";
    case 404:
      return "요청한 프로필 또는 데이터를 찾을 수 없습니다.";
    default:
      return "API 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    if (response.ok) return undefined;
    throw new ApiError(getStatusMessage(response.status), response.status);
  }
}

function isErrorResponse(payload: unknown): payload is ErrorResponseV12 {
  return Boolean(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string");
}
