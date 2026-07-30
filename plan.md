# Context Bridge 세션 1 작업 계획

## 0. 기준 문서와 입력 자료

이 계획은 아래 자료를 먼저 확인한 뒤 작성했다.

- `README.md`
- `docs/FRONTEND_HANDOFF.md`
- 전달 ZIP: `context-bridge-frontend-handoff (4).zip`
- ZIP 주요 파일:
  - `contracts/types.ts`
  - `contracts/API_CONTRACT.md`
  - `contracts/error-codes.ts`
  - `contracts/mock-server.mjs`
  - `contracts/mocks/*.json`
  - `contracts/.env.frontend.example`

작업 브랜치 기준:

```bash
main -> develop -> feature/frontend
```

## 1. 제품 방향 이해

Context Bridge는 단순한 챗봇 UI가 아니라 포용적 AI를 위한 입력 보조 레이어다.

핵심 문제는 고성능 AI의 결과 품질이 사용자의 프롬프트 작성 능력에 크게 좌우된다는 점이다. 일반인, 비전공자, 고령 사용자, 디지털 취약계층은 자신의 상황, 목표, 취향, 제약조건을 긴 프롬프트로 구조화하기 어렵다.

Context Bridge는 사용자가 짧게 질문해도 사용자 프로필과 컨텍스트 카드 DB를 바탕으로 현재 질문에 필요한 맥락만 골라 보여주고, 사용자가 승인한 정보만 백엔드 AI 처리에 전달한다.

이번 세션에서 지켜야 할 제품 원칙은 다음과 같다.

- 기존 ChatGPT형 채팅 UI를 유지한다.
- 사용자의 짧은 질문 -> 맥락 후보 -> 사용자 승인 -> AI 응답 흐름을 유지한다.
- 개인정보는 자동으로 조용히 쓰지 않고, 어떤 정보가 왜 쓰이는지 보여준다.
- 카드 값은 답변 생성 요청에서 다시 보내지 않고, 승인한 카드 ID만 보낸다.
- 실제 API 실패 시 mock 데이터로 자동 대체하지 않고 오류와 재시도 UI를 보여준다.

## 2. 이번 세션 범위

이번 세션은 `contracts/mock API 연동`만 진행한다.

### 포함

- ZIP의 `contracts/` 폴더를 팀 repo에 적용한다.
- ZIP의 계약 타입을 프론트에서 import할 수 있게 연결한다.
- `VITE_API_BASE_URL=http://localhost:4000` 기준 API client를 만든다.
- `node mock-server.mjs`로 mock API 서버를 실행할 수 있게 정리한다.
- mock API 기준으로 질문 분석, 승인 후보, AI 응답, 기억 후보 처리 API를 연결한다.
- loading, empty, error, retry 상태를 기존 채팅 UI 안에 붙인다.
- 개발 환경은 mock API를 사용하고, 배포 환경은 실제 API 주소만 사용하도록 분리한다.
- 실제 API 호출 실패를 mock fallback으로 덮지 않는다.

### 제외

아래는 사용자가 전달한 전체 요구사항에는 포함되어 있지만, 세션 1 범위가 아니므로 이번 브랜치에서 구현하지 않는다.

- Supabase 회원가입
- Supabase 로그인, 로그아웃, 세션 유지
- `account_profiles` 실제 연동
- `context_cards` 실제 CRUD
- `context_proposals`, `approval_snapshots`, `audit_logs`, `memory_candidates` 실제 저장
- 질문 기록의 Supabase 저장
- DB 컬럼 변경 또는 schema 임의 수정
- 기존 채팅 UI의 대규모 재설계

위 작업은 다음 세션에서 별도 브랜치로 진행한다.

## 3. 보안과 환경변수 규칙

절대 커밋하지 않는다.

```text
.env
.env.local
.env.*.local
.vercel/
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
AI API key
```

저장소에는 값이 비어 있는 예시만 둔다.

```env
VITE_APP_NAME=Context Bridge
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_API_BASE_URL=http://localhost:4000
```

ZIP의 `.env.frontend.example`에는 `VITE_SUPABASE_ANON_KEY`가 들어 있으므로, repo에 반영할 때는 다음 이름으로 바꾼다.

