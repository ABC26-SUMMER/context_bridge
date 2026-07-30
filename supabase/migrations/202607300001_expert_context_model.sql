alter table public.context_cards
  add column if not exists semantic_summary text not null default '',
  add column if not exists priority text not null default 'normal',
  add column if not exists scope text not null default 'global';

comment on column public.context_cards.semantic_group is '전문가 역할 분류: identity/capability/objective/preference/hard_limit/soft_limit/resource/routine/relationship/current_state/project';
comment on column public.context_cards.tags is '레거시 호환용. 신규 UI는 태그 입력을 요구하지 않음';
