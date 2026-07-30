# Context Bridge API 계약 v20

공통 타입 정본은 `contracts/types.ts`입니다.

## 공통

- Base URL: 동일 도메인 `/api`, 분리 배포 `VITE_API_BASE_URL + /api`
- 인증: `Authorization: Bearer <Supabase access_token>`
- 통합 서버의 로컬 게스트 토큰: `guest`
- `demo-student`, `demo-senior`는 자동 테스트와 Mock 서버 fixture에서만 사용
- 요청·응답: JSON, `camelCase`
- 브라우저는 Auth 외의 Supabase 테이블을 직접 조회·수정하지 않습니다.
- 프론트는 `userId`, 카드 소유자, DB row를 전송하지 않습니다.

## 프로필·카드

### `GET /api/bootstrap`

응답: `BootstrapResponse`

### `POST /api/profiles`

요청: `CreateProfileRequest`

```json
{
  "displayName": "강도원",
  "personaType": "custom",
  "name": "학교생활",
  "icon": "🎓",
  "description": "수업과 취업 준비"
}
```

응답: `CreateProfileResponse`, status `201`

### `PATCH /api/profiles/:profileId`

요청: `UpdateProfileRequest`  
응답: `CreateProfileResponse`

### `POST /api/profiles/:profileId/contexts`

요청: `CreateContextRequest`. `context` 키로 감싸지 않습니다.

```json
{
  "title": "공부 가능 시간",
  "category": "resource",
  "content": "평일 1시간",
  "privacyLevel": "normal",
  "isActive": true
}
```

`id`, `updatedAt`, `userId`, `profileId`는 서버가 생성합니다.

### `PATCH /api/profiles/:profileId/contexts/:contextId`

요청: `UpdateContextRequest`  
응답: `SaveContextResponse`

### `DELETE /api/profiles/:profileId/contexts/:contextId`

성공: `204 No Content`

## 맥락 선별·답변

### `POST /api/context/structure`

자연어 개인 정보를 원자 카드 초안으로 분해합니다.

```json
{ "text": "평일에는 한 시간만 공부할 수 있고 쉬운 설명이 좋아요" }
```

응답: `{ "drafts": StructuredContextDraft[] }`

### `POST /api/proposals`

요청:

```json
{
  "profileId": "uuid",
  "query": "이번 방학에 무엇을 공부하면 좋을까?"
}
```

응답: `ProposalResponse`

- 일반 정보 중 `suggested: true`이며 충돌·오래됨 경고가 없는 항목만 기본 선택합니다.
- `sensitive`는 `suggested`와 무관하게 항상 기본 선택 해제입니다.
- `valueVisible: false`는 체크할 수 없습니다.
- `confidential`은 외부 AI와 승인 후보에서 차단됩니다.
- 승인 전 카드 값은 외부 생성 모델에 전달하지 않습니다.
- `hard_limit`은 질문의 결정·위험 영역과 관련된 경우만 후보로 검사합니다.

### `POST /api/proposals/:proposalId/answers`

요청:

```json
{
  "approvedContextIds": ["uuid"],
  "includeRawComparison": true,
  "temporaryNote": "오늘만 적용할 정보"
}
```

응답: `AnswerResponse`

- 카드 객체나 `content`를 다시 보내면 안 됩니다.
- 서버가 Proposal Snapshot에서 승인 ID를 재검증합니다.
- 답변 생성 뒤 거절 정보 누출과 승인 필수조건 반영 여부를 검증하고 필요한 경우 자동 수정합니다.
- 폐기된 `/generate`, `approvedIds`, `tempNote`는 지원하지 않습니다.

### `POST /api/memory-candidates/:candidateId`

```json
{ "action": "save" }
```

또는:

```json
{ "action": "ignore" }
```

자동 저장은 없으며 `save`일 때만 새 카드가 생성됩니다.

## 입력 제한

- 질문: 최대 4,000자
- 임시 메모: 최대 2,000자
- 카드 제목: 최대 80자
- 카드 내용: 최대 2,000자
- 프로필 이름·표시 이름: 최대 50자
- 태그는 레거시 호환 필드이며 신규 UI에서 입력하지 않습니다.

## 오류

현재 오류 형식:

```json
{ "error": "사람이 읽는 오류 메시지" }
```

프론트는 HTTP status와 메시지를 함께 사용합니다. 구조화 오류 코드 도입은 다음 API major version에서 진행합니다.
