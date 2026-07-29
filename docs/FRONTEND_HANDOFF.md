# Frontend Handoff

이 문서는 새 Codex 세션이 기존 대화 맥락 없이도 Context Bridge 프론트엔드 작업을 이어갈 수 있게 하기 위한 인수인계 문서입니다. 새 세션은 작업 전에 `README.md`와 이 문서를 먼저 읽어야 합니다.

## 현재 기준

- 팀 repo: `https://github.com/ABC26-SUMMER/context_bridge.git`
- 기준 브랜치: `main`
- 현재 `main`은 프론트엔드 baseline 역할을 합니다.
- 기존 개인 repo `KimJongHyun2/sleep_abc`에서 작업하던 코드를 팀 repo `main`으로 올렸습니다.
- 팀 repo에 있던 초기 README 커밋은 로컬 `main`에 병합했고, 강제 push 없이 팀 `main`에 반영했습니다.

## 현재 구현 상태

- Vite + React + TypeScript + Tailwind 기반 프론트엔드입니다.
- 메인 화면은 ChatGPT와 유사한 채팅 중심 UI로 개편되어 있습니다.
- 왼쪽 사이드바에는 프로필, 선택/승인/민감 카운트, 맥락 승인 체크박스가 있습니다.
- 오른쪽 본문에는 대화 메시지, 질문 입력창, 분석 결과, 생성된 고급 프롬프트가 표시됩니다.
- 백엔드 `/api/analyze-context` 호출이 실패하면 현재는 프론트 fallback 규칙 엔진으로 분석합니다.
- Supabase 환경변수가 없으면 로컬 demo data로 동작합니다.

주요 파일:

```text
src/App.tsx
src/components/ChatWorkspace.tsx
src/components/Sidebar.tsx
src/services/supabaseClient.ts
src/services/profileRepository.ts
src/services/contextSelector.ts
src/services/intentAnalyzer.ts
src/services/promptComposer.ts
src/types.ts
```

## 완료된 결정

1. 현재 프론트 디자인을 팀 공용 baseline으로 사용합니다.
2. 개인 Vercel/Supabase 설정은 팀 repo에 올리지 않습니다.
3. `.env.local`은 GitHub에 올리지 않고, `.env.example`만 공유합니다.
4. 프론트 Supabase 키 이름은 `VITE_SUPABASE_PUBLISHABLE_KEY`를 사용합니다.
5. `VITE_SUPABASE_ANON_KEY`는 더 이상 사용하지 않습니다.
6. Supabase `service_role` 키와 AI API 키는 프론트엔드에 넣지 않습니다.
7. 실제 backend API가 완성되기 전에는 mock API와 frontend fallback으로 UI를 개발합니다.
8. 실제 API 호출 실패 시 배포 환경에서 조용히 mock으로 대체하지 말고, loading/error/retry 상태를 UI로 보여주는 방향입니다.

## 환경변수 규칙

`.env.example`에는 값이 비어 있는 템플릿만 둡니다.

```env
VITE_APP_NAME=Context Bridge
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_API_BASE_URL=http://localhost:4000
```

개인 또는 팀 실제 값은 `.env.local`에만 둡니다. `.gitignore`는 `.env`, `.env.local`, `.env.*.local`, `.vercel/`을 제외합니다.

금지:

```text
VITE_SUPABASE_ANON_KEY를 새로 추가하지 않기
Supabase service_role key를 프론트에 넣지 않기
AI API key를 프론트에 넣지 않기
.vercel/ 또는 .env.local 커밋하지 않기
```

## 다음 작업 분리

새 세션은 한 번에 모든 작업을 하지 말고, 아래 셋 중 하나만 맡는 것을 권장합니다.

### 세션 1: contracts/mock API 연동

권장 브랜치:

```bash
git checkout -b feature/frontend-contract-integration
```

목표:

- 전달받은 ZIP의 `contracts/` 폴더를 확인합니다.
- `types.ts` 또는 계약 타입을 기존 `src/types.ts`와 충돌 없이 연결합니다.
- `mock-server.mjs` 실행 기준을 README나 별도 문서에 반영합니다.
- `VITE_API_BASE_URL=http://localhost:4000` 기준으로 API client를 만듭니다.
- 질문 전송, AI 응답, 추천 질문, loading, empty, error, retry 상태를 mock API 기준으로 연결합니다.

주의:

- 기존 UI를 크게 갈아엎지 말고 `ChatWorkspace`의 흐름에 API 계층을 붙입니다.
- UI 컴포넌트 안에 fetch 로직을 흩뿌리지 말고 `src/services/` 아래에 분리합니다.
- 실제 API 실패를 mock으로 자동 대체하지 말고, 실패 상태를 사용자가 볼 수 있게 합니다.

예상 파일:

```text
src/services/apiClient.ts
src/services/chatApi.ts
src/services/contextApi.ts
src/types.ts
```

### 세션 2: Supabase auth/profile 연동

권장 브랜치:

```bash
git checkout -b feature/frontend-supabase-profile
```

목표:

