import type {
  ContextCategory,
  PrivacyLevel,
} from "../../contracts/types";
import type { InteractionRecord, UserProfile } from "../types";
import {
  createContext as createContextApi,
  createProfile as createProfileApi,
  deleteContext as deleteContextApi,
  getBootstrap,
  updateContext as updateContextApi,
  updateProfile as updateProfileApi,
} from "./contractApi";
import { mapAuditLog, mapContractProfile } from "./contractMappers";

/**
 * UI 입력 타입만 이 모듈에 둔다. 데이터 접근은 모두 Controller API를 경유한다.
 * 브라우저가 account_profiles/context_cards/audit_logs를 직접 조회하거나 수정하지 않는다.
 */
export type ProfileInput = {
  displayName: string;
  personaType: "university_student" | "older_adult" | "custom";
  profileName: string;
  icon: string;
  description: string;
};

export type ContextCardInput = {
  label: string;
  valueText: string;
  category: ContextCategory;
  semanticGroup: string;
  tags?: string[];
  enabled: boolean;
  sensitivity: PrivacyLevel;
  rationale?: string;
};

export async function loadProfilesForUser(token: string): Promise<UserProfile[]> {
  const bootstrap = await getBootstrap(token);
  return bootstrap.profiles.map((profile) => mapContractProfile(profile, bootstrap.user.id));
}

export async function createProfile(token: string, input: ProfileInput): Promise<string> {
  const response = await createProfileApi(token, {
    displayName: input.displayName.trim(),
    personaType: input.personaType,
    name: input.profileName.trim(),
    icon: input.icon.trim() || "✨",
    description: input.description.trim(),
  });
  return response.profile.id;
}

export async function updateProfile(
  token: string,
  profileId: string,
  input: ProfileInput,
): Promise<void> {
  await updateProfileApi(token, profileId, {
    displayName: input.displayName.trim(),
    personaType: input.personaType,
    name: input.profileName.trim(),
    icon: input.icon.trim() || "✨",
    description: input.description.trim(),
  });
}

export async function createContextCard(
  token: string,
  profileId: string,
  input: ContextCardInput,
): Promise<void> {
  await createContextApi(token, profileId, {
    title: input.label.trim(),
    category: input.category,
    content: input.valueText.trim(),
    tags: [],
    isActive: input.enabled,
    privacyLevel: input.sensitivity,
  });
}

export async function updateContextCard(
  token: string,
  profileId: string,
  cardId: string,
  input: ContextCardInput,
): Promise<void> {
  await updateContextApi(token, profileId, cardId, {
    title: input.label.trim(),
    category: input.category,
    content: input.valueText.trim(),
    tags: [],
    isActive: input.enabled,
    privacyLevel: input.sensitivity,
  });
}

export async function deleteContextCard(
  token: string,
  profileId: string,
  cardId: string,
): Promise<void> {
  await deleteContextApi(token, profileId, cardId);
}

export async function loadQuestionHistory(
  token: string,
  profileId: string,
  profileName: string,
): Promise<InteractionRecord[]> {
  const bootstrap = await getBootstrap(token);
  return bootstrap.auditLogs
    .filter((log) => log.profileId === profileId)
    .map((log) => mapAuditLog(log, profileName));
}
