function clean(value: string | undefined) {
  return value?.trim() ?? '';
}

export const publicEnv = {
  supabaseUrl: clean(import.meta.env.VITE_SUPABASE_URL),
  supabasePublicKey: clean(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
  ),
  apiBaseUrl: clean(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, ''),
};

export const publicEnvStatus = {
  supabaseConfigured: Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublicKey),
  apiMode: publicEnv.apiBaseUrl ? 'separate-origin' : 'same-origin',
};

export function browserConfigMessage() {
  const missing: string[] = [];
  if (!publicEnv.supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!publicEnv.supabasePublicKey) {
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY 또는 VITE_SUPABASE_ANON_KEY');
  }
  return missing.length ? `브라우저 환경변수 누락: ${missing.join(', ')}` : '';
}
