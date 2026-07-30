import { createClient } from '@supabase/supabase-js';
import { browserConfigMessage, publicEnv } from '../config/publicEnv';

export const supabase =
  publicEnv.supabaseUrl && publicEnv.supabasePublicKey
    ? createClient(publicEnv.supabaseUrl, publicEnv.supabasePublicKey)
    : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(browserConfigMessage() || 'Supabase 브라우저 연결 설정이 필요합니다.');
  }
  return supabase;
}
