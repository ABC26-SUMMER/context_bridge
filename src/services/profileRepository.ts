import { demoAccounts, demoProfiles } from "../data/profiles";
import type { DemoAccount, ProfileField, UserProfile } from "../types";
import { supabase } from "./supabaseClient";

type SupabaseAccountRow = {
  id: string;
  email: string;
  display_name: string;
  persona_type: string;
};

type SupabaseProfileRow = {
  id: string;
  account_id: string;
  display_name: string;
  persona_type: string;
  profile_data: Record<string, unknown>;
};

export async function loadAccounts(): Promise<DemoAccount[]> {
  if (!supabase) return demoAccounts;

  const { data, error } = await supabase
    .from("demo_accounts")
    .select("id, email, display_name, persona_type")
    .order("display_name", { ascending: true });

  if (error || !data || data.length === 0) {
    return demoAccounts;
  }

  return data.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    personaType: row.persona_type,
    description: row.persona_type === "older_adult" ? "고령 사용자 / 쉬운 설명 필요" : "대학생 / 공기업 전산직 준비",
    source: "supabase",
  }));
}

export async function loadProfileForAccount(accountId: string): Promise<UserProfile | null> {
  if (!supabase) {
    return demoProfiles.find((profile) => profile.accountId === accountId) || null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, account_id, display_name, persona_type, profile_data")
    .eq("account_id", accountId)
    .maybeSingle();

  if (!error && data) {
    return mapSupabaseProfile(data);
  }

  return demoProfiles.find((profile) => profile.accountId === accountId) || null;
}

export async function loadProfiles(): Promise<UserProfile[]> {
  const accounts = await loadAccounts();
  const profiles = await Promise.all(accounts.map((account) => loadProfileForAccount(account.id)));
  return profiles.filter((profile): profile is UserProfile => Boolean(profile));
}

export function mapSupabaseProfile(row: SupabaseProfileRow): UserProfile {
  const easy = row.persona_type === "older_adult";

  return {
    id: row.id,
    accountId: row.account_id,
    name: row.display_name,
    group: easy ? "고령 사용자 / 쉬운 설명 필요" : "대학생 / 공기업 전산직 준비",
    personaType: row.persona_type,
    source: "supabase",
    uiMode: easy ? "easy" : "standard",
    defaultQuestion: easy ? "내일 딸이랑 어디 가면 좋아?" : "이번 방학에 뭐 공부해야 해?",
    examples: easy
      ? ["내일 딸이랑 어디 가면 좋아?", "키오스크 쓰는 법 쉽게 알려줘"]
      : ["이번 방학에 뭐 공부해야 해?", "공기업 전산직 준비하려면 뭐부터 해야 해?"],
    fields: toProfileFields(row.profile_data || {}),
  };
}

export function toProfileFields(profileData: Record<string, unknown>): ProfileField[] {
  const fieldMeta: Record<string, { label: string; tags: string[]; sensitivity?: "normal" | "sensitive" }> = {
    occupation: { label: "현재 상태", tags: ["learning_plan"] },
    major: { label: "전공", tags: ["learning_plan"] },
    grade: { label: "학년", tags: ["learning_plan"] },
    career_goal: { label: "진로 목표", tags: ["learning_plan"] },
    certificate_goal: { label: "자격증 목표", tags: ["learning_plan"] },
    current_skills: { label: "현재 기술", tags: ["learning_plan"] },
    available_study_time: { label: "공부 가능 시간", tags: ["learning_plan"] },
    age_group: { label: "연령대", tags: ["easy_explanation", "outing_plan"], sensitivity: "sensitive" },
    digital_literacy: { label: "디지털 숙련도", tags: ["how_to", "easy_explanation"] },
    mobility: { label: "이동 조건", tags: ["outing_plan"], sensitivity: "sensitive" },
    transportation: { label: "이동 방식", tags: ["outing_plan"] },
    budget_level: { label: "예산 수준", tags: ["outing_plan", "low_budget_activity"], sensitivity: "sensitive" },
    place_preference: { label: "장소 취향", tags: ["outing_plan"] },
    accessibility_preferences: { label: "접근성 선호", tags: ["easy_explanation", "how_to", "outing_plan"] },
    response_style: { label: "답변 방식", tags: ["learning_plan", "outing_plan", "how_to", "easy_explanation"] },
  };

  return Object.entries(profileData)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const meta = fieldMeta[key] || { label: key, tags: [] };
      return {
        key,
        label: meta.label,
        value: Array.isArray(value) ? value.join(", ") : String(value),
        sensitivity: meta.sensitivity || "normal",
        enabled: true,
        tags: meta.tags,
      };
    });
}
