create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  persona_type text not null,
  profile_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles (display_name, persona_type, profile_data)
values
  (
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
  );
