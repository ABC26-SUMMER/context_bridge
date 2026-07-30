-- Context Bridge — ProposalStore DB화 마이그레이션
-- 기존 스키마(202607280001)를 확장한다. 기존 테이블/RLS는 건드리지 않는다.
--
-- 목적: 인메모리 ProposalStore가 Vercel 서버리스에서 요청 간 유실되는 문제 해결.
--   - proposal 생성 시점의 "마스킹된 카드 + 평가 결과"를 통째로 JSONB에 저장
--   - 상태 전이를 조건부 UPDATE로 원자화(낙관적 잠금) → 이중 승인/경쟁 요청 방지
--   - 기억 후보도 blueprint까지 저장(서버 재시작 후 save/ignore 재개 가능)
--
-- ⚠️ 적용 전 반드시 사용자 승인. Supabase SQL Editor 또는 supabase db push로 적용.

-- ─────────────────────────────────────────────────────────────
-- 1. proposals에 스냅샷 컬럼 추가
--    기존 context_proposals는 candidate_ids만 있어서, 승인 검증에 필요한
--    "마스킹된 카드 전체 + 평가"가 없다. JSONB 한 컬럼으로 보관한다.
-- ─────────────────────────────────────────────────────────────
alter table public.context_proposals
  add column if not exists snapshot jsonb;

comment on column public.context_proposals.snapshot is
  '생성 시점의 { contexts: 마스킹된 카드[], evaluations: 평가결과[] }. 승인 시 서버가 여기서 재검증한다.';

-- 답변 결과(멱등 재요청 시 그대로 반환)와 멱등 키
alter table public.context_proposals
  add column if not exists answer jsonb;
alter table public.context_proposals
  add column if not exists idempotency_key uuid;

-- 같은 멱등 키로 온 재요청은 새 답변을 만들지 않고 기존 answer를 돌려주기 위한 유니크 제약.
-- 사용자별로 유니크하면 충분하다(다른 사용자의 키와 충돌 없음).
create unique index if not exists context_proposals_idem_idx
  on public.context_proposals(user_id, idempotency_key)
  where idempotency_key is not null;

-- ─────────────────────────────────────────────────────────────
-- 2. 기억 후보에 blueprint 저장
--    저장 카드의 제목·태그·등급을 blueprint에서 만들므로, DB에도 보관해야
--    서버 재시작 후 save가 정확한 카드를 만든다.
-- ─────────────────────────────────────────────────────────────
alter table public.memory_candidates
  add column if not exists blueprint jsonb;

-- ─────────────────────────────────────────────────────────────
-- 3. 낙관적 잠금용 원자적 상태 전이 함수
--    "현재 상태가 기대값일 때만" 다음 상태로 바꾸고, 바뀐 행을 돌려준다.
--    두 요청이 동시에 승인해도 하나만 AWAITING_APPROVAL→APPROVED에 성공한다.
--    (RLS가 적용되므로 함수는 SECURITY INVOKER = 호출자 권한으로 실행)
-- ─────────────────────────────────────────────────────────────
create or replace function public.advance_proposal_state(
  p_proposal_id uuid,
  p_expected_state text,
  p_next_state text
)
returns public.context_proposals
language sql
security invoker
as $$
  update public.context_proposals
     set state = p_next_state,
         updated_at = now()
   where id = p_proposal_id
     and state = p_expected_state          -- 조건부: 기대 상태일 때만
     and user_id = (select auth.uid())     -- 소유자만(RLS 이중 방어)
  returning *;
$$;

comment on function public.advance_proposal_state is
  '낙관적 잠금 상태 전이. 기대 상태와 다르면 0행 반환 → 호출자는 409로 처리.';

-- ─────────────────────────────────────────────────────────────
-- 4. 인덱스
-- ─────────────────────────────────────────────────────────────
create index if not exists context_proposals_owner_state_idx
  on public.context_proposals(user_id, state);
create index if not exists memory_candidates_owner_status_idx
  on public.memory_candidates(user_id, status);

-- ─────────────────────────────────────────────────────────────
-- 5. 확인용 쿼리(적용 후 수동 실행 권장, 변경 아님)
-- ─────────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'context_proposals' and column_name in ('snapshot','answer','idempotency_key');
-- select proname from pg_proc where proname = 'advance_proposal_state';
