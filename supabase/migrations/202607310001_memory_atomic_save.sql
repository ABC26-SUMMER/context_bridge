-- 승인 기반 기억 저장 원자화
-- memory_candidates 상태 전이와 context_cards 생성을 한 트랜잭션으로 묶는다.
-- 같은 요청을 재전송해도 이미 생성된 context_id를 반환하여 중복 카드를 만들지 않는다.

alter table public.memory_candidates
  add column if not exists context_id uuid references public.context_cards(id) on delete set null;

create or replace function public.resolve_memory_candidate(
  p_candidate_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  candidate_row public.memory_candidates%rowtype;
  card_row public.context_cards%rowtype;
  next_status text;
  tag_values text[];
begin
  if p_action not in ('save', 'ignore') then
    raise exception 'save 또는 ignore가 필요합니다.' using errcode = '22023';
  end if;

  select * into candidate_row
    from public.memory_candidates
   where id = p_candidate_id
     and user_id = (select auth.uid())
   for update;

  if not found then
    raise exception '기억 후보에 대한 권한이 없습니다.' using errcode = '42501';
  end if;

  next_status := case when p_action = 'save' then 'SAVED' else 'IGNORED' end;

  -- 같은 작업의 네트워크 재시도는 성공으로 취급한다.
  if candidate_row.status = next_status then
    if candidate_row.context_id is not null then
      select * into card_row from public.context_cards where id = candidate_row.context_id;
    end if;
    return jsonb_build_object(
      'candidate', to_jsonb(candidate_row),
      'contextCard', case when card_row.id is null then null else to_jsonb(card_row) end
    );
  end if;

  if candidate_row.status <> 'PENDING' then
    raise exception '이미 다른 방식으로 처리한 기억 후보입니다.' using errcode = '23505';
  end if;

  if p_action = 'save' then
    if candidate_row.blueprint is null then
      raise exception '기억 후보의 저장 정보가 없습니다.' using errcode = '23502';
    end if;

    select coalesce(array_agg(value), '{}'::text[])
      into tag_values
      from jsonb_array_elements_text(coalesce(candidate_row.blueprint->'tags', '[]'::jsonb)) as value;

    if candidate_row.blueprint->>'operation' = 'UPDATE'
       and nullif(candidate_row.blueprint->>'updateTargetId', '') is not null then
      update public.context_cards
         set semantic_group = coalesce(nullif(candidate_row.blueprint->>'semanticGroup', ''), semantic_group),
             category = candidate_row.category,
             label = coalesce(nullif(candidate_row.blueprint->>'title', ''), candidate_row.label),
             value_text = candidate_row.value_text,
             tags = tag_values,
             sensitivity = candidate_row.sensitivity,
             updated_at = now()
       where id = (candidate_row.blueprint->>'updateTargetId')::uuid
         and user_id = candidate_row.user_id
         and profile_id = candidate_row.profile_id
       returning * into card_row;
      if card_row.id is null then
        raise exception '갱신 대상 기억 카드를 찾을 수 없습니다.' using errcode = 'P0002';
      end if;
    else
      insert into public.context_cards (
        user_id, profile_id, semantic_group, category, label, value_text,
        tags, enabled, sensitivity
      ) values (
        candidate_row.user_id,
        candidate_row.profile_id,
        coalesce(nullif(candidate_row.blueprint->>'semanticGroup', ''), candidate_row.category),
        candidate_row.category,
        coalesce(nullif(candidate_row.blueprint->>'title', ''), candidate_row.label),
        candidate_row.value_text,
        tag_values,
        true,
        candidate_row.sensitivity
      ) returning * into card_row;
    end if;
  end if;

  update public.memory_candidates
     set status = next_status,
         context_id = case when p_action = 'save' then card_row.id else context_id end,
         updated_at = now()
   where id = p_candidate_id
   returning * into candidate_row;

  return jsonb_build_object(
    'candidate', to_jsonb(candidate_row),
    'contextCard', case when card_row.id is null then null else to_jsonb(card_row) end
  );
end;
$$;

grant execute on function public.resolve_memory_candidate(uuid, text) to authenticated;

comment on function public.resolve_memory_candidate(uuid, text) is
  '기억 후보 승인/거절을 멱등·원자 처리한다. save 시 context_cards 생성과 상태 전이가 함께 커밋된다.';
