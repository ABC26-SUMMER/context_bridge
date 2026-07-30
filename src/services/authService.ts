import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { requireSupabase } from "./supabaseClient";

export function getCurrentSession() {
  return requireSupabase().auth.getSession();
}

export function onSessionChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  return requireSupabase().auth.onAuthStateChange(callback);
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw new Error(toAuthMessage(error.message));
  return data;
}

export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) throw new Error(toAuthMessage(error.message));
  return data;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw new Error(error.message);
}

function toAuthMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (normalized.includes("email not confirmed")) return "이메일 인증을 완료한 뒤 로그인해 주세요.";
  if (normalized.includes("password should be")) return "비밀번호는 6자 이상 입력해 주세요.";
  if (normalized.includes("user already registered")) return "이미 가입된 이메일입니다.";
  return message;
}
