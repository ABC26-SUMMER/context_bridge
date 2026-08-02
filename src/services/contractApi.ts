import type {
  AnswerResponse,
  BootstrapResponse,
  CreateContextRequest,
  CreateProfileRequest,
  CreateProposalRequest,
  GenerateAnswerRequest,
  ProposalResponse,
  ReexplainElderlyRequest,
  ReexplainElderlyResponse,
  ResolveMemoryRequest,
  ResolveMemoryResponse,
  StructuredContextDraft,
  UpdateContextRequest,
  UpdateProfileRequest,
  CreateProfileResponse,
  SaveContextResponse,
} from "../../contracts/types";
import { apiRequest } from "./apiClient";

export function getBootstrap(token: string) {
  return apiRequest<BootstrapResponse>("/bootstrap", {
    method: "GET",
    token,
  });
}

export function createProfile(token: string, request: CreateProfileRequest) {
  return apiRequest<CreateProfileResponse>("/profiles", {
    method: "POST",
    token,
    body: request,
  });
}

export function updateProfile(token: string, profileId: string, request: UpdateProfileRequest) {
  return apiRequest<CreateProfileResponse>(`/profiles/${encodeURIComponent(profileId)}`, {
    method: "PATCH",
    token,
    body: request,
  });
}

export function createContext(token: string, profileId: string, request: CreateContextRequest) {
  return apiRequest<SaveContextResponse>(`/profiles/${encodeURIComponent(profileId)}/contexts`, {
    method: "POST",
    token,
    body: request,
  });
}

export function updateContext(
  token: string,
  profileId: string,
  contextId: string,
  request: UpdateContextRequest,
) {
  return apiRequest<SaveContextResponse>(
    `/profiles/${encodeURIComponent(profileId)}/contexts/${encodeURIComponent(contextId)}`,
    { method: "PATCH", token, body: request },
  );
}

export function deleteContext(token: string, profileId: string, contextId: string) {
  return apiRequest<void>(
    `/profiles/${encodeURIComponent(profileId)}/contexts/${encodeURIComponent(contextId)}`,
    { method: "DELETE", token },
  );
}

export function createProposal(token: string, request: CreateProposalRequest) {
  return apiRequest<ProposalResponse>("/proposals", {
    method: "POST",
    token,
    body: request,
  });
}

export function generateAnswer(token: string, proposalId: string, request: GenerateAnswerRequest) {
  return apiRequest<AnswerResponse>(`/proposals/${encodeURIComponent(proposalId)}/answers`, {
    method: "POST",
    token,
    body: request,
  });
}

export function resolveMemory(token: string, candidateId: string, request: ResolveMemoryRequest) {
  return apiRequest<ResolveMemoryResponse>(`/memory-candidates/${encodeURIComponent(candidateId)}`, {
    method: "POST",
    token,
    body: request,
  });
}

export function structureContext(token: string, text: string) {
  return apiRequest<{ drafts: StructuredContextDraft[] }>("/context/structure", {
    method: "POST",
    token,
    body: { text },
  });
}

export function reexplainElderly(token: string, request: ReexplainElderlyRequest) {
  return apiRequest<ReexplainElderlyResponse>("/elderly/reexplain", {
    method: "POST",
    token,
    body: request,
  });
}
