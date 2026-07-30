# server.ts ↔ Supabase store 배선 완료 노트

## 무엇이 바뀌었나

`server.ts`가 이제 **요청(사용자)별로 store를 선택**한다:

```
storeFor(user):
  - deps.store 주입 시           → 그것(테스트용)
  - user.local 또는 Supabase 미설정 → sharedMemoryStore (인메모리, 데모)
  - Supabase 모드               → new SupabaseProposalStore(userClient(user.token))
```

핵심: Supabase store는 **그 사용자 토큰이 실린 client**로 만들어져 RLS가 자동 격리한다.
service_role 안 씀.

## 상태 저장 주체 정리 (중복 제거)

이전엔 인메모리 store(상태) + persist*(Supabase 사본)로 이중 저장했고,
사본을 읽지 않아 서버리스에서 유실됐다. 이제:

- proposal 생성/상태/스냅샷/기억후보 → **store가 전담** (Supabase면 DB, 데모면 맵)
- audit_logs만 별도 `persistAuditLog`로 저장 (store 책임 아님)
- 과거 persistProposal / persistAnswerArtifacts / persistMemoryCandidate /
  persistMemoryStatus 호출은 제거됨 (중복 insert 방지)

## 낙관적 잠금

`SupabaseProposalStore.approve`가 `advance_proposal_state` RPC로
AWAITING_APPROVAL→APPROVED를 조건부 전이. 경쟁 요청은 0행 → status 409.
generate 라우트가 409를 그대로 프론트에 전달.

## 검증 (오프라인)

- npm run lint (tsc --noEmit): 통과
- npm test: 29 passed (데모 모드 유지)
- 데모 스모크: 요청 A(proposal)→B(generate) 상태 공유 + 재승인 차단 확인

## 남은 것 (실제 Supabase 필요 — 당신 환경)

1. 마이그레이션 적용: 202607280001 → 202607290001 (supabase/MIGRATION_ORDER.md)
2. .env: SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY
3. npm run dev → 실제 로그인으로 E2E:
   - 로그인 → 질문 → 승인 → 답변 → 기억 저장
   - 새로고침/재요청 후 proposal 유지 (서버리스 블로커 해결 확인)
   - 답변 버튼 연타 → 한 번만 생성 (낙관적 잠금)
   - 다른 사용자 토큰으로 남의 프로필 → 404/403 (RLS)
4. Vercel Preview 배포 (VERCEL_DEPLOY.md)