```env
VITE_SUPABASE_PUBLISHABLE_KEY=
```

사용자가 전달한 실제 Supabase URL과 publishable key는 `.env.local`에만 넣고 커밋하지 않는다.

## 4. 현재 코드 기준 영향 범위

현재 프론트는 Vite + React + TypeScript + Tailwind 구조다.

핵심 파일:

```text
src/App.tsx
src/components/ChatWorkspace.tsx
src/components/Sidebar.tsx
src/components/ContextLog.tsx
src/services/contextSelector.ts
src/services/intentAnalyzer.ts
src/services/promptComposer.ts
src/services/profileRepository.ts
src/types.ts
```

현재 흐름:

- 로그인 화면은 demo account 선택 방식이다.
- `App.tsx`의 `analyze()`가 `/api/analyze-context`를 직접 호출한다.
- 호출 실패 시 `detectIntent()`와 `analyzeContext()`로 프론트 fallback 분석을 한다.
- `generatePrompt()`는 `composeBridgePrompt()`로 프론트에서 고급 프롬프트를 만든다.

세션 1에서 바꿀 방향:

- `/api/analyze-context` 직접 호출을 제거하거나 우회하고, 계약의 `POST /api/proposals`를 사용한다.
- 프론트 fallback 분석은 API mode에서 자동 대체로 쓰지 않는다.
- 승인 후 `POST /api/proposals/:proposalId/answers`를 호출한다.
- 답변 생성 요청에는 `approvedContextIds`만 보낸다.
- `composeBridgePrompt()`는 API mode에서는 사용하지 않고, API 응답을 화면에 표시한다.

## 5. Contract 적용 방식

ZIP의 계약 타입은 백엔드와 프론트가 공유하는 기준이므로 기존 `src/types.ts`에 무리하게 합치지 않는다.

권장 구조:

```text
contracts/
  API_CONTRACT.md
  README.md
  error-codes.ts
  mock-server.mjs
  mocks/
  types.ts
mock-server.mjs
src/services/apiClient.ts
src/services/contractApi.ts
src/services/contractMappers.ts
```

처리 기준:

- `contracts/types.ts`는 API 계약 타입의 단일 기준으로 둔다.
- 기존 `src/types.ts`는 UI 도메인 타입으로 유지한다.
- `contractMappers.ts`에서 API 타입을 UI 타입으로 변환한다.
- `tsconfig.app.json`의 include에 `contracts`를 추가해 타입 검사를 통과시킨다.
- root의 `mock-server.mjs`는 `node mock-server.mjs` 실행을 맞추기 위한 wrapper로 둔다.

## 6. API 연결 계획

### 6.1 공통 API client

새 파일:

```text
src/services/apiClient.ts
```

역할:

- `import.meta.env.VITE_API_BASE_URL`을 읽는다.
- base URL이 있으면 `http://localhost:4000/api/...`로 호출한다.
- base URL이 없으면 같은 도메인의 `/api/...`로 호출할 수 있게 한다.
- `Authorization: Bearer <token>`을 붙인다.
- JSON 요청/응답을 공통 처리한다.
- HTTP status 기준으로 오류를 분기한다.
- 오류 발생 시 mock fallback을 실행하지 않는다.

오류 상태 예시:

```text
401: 로그인 필요 또는 토큰 만료
400: 잘못된 입력 또는 답변 생성 실패
403: 권한 없음
404: 프로필 또는 리소스 없음
500: 서버 오류
network error: 서버 연결 실패
```

### 6.2 Bootstrap

계약:

```text
GET /api/bootstrap
Authorization: Bearer demo-student | demo-senior
```

응답:

```ts
BootstrapResponse
```

프론트 처리:

- 기존 demo login UI는 유지한다.
- 대학생 계정 선택 시 `demo-student` 토큰을 사용한다.
- 고령 사용자 계정 선택 시 `demo-senior` 토큰을 사용한다.
- `BootstrapResponse.profiles`를 현재 UI의 `UserProfile` 형태로 매핑한다.
- `ContextProfile.contexts`를 현재 승인 사이드바에서 쓸 수 있는 field 형태로 매핑한다.
- bootstrap 실패 시 로그인/프로필 로딩 오류와 재시도 버튼을 보여준다.

