create extension if not exists pgcrypto;

create table if not exists public.account_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  persona_type text not null check (persona_type in ('university_student', 'older_adult', 'custom')),
  profile_name text not null,
  icon text not null default '🧭',
  description text not null default '',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, profile_name),
  unique(id, user_id)
);

create table if not exists public.context_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null,
  semantic_group text not null,
  category text not null,
  label text not null,
  value_text text not null,
  tags text[] not null default '{}',
  enabled boolean not null default true,
  sensitivity text not null check (sensitivity in ('normal', 'sensitive', 'confidential')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, user_id)
    references public.account_profiles(id, user_id) on delete cascade
);

create table if not exists public.context_proposals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null,
  question text not null,
  state text not null check (state in ('AWAITING_APPROVAL', 'APPROVED', 'ANSWERED', 'FAILED')),
  candidate_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, user_id),
  foreign key (profile_id, user_id)
    references public.account_profiles(id, user_id) on delete cascade
);

create table if not exists public.approval_snapshots (
  proposal_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  approved_items jsonb not null,
  snapshot_hash text not null,
  created_at timestamptz not null default now(),
  foreign key (proposal_id, user_id)
    references public.context_proposals(id, user_id) on delete cascade
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null,
  proposal_id uuid not null,
  question text not null,
  used_contexts jsonb not null,
  snapshot_hash text not null,
  answer text not null,
  raw_answer text,
  created_at timestamptz not null default now(),
  foreign key (profile_id, user_id)
    references public.account_profiles(id, user_id) on delete cascade,
  foreign key (proposal_id, user_id)
    references public.context_proposals(id, user_id) on delete cascade
);

create table if not exists public.memory_candidates (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null,
  proposal_id uuid not null,
  label text not null,
  category text not null,
  value_text text not null,
  sensitivity text not null,
  status text not null check (status in ('PENDING', 'SAVED', 'IGNORED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, user_id)
    references public.account_profiles(id, user_id) on delete cascade,
  foreign key (proposal_id, user_id)
    references public.context_proposals(id, user_id) on delete cascade
);

create index if not exists context_cards_owner_profile_idx
  on public.context_cards(user_id, profile_id);
create index if not exists audit_logs_owner_created_idx
  on public.audit_logs(user_id, created_at desc);

alter table public.account_profiles enable row level security;
alter table public.context_cards enable row level security;
alter table public.context_proposals enable row level security;
alter table public.approval_snapshots enable row level security;
alter table public.audit_logs enable row level security;
alter table public.memory_candidates enable row level security;

create policy "owners manage account profiles" on public.account_profiles
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "owners manage context cards" on public.context_cards
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "owners manage proposals" on public.context_proposals
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "owners read snapshots" on public.approval_snapshots
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "owners insert snapshots" on public.approval_snapshots
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "owners read audit logs" on public.audit_logs
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "owners insert audit logs" on public.audit_logs
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "owners manage memory candidates" on public.memory_candidates
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update, delete on public.account_profiles to authenticated;
grant select, insert, update, delete on public.context_cards to authenticated;
grant select, insert, update, delete on public.context_proposals to authenticated;
grant select, insert on public.approval_snapshots to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert, update on public.memory_candidates to authenticated;
