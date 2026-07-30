# Context Bridge 통합 결과

## 기준
- 화면·컴포넌트·접근성·프로필 관리: `feature/frontend` 작업물
- 인증 검증·Controller API·맥락 선별·승인 검증·LLM·감사 로그: v15 백엔드
- 연결 경계: `src/services/contractApi.ts` → `/api/*`

## 유지한 핵심 흐름
로그인 → 프로필이 없으면 온보딩 → 프로필 선택 → 질문 → 맥락 추천 → 사용자 승인 → 답변 → 기억 저장/무시

## 주요 위치
- 프론트: `src/`
- 공유 API 계약: `contracts/`
- 백엔드: `backend/server/`, `backend/types.ts`, `server.ts`
- Vercel 함수: `api/index.ts`
- Supabase migration: `supabase/migrations/`

## 환경변수
브라우저 키는 `VITE_SUPABASE_PUBLISHABLE_KEY` 또는 `VITE_SUPABASE_ANON_KEY`를 지원한다.
서버 키는 `SUPABASE_PUBLISHABLE_KEY` 또는 `SUPABASE_ANON_KEY`를 지원한다.
서비스 역할 키는 브라우저에 넣지 않는다.

## 실행
```powershell
npm install
npm run lint
npm test
npm run build
npm run dev
```
