import type { ContextCategory, PrivacyLevel } from "../../contracts/types";
import type { InteractionRecord, ProfileField, UserProfile } from "../types";
import { requireSupabase } from "./supabaseClient";

export type AccountProfileRow = {
  id: string;
  user_id: string;
  display_name: string;
  persona_type: string;
  profile_name: string;
  icon: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ContextCardRow = {
  id: string;
  user_id: string;
  profile_id: string;
  semantic_group: string;
  category: ContextCategory;
  label: string;
  value_text: string;
  tags: string[];
  enabled: boolean;
  sensitivity: PrivacyLevel;
  version: number;
  created_at: string;
  updated_at: string;
};

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
  tags: string[];
  enabled: boolean;
  sensitivity: PrivacyLevel;
};

export async function loadProfilesForUser(): Promise<UserProfile[]> {
  const supabase = requireSupabase();
  const [{ data: profileRows, error: profileError }, { data: cardRows, error: cardError }] = await Promise.all([
    supabase
      .from("account_profiles")
      .select("id,user_id,display_name,persona_type,profile_name,icon,description,is_active,created_at,updated_at")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("context_cards")
      .select("id,user_id,profile_id,semantic_group,category,label,value_text,tags,enabled,sensitivity,version,created_at,updated_at")
      .order("created_at", { ascending: true }),
  ]);

  if (profileError) throw new Error(profileError.message);
  if (cardError) throw new Error(cardError.message);

  const profiles = (profileRows || []) as AccountProfileRow[];
  const cards = (cardRows || []) as ContextCardRow[];
  return profiles.map((profile) => mapProfile(profile, cards.filter((card) => card.profile_id === profile.id)));
}

export async function createProfile(userId: string, input: ProfileInput): Promise<void> {
  const { error } = await requireSupabase().from("account_profiles").insert({
    user_id: userId,
    display_name: input.displayName.trim(),
    persona_type: input.personaType,
    profile_name: input.profileName.trim(),
    icon: input.icon.trim() || "CB",
    description: input.description.trim(),
    is_active: true,
  });

  if (error) throw new Error(error.message);
}

export async function updateProfile(profileId: string, input: ProfileInput): Promise<void> {
  const { error } = await requireSupabase()
    .from("account_profiles")
    .update({
      display_name: input.displayName.trim(),
      persona_type: input.personaType,
      profile_name: input.profileName.trim(),
      icon: input.icon.trim() || "CB",
      description: input.description.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (error) throw new Error(error.message);
}

export async function createContextCard(userId: string, profileId: string, input: ContextCardInput): Promise<void> {
  const { error } = await requireSupabase().from("context_cards").insert({
    user_id: userId,
    profile_id: profileId,
    semantic_group: input.semanticGroup.trim() || input.category,
    category: input.category,
    label: input.label.trim(),
    value_text: input.valueText.trim(),
    tags: input.tags,
    enabled: input.enabled,
    sensitivity: input.sensitivity,
  });

  if (error) throw new Error(error.message);
}

export async function updateContextCard(cardId: string, input: ContextCardInput): Promise<void> {
  const { error } = await requireSupabase()
    .from("context_cards")
    .update({
      semantic_group: input.semanticGroup.trim() || input.category,
      category: input.category,
      label: input.label.trim(),
      value_text: input.valueText.trim(),
      tags: input.tags,
      enabled: input.enabled,
      sensitivity: input.sensitivity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId);

  if (error) throw new Error(error.message);
}

export async function deleteContextCard(cardId: string): Promise<void> {
  const { error } = await requireSupabase().from("context_cards").delete().eq("id", cardId);
  if (error) throw new Error(error.message);
}

export async function loadQuestionHistory(profileName: string): Promise<InteractionRecord[]> {
  const { data, error } = await requireSupabase().from("audit_logs").select("*").limit(50);
  if (error) throw new Error(error.message);

  return ((data || []) as Record<string, unknown>[])
    .map((row) => mapAuditRow(row, profileName))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mapProfile(profile: AccountProfileRow, cards: ContextCardRow[]): UserProfile {
  const easy = profile.persona_type === "older_adult";

  return {
    id: profile.id,
    accountId: profile.user_id,
    name: profile.display_name,
    group: profile.description || profile.profile_name,
    personaType: profile.persona_type,
    profileName: profile.profile_name,
    icon: profile.icon,
    description: profile.description,
    source: "supabase",
    uiMode: easy ? "easy" : "standard",
    defaultQuestion: easy ? "내 상황에 맞게 쉽게 설명해 줘" : "내 상황에 맞는 계획을 세워 줘",
    examples: easy
      ? ["내 상황에 맞게 쉽게 설명해 줘", "키오스크 쓰는 법을 단계별로 알려 줘"]
      : ["내 상황에 맞는 계획을 세워 줘", "목표를 이루려면 무엇부터 준비해야 해?"],
    fields: cards.map(mapCard),
  };
}

function mapCard(card: ContextCardRow): ProfileField {
  return {
    key: card.id,
    contextId: card.id,
    label: card.label,
    value: card.value_text,
    category: card.category,
    semanticGroup: card.semantic_group,
    sensitivity: card.sensitivity,
    enabled: card.enabled,
    tags: card.tags || [],
    valueVisible: true,
    version: card.version,
  };
}

function mapAuditRow(row: Record<string, unknown>, profileName: string): InteractionRecord {
  const evaluations = asArray(row.evaluations);
  const usedContexts = asArray(row.used_contexts ?? row.usedContexts);
  const usedIds = new Set(usedContexts.map((item) => String(item.id ?? item.contextId ?? "")));
  const selectedValues = evaluations.map((item) => contextValue(item)).filter(Boolean);
  const approvedValues = evaluations
    .filter((item) => {
      const context = asObject(item.context);
      return usedIds.has(String(item.context_id ?? item.contextId ?? context.id ?? ""));
    })
    .map(contextValue)
    .filter(Boolean);

  return {
    profile: profileName,
    question: String(row.user_query ?? row.query ?? row.userQuery ?? "기록된 질문"),
    intent: "Context Bridge API",
    selected: selectedValues,
    approved: approvedValues,
    rejected: selectedValues.filter((value) => !approvedValues.includes(value)),
    sensitiveCount: evaluations.filter((item) => {
      const context = asObject(item.context);
      return String(context.privacyLevel ?? context.privacy_level ?? "") !== "normal";
    }).length,
    createdAt: String(row.created_at ?? row.timestamp ?? row.createdAt ?? ""),
  };
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function contextValue(item: Record<string, unknown>) {
  const context = asObject(item.context);
  return String(context.content ?? context.value_text ?? context.title ?? item.label ?? "");
}