### 6.3 질문 분석과 승인 후보

계약:

```text
POST /api/proposals
```

요청:

```ts
CreateProposalRequest
```

응답:

```ts
ProposalResponse
```

프론트 처리:

- body에는 `profileId`, `query`만 보낸다.
- 응답의 `proposalId`를 상태에 보관한다.
- 응답의 `evaluations`를 승인 후보 UI에 표시한다.
- `suggested: true`인 카드만 기본 체크한다.
- `exclusionReason`이 있는 카드는 제외 목록과 사유로 표시한다.
- `valueVisible: false` 카드는 값 대신 라벨만 표시하고 체크박스를 비활성화한다.
- `selectionMode`는 "규칙 선별" 또는 "AI 선별" 배지로 표시할 수 있다.

현재 UI 매핑:

```text
EvaluatedContext.context.title       -> field.label
EvaluatedContext.context.content     -> field.value
EvaluatedContext.reason              -> field.reason
EvaluatedContext.context.privacyLevel -> sensitivity
EvaluatedContext.suggested           -> initial approval
EvaluatedContext.exclusionReason     -> excluded
```

주의:

- confidential 카드는 content가 마스킹될 수 있으므로 UI에서도 실제 값에 의존하지 않는다.
- 프론트가 카드 ID나 updatedAt을 만들지 않는다.

### 6.4 승인 후 AI 응답 생성

계약:

```text
POST /api/proposals/:proposalId/answers
```

요청:

```ts
GenerateAnswerRequest
```

body:

```json
{
  "approvedContextIds": ["context-id-1", "context-id-2"],
  "includeRawComparison": true
}
```

프론트 처리:

- 승인된 카드 객체나 content를 보내지 않는다.
- 승인된 `contextId` 배열만 보낸다.
- 응답의 `contextBridgeAnswer`를 채팅 응답으로 표시한다.
- `rawAnswer`가 있으면 비교 UI에 표시한다.
- `usedContexts`, `usedContextsCount`, `snapshotHash`를 사용 기록 또는 상세 영역에 표시한다.
- `auditLog`는 현재 `ContextLog`의 `InteractionRecord` 형태로 매핑한다.

### 6.5 기억 후보

계약:

```text
POST /api/memory-candidates/:candidateId
```

요청:

```ts
ResolveMemoryRequest
```

프론트 처리:

- `memoryCandidates`가 있으면 답변 아래에 "기억할까요?" UI를 보여준다.
- 자동 저장하지 않는다.
- 사용자가 `save` 또는 `ignore`를 선택할 때만 API를 호출한다.
- save 성공 시 응답의 `context`가 있으면 화면 상태에 반영할 준비를 한다.

mock 서버 기본 응답은 `answer.success.json`이므로 memory 후보가 안 보일 수 있다. memory UI 테스트가 필요하면 mock 서버에서 `answer.withMemory.json`을 쓰도록 변경하거나 별도 테스트 fixture를 사용한다.

## 7. 추천 질문 처리

현재 ZIP의 `API_CONTRACT.md`에는 별도 추천 질문 endpoint가 없다.

따라서 세션 1에서는 기존 `profile.examples` 기반 추천 질문 버튼을 유지한다. API 계약에 추천 질문 endpoint가 추가되면 다음 형태로 분리한다.

```text
src/services/recommendationApi.ts
```

그 전까지는 추천 질문 UI를 새 계약에 맞지 않는 임의 API로 만들지 않는다.

## 8. UI 상태 계획

기존 ChatGPT형 UI는 유지하고 상태만 추가한다.

필요 상태:

```text
bootstrap loading
proposal loading
generate loading
memory resolve loading
empty profile
empty context
api error
retry target
```

화면 처리:

- 질문 전송 중: 입력 버튼 disabled, 로딩 표시
- 후보 없음: "이번 질문에 사용할 맥락이 없습니다" empty 상태
- 응답 생성 중: 채팅 메시지 위치에 loading 상태
- 서버 오류: 상태별 안내 문구와 재시도 버튼
- mock 서버 미실행: 네트워크 오류로 표시
- 401: 다시 로그인 안내
- 400/404: 요청 또는 프로필 상태 확인 안내

