# Frontend Handoff

새 작업을 시작하기 전에 `README.md`와 이 문서를 먼저 읽습니다. 팀이 정한 범위를 유지하며 `main`에 직접 작업하지 않고 `feature/frontend`에서 진행합니다.

## 제품 방향

Context Bridge는 일반 사용자, 비전공자, 고령층 등 디지털 취약계층이 AI를 더 잘 활용하도록 돕는 포용적 AI 서비스입니다. 사용자 프로필과 컨텍스트 카드를 지속적으로 관리하고, 질문에 필요한 정보만 사용자의 승인 아래 AI 요청에 포함합니다.

기존 ChatGPT형 채팅 UI는 유지합니다. 프로필 정보 전체를 자동 전송하지 않고, 사용자가 확인하고 승인한 맥락 ID만 백엔드에 전달합니다.

## 완료된 팀 결정

- 팀 repo: `https://github.com/ABC26-SUMMER/context_bridge.git`
- 프론트 작업 브랜치: `feature/frontend`
- 환경변수 키 이름: `VITE_SUPABASE_PUBLISHABLE_KEY`
- 실제 환경변수는 `.env.local`에만 저장
- `.env.local`, `.vercel/`, Supabase secret/service role 키, AI API 키 커밋 금지
- 실제 API 실패 시 Mock 데이터나 로컬 규칙으로 자동 대체 금지
- 팀 공용 Supabase의 테이블과 컬럼을 프론트에서 임의 변경 금지

## 세션 1: Contracts/Mock API

상태: 완료. 커밋 `4401c1f feat: contracts mock API 연동`

- ZIP의 `contracts/`와 공통 타입 반영
- `VITE_API_BASE_URL` 기반 API client 구성
- `/api/bootstrap`, `/api/proposals`, `/api/proposals/:proposalId/generate` 연결
- 질문 분석, 맥락 승인, AI 답변, 추천 질문 흐름 연결
- 로딩, 빈 응답, 오류, 재시도 UI 구현
- API 실패 시 프론트 fallback 제거

Mock 응답은 계약 검증용 고정 fixture이므로 로그인한 프로필과 다른 예시 데이터가 표시될 수 있습니다. 실제 백엔드가 완성되면 `VITE_API_BASE_URL`만 교체합니다.

## 세션 2: Supabase Auth/Profile

상태: 구현 및 로컬 검증 완료, 커밋 전.

- 이메일 회원가입, 로그인, 로그아웃
- Supabase 세션을 앱 상태의 기준으로 사용하고 새로고침 후 로그인 유지
- 프로필이 없는 신규 사용자의 첫 프로필 생성 화면
- 프로필 조회와 수정
- 컨텍스트 카드 조회, 생성, 수정, 삭제
- 질문 기록 조회
- Mock AI 요청에 현재 Supabase access token 전달
- Supabase 실패 시 오류를 표시하고 편집 폼을 유지

실제 RLS 접근으로 확인한 테이블:

```text
account_profiles
context_cards
context_proposals
approval_snapshots
audit_logs
memory_candidates
```

프론트에서 현재 사용하는 확인된 컬럼:

```text
account_profiles:
id, user_id, display_name, persona_type, profile_name,
icon, description, is_active, created_at, updated_at

context_cards:
id, user_id, profile_id, semantic_group, category, label,
value_text, tags, enabled, sensitivity, version, created_at, updated_at
```

`context_proposals`, `approval_snapshots`, `audit_logs`, `memory_candidates`는 테스트 계정에 조회 가능한 행이 없어 공개 키와 RLS 범위에서 전체 컬럼을 확정하지 않았습니다. 추측해서 컬럼이나 테이블을 추가하지 않습니다.

## 검증 결과

- `senior-test@example.com` 계정 로그인 성공
- 고령층 프로필과 컨텍스트 카드 4건 조회 성공
- 프로필 수정 후 원래 값으로 복구 성공
- 컨텍스트 카드 생성, 수정, 삭제 후 원래 상태로 복구 성공
- 새로고침 후 로그인 세션과 DB 데이터 유지 확인
- Supabase access token으로 Mock AI 제안과 답변 생성 확인
- 로그아웃 확인
- 모바일 `390 x 844`에서 가로 overflow 없음
- 브라우저 콘솔 오류 없음

현재 확인이 필요한 외부 상태:

- 전달받은 `student-test@example.com / 123`은 Supabase에서 `invalid_credentials`를 반환합니다. 계정 또는 비밀번호를 팀에서 확인해야 합니다.
- 프로필과 카드가 없는 신규 테스트 계정의 로그인 정보는 전달되지 않아 실제 RLS 기준 온보딩 검증은 아직 하지 못했습니다.

## 환경변수

`.env.example`에는 템플릿만 유지합니다.

```env
VITE_APP_NAME=Context Bridge
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_API_BASE_URL=http://localhost:4000
```

실제 값은 `.env.local`에만 작성합니다. `.gitignore`는 `.env`, `.env.local`, `.env.*.local`, `.vercel/`을 제외합니다.

## 실행과 검증

```bash
# 터미널 1
node mock-server.mjs

# 터미널 2
npm run dev

# 정적 검증
npm run build
```

현재 `package.json`에는 `lint`와 자동 테스트 스크립트가 없습니다. 팀 도구가 결정되면 별도 작업으로 추가해야 합니다.

## 다음 작업

다음 세션은 세션 3 UI/UX polish 범위로 진행합니다.

- 로그인, 온보딩, 프로필 관리의 키보드 focus와 접근성 점검
- 로딩, 빈 데이터, 오류, 재시도 문구와 상태 정리
- 모바일 사이드바와 긴 텍스트 레이아웃 점검
- 제공되는 신규 테스트 계정으로 빈 프로필/빈 카드/RLS 검증
- 학생 테스트 계정 정보 수정 후 대학생 데이터 검증
- 팀에서 lint/test 도구를 확정한 뒤 스크립트와 최소 테스트 추가

실제 백엔드가 준비되기 전에는 contracts나 Mock fixture를 임의 변경하지 않습니다. `supabase_schema.sql`은 과거 데모 스키마이므로 팀 공용 Supabase에 실행하지 않습니다.

## 주요 파일

```text
src/App.tsx
src/components/LoginScreen.tsx
src/components/ProfileOnboarding.tsx
src/components/ProfileManager.tsx
src/components/ChatWorkspace.tsx
src/components/Sidebar.tsx
src/services/authService.ts
src/services/supabaseClient.ts
src/services/profileRepository.ts
src/services/apiClient.ts
src/services/contractApi.ts
src/types.ts
```
