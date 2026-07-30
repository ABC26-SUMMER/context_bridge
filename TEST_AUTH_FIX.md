# 테스트 인증 격리 수정

Supabase 환경변수가 설정된 상태에서도 Vitest의 `demo-student` 토큰은 실제 Supabase JWT 검증으로 보내지 않습니다.

- `NODE_ENV=test`이고 로컬 fixture 토큰이 존재할 때만 로컬 인증
- 개발/운영 환경에서는 `demo-student` 같은 토큰을 인증 우회로 인정하지 않음
- 실제 Supabase 사용자 인증 흐름에는 영향 없음

검증:

```powershell
npm test
npm run verify
```
