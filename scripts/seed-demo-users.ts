import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const specs = JSON.parse(
  await fs.readFile(new URL('../supabase/demo-profiles.json', import.meta.url), 'utf8'),
);

for (const spec of specs) {
  const password = process.env[spec.password_env];
  if (!password) throw new Error(`${spec.password_env}가 필요합니다.`);
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  let user = listed.users.find((item) => item.email === spec.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password,
      email_confirm: true,
      user_metadata: { display_name: spec.display_name, demo: true },
    });
    if (error) throw error;
    user = data.user;
  }

  const { data: profile, error: profileError } = await admin
    .from('account_profiles')
    .upsert({
      user_id: user.id,
      display_name: spec.display_name,
      persona_type: spec.persona_type,
      profile_name: spec.profile_name,
      icon: spec.icon,
      description: spec.description,
      is_active: true,
    }, { onConflict: 'user_id,profile_name' })
    .select()
    .single();
  if (profileError) throw profileError;

  const rows = spec.cards.map((entry: any[]) => ({
    user_id: user.id,
    profile_id: profile.id,
    semantic_group: entry[0],
    category: entry[1],
    label: entry[2],
    value_text: entry[3],
    tags: entry[4],
    sensitivity: entry[5],
    enabled: true,
  }));
  const { error: deleteError } = await admin
    .from('context_cards')
    .delete()
    .eq('user_id', user.id)
    .eq('profile_id', profile.id);
  if (deleteError) throw deleteError;
  const { error: cardError } = await admin.from('context_cards').insert(rows);
  if (cardError) throw cardError;
  console.log(`seeded ${spec.email} (${rows.length} cards)`);
}
