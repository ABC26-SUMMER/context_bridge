create table if not exists public.demo_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  persona_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.demo_accounts(id) on delete cascade,
  display_name text not null,
  persona_type text not null,
  profile_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists account_id uuid references public.demo_accounts(id) on delete cascade;

alter table public.demo_accounts enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Allow public demo account read" on public.demo_accounts;
drop policy if exists "Allow public demo profile read" on public.profiles;

create policy "Allow public demo account read"
on public.demo_accounts
for select
using (true);

create policy "Allow public demo profile read"
on public.profiles
for select
using (true);

insert into public.demo_accounts (id, email, display_name, persona_type)
values
  ('11111111-1111-4111-8111-111111111111', 'ihyeon.demo@contextbridge.local', '전이현', 'university_student'),
  ('22222222-2222-4222-8222-222222222222', 'youngja.demo@contextbridge.local', '김영자', 'older_adult')
on conflict (email) do update
set
  display_name = excluded.display_name,
  persona_type = excluded.persona_type;

insert into public.profiles (account_id, display_name, persona_type, profile_data)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '전이현',
    'university_student',
    '{
      "occupation": "대학생",
      "major": "AI·SW학과",
      "grade": "3학년",
      "career_goal": "공기업 전산직",
      "certificate_goal": ["SQLD", "정보처리기사"],
      "current_skills": ["Python", "React", "Supabase"],
      "available_study_time": "평일 1시간",
      "transportation": "대중교통",
      "budget_level": "대학생 수준",
      "place_preference": ["조용한 장소", "사진 찍기 좋은 공간"],
      "response_style": "구체적이고 단계적인 설명"
    }'::jsonb
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '김영자',
    'older_adult',
    '{
      "age_group": "70대",
      "digital_literacy": "초급",
      "mobility": "장시간 보행 어려움",
      "transportation": "버스와 지하철",
      "place_preference": ["좌석이 있는 곳", "실내 공간"],
      "accessibility_preferences": ["큰 글씨", "짧은 문장", "쉬운 표현", "단계별 안내"],
      "response_style": "짧고 쉬운 설명"
    }'::jsonb
  )
on conflict do nothing;

update public.profiles
set account_id = '11111111-1111-4111-8111-111111111111'
where persona_type = 'university_student' and account_id is null;

update public.profiles
set account_id = '22222222-2222-4222-8222-222222222222'
where persona_type = 'older_adult' and account_id is null;
