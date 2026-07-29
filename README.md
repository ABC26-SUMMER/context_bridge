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

프로젝트 루트에 `.env.local`을 만들고 아래 값을 넣으면 공용 Supabase 프로필과 API 서버를 사용할 수 있습니다. 값이 없으면 로컬 데모 데이터로 동작합니다. 실제 값이 들어간 `.env.local`은 GitHub에 올리지 않습니다.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_API_BASE_URL=http://localhost:4000
```

AI API 키와 Supabase `service_role` 키는 프론트엔드에 넣지 않고 백엔드 API에서만 사용합니다.

테이블과 데모 데이터는 `supabase_schema.sql`을 기준으로 만들 수 있습니다. 이 SQL은 `demo_accounts`와 `profiles`를 만들고, `profiles.account_id`로 계정과 프로필을 연결합니다.

## 실행

```bash
npm install
npm run dev
```

초기 단일 파일 스케치는 `prototype.html`에 보존되어 있습니다.