중요:

- API 실패 시 기존 프론트 fallback 분석으로 조용히 넘어가지 않는다.
- 실제 배포 API 실패 시 mock JSON을 import하거나 대체 표시하지 않는다.

## 9. 파일별 작업 순서

1. 브랜치 확인

```bash
git checkout main
git checkout -b feature/frontend
```

2. 계약 파일 반영

```text
contracts/
mock-server.mjs
```

3. 환경변수 예시 정리

```text
.env.example
contracts/.env.frontend.example
```

`VITE_SUPABASE_ANON_KEY`는 사용하지 않고 `VITE_SUPABASE_PUBLISHABLE_KEY`만 남긴다.

4. TypeScript 설정

```text
tsconfig.app.json
```

`contracts` 타입을 import할 수 있게 include를 조정한다.

5. API 서비스 추가

```text
src/services/apiClient.ts
src/services/contractApi.ts
src/services/contractMappers.ts
```

6. App 상태 연결

```text
src/App.tsx
```

- demo 계정 -> demo token 매핑
- bootstrap 호출
- proposal 생성 호출
- generate 호출
- memory candidate 처리
- 오류/재시도 상태 보관

7. UI props 확장

```text
src/components/ChatWorkspace.tsx
src/components/Sidebar.tsx
src/components/ContextLog.tsx
```

- loading 상태
- error/retry 상태
- disabled confidential checkbox
- answer/raw answer/memory candidate 표시

8. 문서 업데이트

```text
README.md
docs/FRONTEND_HANDOFF.md
```

- mock server 실행법
- `VITE_API_BASE_URL=http://localhost:4000`
- 실제 키 커밋 금지
- session 1에서 Supabase auth는 제외한다는 범위

## 10. 검증 계획

### 로컬 실행

터미널 1:

```bash
node mock-server.mjs
```

터미널 2:

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

### 수동 확인

- 대학생 demo 계정 선택
- 고령 사용자 demo 계정 선택
- 질문 전송
- 승인 후보 표시
- suggested 카드 기본 체크
- excluded 카드 사유 표시
- confidential/valueVisible false 카드 비활성 처리
- 승인한 카드 ID만 generate 요청에 포함
- AI 응답 표시
- raw answer 비교 표시
- memory candidate empty 상태
- mock 서버 중단 후 오류와 재시도 표시
- `.env.local`, `.vercel`, 실제 key가 git status에 나오지 않는지 확인

## 11. 다음 세션 계획

세션 1이 끝난 뒤에도 프론트 작업은 팀 기준에 맞춰 `feature/frontend`에서 이어간다.

팀 브랜치 구조:

```bash
main
  develop
    feature/frontend
    feature/backend
    feature/integration
```

범위:

- 회원가입
- 로그인/로그아웃
- 로그인 상태 유지
- 사용자 프로필 조회/생성/수정
- 컨텍스트 카드 조회/생성/수정/삭제
- 질문 기록 조회
- `account_profiles`, `context_cards`, `context_proposals`, `approval_snapshots`, `audit_logs`, `memory_candidates` 실제 연동

테스트 계정:

```text
팀에서 별도로 전달받은 학생 테스트 계정
팀에서 별도로 전달받은 고령자 테스트 계정
프로필이 없는 신규 사용자
```

세션 2에서도 `service_role` key와 AI API key는 프론트에 넣지 않는다.

## 12. 완료 기준

세션 1 완료 기준:

- `feature/frontend` 브랜치에서 작업한다.
- 기존 ChatGPT형 UI가 유지된다.
- `node mock-server.mjs`로 mock API가 실행된다.
- `VITE_API_BASE_URL=http://localhost:4000` 기준 API client가 동작한다.
- ZIP의 `contracts/types.ts` 타입을 import해서 사용한다.
- 질문 -> proposal -> 승인 -> generate 흐름이 mock API로 연결된다.
- API 실패 시 mock fallback이 아니라 오류/재시도 UI가 보인다.
- loading, empty, error 상태가 구현된다.
- 실제 환경변수와 `.vercel`은 커밋되지 않는다.
- `npm run build`가 통과한다.
