# Context Bridge

Context Bridge는 사용자의 정보, 선호, 목표, 제약 조건을 프로필과 컨텍스트 카드로 관리하고, 질문에 필요한 맥락만 사용자의 승인 아래 AI에 전달하는 사용자 통제형 서비스입니다. 고성능 AI 활용이 어려운 비전공자와 디지털 취약계층도 자신의 상황에 맞는 답변을 얻도록 돕는 것이 목표입니다.

## 현재 구현 범위

- 이메일 회원가입, 로그인, 로그아웃과 새로고침 후 세션 유지
- 로그인 사용자별 프로필 조회, 생성, 수정
- 컨텍스트 카드 조회, 생성, 수정, 삭제
- 질문 기록 조회
- 기존 ChatGPT형 채팅 UI와 Mock AI 질문, 맥락 제안, 답변 생성 연결
- 로딩, 빈 데이터, 오류, 재시도 상태
- 모바일 접이식 탐색과 고령층 쉬운 모드
- 브라우저 음성 인식을 이용한 질문 입력과 생성 답변 읽어주기
- 실제 API 실패 시 Mock 데이터로 자동 대체하지 않음

인증, 프로필, 컨텍스트 카드는 팀 공용 Supabase에 연결합니다. AI 관련 기능은 실제 백엔드가 완성될 때까지 전달받은 `contracts/`와 `mock-server.mjs`를 사용합니다.

## 환경변수

프로젝트 루트의 `.env.local`에 실제 값을 작성합니다. 이 파일은 Git에 커밋하지 않습니다.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_API_BASE_URL=http://localhost:4000
```

저장소에는 값이 비어 있는 `.env.example`만 유지합니다. `VITE_SUPABASE_ANON_KEY`, Supabase `service_role`/secret key, AI API 키는 프론트엔드에 추가하지 않습니다.

## 로컬 실행

터미널 1에서 Mock API를 실행합니다.

```bash
node mock-server.mjs
```

터미널 2에서 프론트엔드를 실행합니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다. 질문 전송은 `/api/proposals`, 승인 후 답변 생성은 `/api/proposals/:proposalId/generate` 계약을 사용합니다.

## 검증

```bash
npm run lint
npm test
npm run build
```

`supabase_schema.sql`은 초기 데모용 스키마이며 현재 팀 공용 Supabase의 실제 테이블 구조와 다릅니다. 공용 프로젝트에는 이 파일을 실행하거나 프론트에서 DB 컬럼을 임의로 변경하지 않습니다. 확인된 최신 상태와 다음 작업은 `docs/FRONTEND_HANDOFF.md`를 참고합니다.
