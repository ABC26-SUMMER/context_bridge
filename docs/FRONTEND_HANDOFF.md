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
npm run lint
npm test
npm run build
```

ESLint는 TypeScript와 React Hooks를 검사합니다. Vitest는 계약 응답의 선택·민감·제외 분리, 기밀값 숨김, 초기 승인 규칙과 답변 품질 상태를 검증합니다.

## 세션 3: UI/UX Polish

상태: 구현 및 로컬 검증 완료, 커밋 전.

- 모바일에서 사이드바를 접힌 상태로 시작하고 메뉴 버튼으로 열고 닫도록 개선
- 화면 이동 후 모바일 메뉴 자동 닫힘
- 고령층 쉬운 모드에서 작은 문구를 최소 16px로 확대
- 고령층 본문을 18px로 확대하고 데스크톱 사이드바를 340px로 확장
- 쉬운 모드 입력과 버튼의 최소 높이를 52px로 확대
- 브라우저 Web Speech API 기반 한국어 음성 질문 입력
- 생성된 개인화 답변을 사용자 요청 시 한국어로 읽어주는 기능
- 키보드 `focus-visible` 표시와 동작 감소 환경 지원
- 로그인 탭 의미 구조, 필수 입력, 회원가입 비밀번호 길이 상태 개선
- 온보딩 입력 비활성화와 오류 알림 접근성 보완
- 모바일 375px과 데스크톱 1440px에서 가로 overflow 없음
- 브라우저 콘솔 오류 없음

음성 기능은 Chrome 계열 등 Web Speech API를 제공하는 브라우저에서 동작합니다. 마이크 권한이 없거나 API를 지원하지 않는 환경에서는 텍스트 입력을 유지하고 안내 문구를 표시합니다. 답변은 자동 재생하지 않으며 사용자가 `답변 읽기`를 눌렀을 때만 낭독합니다.

## 남은 작업

- 제공되는 신규 테스트 계정으로 빈 프로필/빈 카드/RLS 검증
- 학생 테스트 계정 정보 수정 후 대학생 데이터 검증
- 이메일 인증을 포함한 실제 회원가입 완료 흐름 검증
- 실제 질문 기록 데이터가 준비되면 `audit_logs` 매핑 검증
- 실제 백엔드 준비 후 `VITE_API_BASE_URL` 교체와 통합 검증

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
