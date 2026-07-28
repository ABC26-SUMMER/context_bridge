# Context Bridge

계정별 사용자 맥락을 저장하고, 질문마다 필요한 카드만 서버 규칙으로 선별한 뒤
사용자 승인 후 AI에 전달하는 React/Express/Supabase 데모입니다.

`persona_type`은 로그인 화면과 초기 설정에만 사용합니다. 실제 후보 선택은
“대학생/고령자”라는 라벨이 아니라 각 계정 카드의 태그·활성 상태·민감도·신선도를
기준으로 수행합니다.

## 기술 흐름

1. Supabase Auth 세션으로 API를 호출한다.
2. 서버가 토큰을 검증하고, RLS가 적용된 Supabase에서 해당 계정의 프로필과 카드를 읽는다.
3. 외부 AI 없이 로컬 규칙으로 의도·태그를 매칭하고 민감도 정책을 강제한다.
4. UI가 선택 이유와 제외 이유를 보여주며, 사용자가 카드별로 승인한다.
5. 클라이언트는 `proposalId + approvedIds`만 생성 API에 보낸다.
6. 서버가 소유자·상태·ID를 재검증하고 승인 Snapshot을 고정한다.
7. 승인된 값만 Gemini에 전달하고 감사 기록을 저장한다.
8. 답변에서 새로 확인한 사실은 별도의 저장 승인을 거쳐 카드가 된다.

민감·90일 이상 지난 카드는 기본 해제되고, 기밀 카드는 값도 노출하지 않으며
승인할 수 없습니다.

## Supabase 설정

1. Supabase 프로젝트를 만들고
   `supabase/migrations/202607280001_context_bridge.sql`을 실행합니다.
2. `.env.example`을 `.env`로 복사해 URL과 anon key를 넣습니다.
3. 데모 계정 비밀번호와 service role key를 셸 환경변수로 넣고 시드합니다.

```bash
npm install
npm run seed:demo
npm run dev
```

브라우저에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`만 노출합니다.
`SUPABASE_SERVICE_ROLE_KEY`는 시드 스크립트 전용이며 `VITE_` 접두사를 붙이면
안 됩니다. 두 데모 계정은 `student@contextbridge.demo`(전이현)와
`senior@contextbridge.demo`(김영자)입니다.

Supabase 환경값이 없으면 같은 두 계정을 사용하는 로컬 데모 모드가 켜집니다.
이 모드는 UI와 승인 경계 리허설용이며 운영 인증을 대신하지 않습니다.
`GEMINI_API_KEY`가 없을 때는 오프라인 답변을 사용합니다.

## 검증

```bash
npm run lint
npm test -- --run
npm run build
```

현재 13개 테스트가 질문→Proposal→승인→답변→기억 저장, 클라이언트 카드 위조
차단, 교차 계정 프로필 차단, 기밀·민감도·신선도, Proposal 재사용 차단을 검증합니다.

## 남은 한계

- 실제 Supabase 프로젝트와 Gemini 키를 넣은 라이브 리허설은 별도로 필요합니다.
- 진행 중 Proposal은 서버 메모리에도 보관하므로 서버 재시작 뒤 재개되지 않습니다.
- DB의 Proposal/Snapshot/감사/기억 기록은 영속화되지만 한 트랜잭션으로 묶이지 않았습니다.
- 운영 전 rate limit, CORS/CSRF 정책, secret scan, 브라우저 E2E가 필요합니다.