- 공용 Supabase 환경변수 기준으로 로그인/로그아웃 흐름을 정리합니다.
- 사용자 프로필 조회/생성/수정 UI를 실제 Supabase 데이터와 연결합니다.
- 컨텍스트 카드 조회/생성/수정/삭제 흐름을 준비합니다.
- 값이 없을 때 demo data로 앱이 죽지 않게 유지합니다.

주의:

- `VITE_SUPABASE_PUBLISHABLE_KEY`만 사용합니다.
- `service_role` 키는 프론트에서 절대 사용하지 않습니다.
- Supabase table/schema 변경은 백엔드 담당자와 맞춘 뒤 진행합니다.

예상 파일:

```text
src/services/supabaseClient.ts
src/services/profileRepository.ts
src/components/LoginScreen.tsx
src/components/ProfileManager.tsx
```

### 세션 3: UI/UX polish

권장 브랜치:

```bash
git checkout -b feature/frontend-chat-polish
```

목표:

- 현재 채팅 중심 UI의 완성도를 높입니다.
- 사이드바 접기/펼치기, 모바일 UX, 입력창 상태, 버튼 상태를 다듬습니다.
- loading, empty, error, retry UI를 실제 사용 흐름에 맞게 정리합니다.
- 접근성, 문구, focus 상태, responsive overflow를 확인합니다.

주의:

- 기존 색감과 Context Bridge 톤을 유지합니다.
- 대시보드형 카드 화면으로 되돌리지 않습니다.
- UI-only 작업이면 API 계약 파일은 건드리지 않습니다.

예상 파일:

```text
src/components/ChatWorkspace.tsx
src/components/Sidebar.tsx
src/index.css
tailwind.config.ts
```

## ZIP 관련 메모

도원님이 전달한 ZIP은 프론트 UI에 API 계약을 붙이기 위한 자료입니다. 사용 전에 압축을 풀고 구조를 먼저 확인해야 합니다.

확인할 항목:

```text
contracts/
mock-server.mjs
.env.frontend.example
types.ts
README 또는 API 문서
```

요청받은 변경:

- `node mock-server.mjs`로 mock API 서버 실행
- 프론트 `.env.local`에 `VITE_API_BASE_URL=http://localhost:4000` 사용
- ZIP의 `.env.frontend.example`에 `VITE_SUPABASE_ANON_KEY`가 있으면 `VITE_SUPABASE_PUBLISHABLE_KEY`로 변경
- 실제 Supabase URL/key 값은 repo에 커밋하지 않기

## 권장 Git 흐름

처음 새 세션에서:

```bash
git clone https://github.com/ABC26-SUMMER/context_bridge.git
cd context_bridge
npm install
npm run build
```

작업 시작:

```bash
git checkout main
git pull origin main
git checkout -b feature/작업명
```

작업 완료:

```bash
npm run build
git status
git add 필요한-파일만
git commit -m "feat: ..."
git push origin feature/작업명
```

팀 기준으로는 `main`에 직접 계속 push하지 말고, 가능하면 feature 브랜치에서 PR로 합칩니다. 단, 현재 baseline과 handoff 문서처럼 팀 공용 기둥을 세우는 작업은 예외적으로 `main`에 반영했습니다.

## 새 세션 시작 프롬프트 예시

세션 1:

```text
README.md와 docs/FRONTEND_HANDOFF.md를 먼저 읽고, 세션 1: contracts/mock API 연동만 진행해줘. main에서 feature/frontend-contract-integration 브랜치를 만들고, 기존 ChatWorkspace UI는 유지하면서 VITE_API_BASE_URL 기반 API 계층을 붙여줘.
```

세션 2:

```text
README.md와 docs/FRONTEND_HANDOFF.md를 먼저 읽고, 세션 2: Supabase auth/profile 연동만 진행해줘. main에서 feature/frontend-supabase-profile 브랜치를 만들고, VITE_SUPABASE_PUBLISHABLE_KEY 기준으로 프로필 조회/수정 흐름을 연결해줘.
```

세션 3:

```text
README.md와 docs/FRONTEND_HANDOFF.md를 먼저 읽고, 세션 3: UI/UX polish만 진행해줘. main에서 feature/frontend-chat-polish 브랜치를 만들고, 현재 채팅 중심 UI를 유지한 채 loading/error/retry/mobile/sidebar UX를 다듬어줘.
```

## 검증 기준

각 세션은 최소한 아래를 확인합니다.

```bash
npm run build
```

UI를 바꾸는 세션은 가능하면 브라우저로 다음을 확인합니다.

```text
로그인 화면
채팅 메인 화면
질문 분석
맥락 승인
프롬프트 생성
모바일 폭에서 가로 overflow 없음
```

## 남은 리스크

- 실제 백엔드 API 계약이 ZIP의 contracts와 현재 프론트 타입 구조에 얼마나 맞는지 아직 확인하지 않았습니다.
- 팀 공용 Supabase schema와 현재 `supabase_schema.sql`이 완전히 일치하는지 확인이 필요합니다.
- 현재 `/api/analyze-context`는 Vercel serverless 형태의 기존 코드가 남아 있습니다. 팀 백엔드 구조가 확정되면 정리 또는 제거 여부를 결정해야 합니다.
