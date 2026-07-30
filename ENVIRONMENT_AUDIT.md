# 환경변수 통합 검수 결과

## 발견한 핵심 결함

1. `server.ts`가 `dotenv.config()`를 호출하기 전에 ESM import로 `dataGateway.ts`가 평가되어, 서버 Supabase 설정이 빈 값으로 고정될 수 있었습니다.
2. Vite는 `.env.local`을 자동으로 읽지만 Node/Express는 기본 `dotenv.config()`만으로 `.env.local`을 읽지 않았습니다.
3. 기존 문서 일부가 `VITE_API_BASE_URL=http://localhost:4000`을 권장했지만 통합 서버는 3000번 포트이므로, 프론트 요청이 존재하지 않는 Mock 서버로 갈 수 있었습니다.
4. 브라우저와 서버의 키 이름이 `PUBLISHABLE_KEY`/`ANON_KEY`로 혼재했고, 실행 전 검증 수단이 없었습니다.
5. Vercel/로컬에서 설정 누락 시 원인을 확인할 안전한 상태 API가 없었습니다.

## 해결

- `backend/config/env.ts`가 가장 먼저 `.env.local` → `.env`를 로딩합니다.
- 모든 서버 Supabase 설정은 단일 `env` 객체를 통해 읽습니다.
- 통합 실행에서는 `VITE_API_BASE_URL`을 빈 값으로 두고 같은 도메인의 `/api`를 사용합니다.
- `npm run env:check`로 키 값을 노출하지 않고 누락·URL 불일치·잘못된 4000 포트 설정을 검사합니다.
- `/api/health/config`는 키를 반환하지 않고 준비 상태만 반환합니다.
- 서버 시작 시 Supabase와 Gemini 연결 준비 상태를 출력합니다.

## 권장 명령

```powershell
Copy-Item .env.example .env.local
code .env.local
npm run env:check
npm run verify
npm run dev
```

정상 상태 API:

```text
http://localhost:3000/api/health/config
```
