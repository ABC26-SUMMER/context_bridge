import type {
  AnswerResponse,
  BootstrapResponse,
  CreateProposalRequest,
  GenerateAnswerRequest,
  ProposalResponse,
  ResolveMemoryRequest,
  ResolveMemoryResponse,
} from "../../contracts/types";
import { apiRequest } from "./apiClient";

export function getBootstrap(token: string) {
  return apiRequest<BootstrapResponse>("/bootstrap", {
    method: "GET",
    token,
  });
}

export function createProposal(token: string, request: CreateProposalRequest) {
  return apiRequest<ProposalResponse>("/proposals", {
    method: "POST",
    token,
    body: request,
  });
}

export function generateAnswer(token: string, proposalId: string, request: GenerateAnswerRequest) {
  return apiRequest<AnswerResponse>(`/proposals/${encodeURIComponent(proposalId)}/generate`, {
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
