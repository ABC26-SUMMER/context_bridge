# Supabase 마이그레이션 적용 순서

## ⚠️ 반드시 이 순서로

```
1. 202607280001_context_bridge.sql   ← 기본. 모든 테이블 + RLS를 생성한다.
2. 202607290001_proposal_store_db.sql ← 확장. 1번이 만든 테이블에 컬럼/함수를 add한다.
```

**2번을 먼저 실행하면 실패한다** — `alter table public.context_proposals ...`가
대상 테이블을 못 찾기 때문. 반드시 1 → 2 순.

## 두 파일의 관계

| 파일 | 하는 일 | 만드는/바꾸는 대상 |
|---|---|---|
| `202607280001` (기본) | 처음부터 테이블 생성 | account_profiles, context_cards, context_proposals, approval_snapshots, audit_logs, memory_candidates + 각 RLS |
| `202607290001` (확장) | 기존 테이블에 add | context_proposals(+snapshot, +answer, +idempotency_key), memory_candidates(+blueprint), advance_proposal_state() 함수, 인덱스 |

## 적용 방법 (택1)

### A. Supabase SQL Editor (가장 확실)
1. Dashboard → SQL Editor
2. `202607280001_context_bridge.sql` 전체 붙여넣기 → Run
3. `202607290001_proposal_store_db.sql` 전체 붙여넣기 → Run

### B. Supabase CLI
```bash
supabase link --project-ref <your-ref>
supabase db push          # migrations/ 폴더를 파일명 순으로 적용 → 자동으로 1→2 순
```

## 적용 후 검증 쿼리 (변경 아님, 확인용)

```sql
-- 테이블 6개 존재
select tablename from pg_tables where schemaname='public'
  and tablename in ('account_profiles','context_cards','context_proposals',
                    'approval_snapshots','audit_logs','memory_candidates');

-- 확장 컬럼 3개 존재
select column_name from information_schema.columns
  where table_name='context_proposals'
    and column_name in ('snapshot','answer','idempotency_key');

-- 낙관적 잠금 함수 존재
select proname from pg_proc where proname='advance_proposal_state';

-- RLS가 6개 테이블 모두 켜져 있는지
select relname, relrowsecurity from pg_class
  where relname in ('account_profiles','context_cards','context_proposals',
                    'approval_snapshots','audit_logs','memory_candidates');
```

## 코드 ↔ DB 컬럼 매핑 (검증 완료)

`SupabaseProposalStore`가 쓰는 컬럼이 실제 스키마와 일치하는지 대조했다:

| 코드가 접근 | 테이블 | 컬럼 | 출처 |
|---|---|---|---|
| insert | context_proposals | id, user_id, profile_id, question, state, candidate_ids | 기본 |
| insert | context_proposals | snapshot | 확장에서 add |
| select | context_proposals | answer, idempotency_key | 확장에서 add |
| insert | approval_snapshots | proposal_id, user_id, approved_items, snapshot_hash | 기본 |
| insert/select | memory_candidates | id..status | 기본 |
| insert/select | memory_candidates | blueprint | 확장에서 add |

⚠️ **approval_snapshots 주의**: 이 테이블 RLS는 select/insert만 있고 **update 정책이 없다.**
따라서 코드는 `upsert`가 아니라 `insert`를 쓴다(스냅샷은 승인당 1회만 기록되므로 충돌 없음).
낙관적 잠금이 approve를 1회로 보장하기 때문에 이게 안전하다.

## RLS 소유권 기준 (전 테이블 동일)

모든 정책이 `auth.uid() = user_id`. 백엔드가 **사용자 access token**으로 만든
Supabase 클라이언트를 쓰므로, RLS가 자동으로 사용자별 데이터를 격리한다.
`advance_proposal_state()`도 `security invoker`라 호출자의 RLS를 그대로 따른다
(추가로 함수 안에서 `and user_id = auth.uid()`로 이중 방어).

**service_role 키는 쓰지 않는다** — RLS를 우회하므로 불필요하고 위험하다.

3. `202607300001_expert_context_model.sql`
