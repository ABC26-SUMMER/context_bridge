import dotenv from 'dotenv';

// Local Node/Express execution does not automatically load Vite's .env.local.
// Load local overrides first, then shared .env without replacing existing values.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local', override: false });
  dotenv.config({ path: '.env', override: false });
}

function first(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean) ?? '';
}

export const env = {
  nodeEnv: first(process.env.NODE_ENV, 'development'),
  port: Number(first(process.env.PORT, '3000')),
  geminiApiKey: first(process.env.GEMINI_API_KEY),
  supabaseUrl: first(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL),
  supabasePublicKey: first(
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
  ),
};

export const serverEnvStatus = {
  supabaseConfigured: Boolean(env.supabaseUrl && env.supabasePublicKey),
  aiConfigured: Boolean(env.geminiApiKey),
  sourceCompatibility: {
    hasServerUrl: Boolean(process.env.SUPABASE_URL),
    hasBrowserUrlFallback: Boolean(process.env.VITE_SUPABASE_URL),
    hasServerPublishableKey: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
    hasServerAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
    hasBrowserKeyFallback: Boolean(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    ),
  },
};

export function assertServerEnv() {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push('SUPABASE_URL');
  if (!env.supabasePublicKey) missing.push('SUPABASE_PUBLISHABLE_KEY 또는 SUPABASE_ANON_KEY');
  return missing;
}
