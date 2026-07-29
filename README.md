# Context Bridge

Context Bridge는 사용자의 정보·취향·목표·제약조건을 개인 프로필로 관리하고, 짧은 질문의 의도를 분석해 필요한 맥락만 규칙 기반으로 선별한 뒤, 사용자 승인 후 LLM에 전달할 고급 프롬프트를 만드는 사용자 통제형 AI 서비스입니다.

## MVP 흐름

1. 데모 로그인 계정 선택
2. 로그인 계정의 `account_id`로 개인 프로필 조회
3. 백엔드 규칙 엔진에서 질문 의도 분석
4. 필요한 정보, 민감 가능 정보, 제외 정보를 UI에 표시
5. 사용자가 승인한 정보만 고급 프롬프트에 포함

## 대표 계정

- 전이현: 대학생, 공기업 전산직 준비
- 김영자: 고령 사용자, 큰 글씨와 쉬운 설명 선호

## 환경변수

프로젝트 루트에 `.env.local`을 만들고 아래 값을 넣습니다. 개발 환경에서는 전달받은 Mock API 주소를 사용하고, 배포 환경에서는 실제 API 주소를 설정합니다. 실제 값이 들어간 `.env.local`은 GitHub에 올리지 않습니다.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_API_BASE_URL=http://localhost:4000
```

AI API 키와 Supabase `service_role` 키는 프론트엔드에 넣지 않고 백엔드 API에서만 사용합니다.

테이블과 데모 데이터는 `supabase_schema.sql`을 기준으로 만들 수 있습니다. 이 SQL은 `demo_accounts`와 `profiles`를 만들고, `profiles.account_id`로 계정과 프로필을 연결합니다.

## Mock API와 프론트 실행

터미널 1:

```bash
node mock-server.mjs
```

터미널 2:

```bash
npm install
npm run dev
```

데모 계정은 Mock API 계약의 `demo-student`, `demo-senior` 토큰으로 `/api/bootstrap`을 호출합니다. 질문 전송은 `/api/proposals`, 사용자 승인 후 답변 생성은 `/api/proposals/:proposalId/generate`를 사용합니다.

실제 API 호출에 실패하면 Mock 데이터나 프론트 규칙으로 자동 대체하지 않고 오류와 재시도 화면을 표시합니다.

## 작업 인수인계

새 Codex 세션에서 이어 작업할 때는 `docs/FRONTEND_HANDOFF.md`를 먼저 읽고 세션별 작업 범위를 나눠서 진행합니다.

초기 단일 파일 스케치는 `prototype.html`에 보존되어 있습니다.
