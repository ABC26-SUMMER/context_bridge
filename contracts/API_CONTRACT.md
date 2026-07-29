# Context Bridge API 계약 (v12 실제 코드 기준)

> 이 문서는 `context-bridge-v12` **서버가 실제로 주고받는 것**을 그대로 적었다.
> 통합계약서의 이상적 `/api/v1` + `{data,meta}` 봉투는 아직 미적용이며, 발표 일정상
> v12 형태로 붙인다. 봉투/버전 전환은 발표 후 v2.

## 공통

- Base: 같은 도메인이면 상대경로 `/api`, 분리 배포면 `VITE_API_BASE_URL + /api`
- 인증: `Authorization: Bearer <token>`
  - **로컬 데모 모드**(`mode: 'local-demo'`): token = `demo-student` 또는 `demo-senior`
  - **Supabase 모드**: token = Supabase `session.access_token`
- 요청/응답: `application/json`, camelCase
- 프론트는 `userId`/이메일/role을 body로 보내지 않는다. 서버가 토큰에서 `user.id` 결정.

---

## 1. `GET /api/bootstrap`
로그인 직후 1회. 계정·프로필·카드·감사로그·모드를 한 번에.

응답: `BootstrapResponse` → `mocks/bootstrap.success.json`

- `profiles`가 0개면 온보딩 화면.
- `mode`로 프론트가 인증 방식을 안다(데모 vs supabase).
- ℹ️ confidential 카드: bootstrap은 **본인 소유** 카드의 값을 그대로 내려준다(자기 vault를 편집·삭제하려면 값이 필요). 이는 유출이 아니다 — 검증 결과, 기밀 값은 (1) proposal 후보에서 `"정책상 숨겨진 기밀 맥락"`으로 마스킹되고 (2) 승인 목록에 강제로 넣어도 서버가 `400`으로 거절하며 (3) LLM 프롬프트에 절대 들어가지 않는다. vault에서 값을 `••••`로 가리고 [보기]로 여는 UX는 선택 사항(§12 4번과 함께 논의).

## 2. `POST /api/profiles`
요청: `CreateProfileRequest` → 응답: `{ profile }` (`CreateProfileResponse`)

## 3. `POST /api/profiles/:profileId/contexts`
카드 추가. 요청 body는 `{ context: CreateContextRequest }` **(주의: context 키로 감싸져 있음)**
응답: `{ context: ContextItem }`
- ⚠️ v12는 생성/수정이 하나로 합쳐진 upsert. PATCH 분리는 백엔드 작업 목록에 있음.

## 4. `DELETE /api/profiles/:profileId/contexts/:contextId`
성공: `204 No Content`

## 5. `POST /api/proposals`
질문 분석 → 승인 후보 생성. **이 단계에서 카드 값은 외부 AI로 안 나간다**(제목·태그만).
요청: `CreateProposalRequest` → 응답: `ProposalResponse` → `mocks/proposal.success.json`

프론트 처리:
- `evaluations`와 `proposalId`를 **답변 생성까지 클라이언트에 보관**.
- `suggested: true`만 기본 체크.
- `exclusionReason` 있는 카드는 "쓰지 않은 카드 + 사유"로 표시.
- `valueVisible: false`(=confidential)는 값 대신 라벨만, 체크박스 비활성.
- `selectionMode`로 "규칙/AI 선별" 배지 표시 가능.

## 6. `POST /api/proposals/:proposalId/generate`
승인 후 답변 생성.
요청: `GenerateAnswerRequest` (`approvedIds`, `includeRawComparison?`, `tempNote?`)
응답: `AnswerResponse` → `mocks/answer.success.json`, `mocks/answer.withMemory.json`

절대 규칙:
- 프론트는 `approvedIds`(ID 배열)만. 카드 객체/값 다시 안 보냄.
- 서버가 Proposal 스냅샷에서 ID 재검증(타 프로필/비활성/기밀/없는 ID → 거절).
- `usedContexts`가 승인 ID와 정확히 일치해야 함(E2E 검증 포인트).
- `memoryCandidates`가 있으면 답변 아래 "기억할까요?" UI.
- ⚠️ 응답 키는 `usedContextsCount`(s 있음). 오타 아님, 코드가 그럼.
- ⚠️ **알려진 P0**: `store`가 인메모리라 Vercel 서버리스에서 5번→6번 사이 proposal 유실 가능. 로컬 단일 프로세스에선 안 보임. 배포 전 DB화 필요.

## 7. `POST /api/memory-candidates/:candidateId`
기억 후보 저장/무시. (⚠️ PATCH가 아니라 **POST**)
요청: `ResolveMemoryRequest` (`{ action: 'save' | 'ignore' }`)
응답: `ResolveMemoryResponse` → `mocks/memory.resolve.success.json`
- `save`일 때만 `context`(생성된 카드) 포함.
- 자동 저장 안 함. 동의(save) 있어야만 카드 생성.

---

## 오류 (v12 현재)
`{ "error": "사람이 읽는 문구" }` 형태 하나뿐. `mocks/error.examples.json` 참고.
- 프론트는 지금은 **HTTP status로 분기**(401/400/403/404).
- code 기반 분기는 백엔드가 `{ error: { code, ... } }`로 올린 뒤 전환(§9 P1).

주요 status:
| status | 언제 |
|---|---|
| 401 | 토큰 없음/만료, 그리고 v12에선 proposals의 대부분 오류가 여기로 옴(개선 예정) |
| 400 | 입력 오류, 답변 생성 실패 |
| 403 | 기억 후보 처리 권한 오류 |
| 404 | 프로필 없음/소유자 아님 |
| 204 | 삭제 성공 |
