# Vercel 배포 구조 가이드

## 핵심 개념: 왜 구조를 바꿔야 하나

v12의 `server.ts`는 **계속 켜져 있는 Express 서버**를 가정한다:
- 프로세스가 하나라 인메모리 `store`가 요청 사이에 유지됨
- `app.listen()`으로 포트를 연다

Vercel은 다르다. **요청마다 함수가 켜졌다 꺼진다(서버리스).**
- `app.listen()` 안 함 — Vercel이 요청을 함수로 넘김
- 요청 A(`POST /api/proposals`)와 요청 B(`POST /api/proposals/:id/answers`)가
  **다른 함수 인스턴스**로 갈 수 있음 → 인메모리 proposal이 B에서 사라짐

그래서 **두 가지가 전제 조건**이다:
1. `SupabaseProposalStore` 사용 (인메모리 아님) — 그래야 A/B가 DB를 공유
2. API를 서버리스 함수로 감싸기 (이 폴더의 `api/index.ts`)

## 파일 구조

```
backend/
├─ api/
│  └─ index.ts          ← Vercel 서버리스 진입점 (createApp을 export)
├─ vercel.json          ← 라우팅: /api/* → 함수, 나머지 → SPA
├─ server.ts            ← createApp()은 그대로. startServer()만 로컬 전용
├─ dist/               ← vite build 결과 (Vercel이 정적 서빙)
└─ ...
```

## server.ts에 필요한 변경 (최소)

`createApp()`은 **그대로 쓴다**. 단, 내부에서 store를 환경변수로 선택해야 한다:

```ts
// server.ts의 createApp 안
import { ProposalStore } from './src/server/core.js';           // 인메모리
import { SupabaseProposalStore } from './src/server/supabaseProposalStore.js';

const store: IProposalStore = supabaseConfigured
  ? new SupabaseProposalStore(/* 요청 토큰이 실린 client */)
  : new ProposalStore();   // 데모/테스트는 인메모리 유지
```

⚠️ 주의: Supabase 클라이언트는 **요청마다** 그 사용자의 토큰으로 만들어야 RLS가 걸린다.
따라서 store를 앱 생성 시점이 아니라 **요청 핸들러 안에서** 만들거나,
`authenticate()`가 반환하는 사용자별 client를 store에 주입해야 한다.
(기존 `dataGateway.ts`의 `userClient(token)` 패턴 재사용)

`startServer()`의 `app.listen()`은 로컬 전용이라 Vercel에선 실행되지 않는다
(`import.meta.url === ...` 가드가 이미 있어 안전).

## 환경변수 (Vercel 프로젝트 설정)

Vercel Dashboard → Project → Settings → Environment Variables.
**Preview와 Production을 분리**해서 넣는다.

### 서버 전용 (절대 VITE_ 접두사 금지)
```
GEMINI_API_KEY            = ...        (서버만)
SUPABASE_URL              = https://xxx.supabase.co
SUPABASE_ANON_KEY         = eyJ...      (anon으로 충분. RLS가 격리)
```

### 클라이언트 공개 (빌드 시 번들에 박힘)
```
VITE_SUPABASE_URL         = https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY    = eyJ...      (anon만. service_role 절대 금지)
```

> `SUPABASE_SERVICE_ROLE_KEY`는 **넣지 마라.** 이 앱은 사용자 토큰 + RLS로
> 모든 격리를 하므로 service_role이 필요 없다. 넣으면 RLS를 우회하는
> 강력한 키가 서버에 상주해 사고 위험만 커진다.

## 배포 순서 (안전)

1. Supabase 스키마 적용 (마이그레이션 2개: 기존 + `202607290001_proposal_store_db.sql`)
2. Vercel에 **Preview 배포** (main 아님):
   ```
   vercel            # Preview URL 생성
   ```
   또는 backend 브랜치를 Vercel에 연결하면 push마다 Preview 자동 생성.
3. Preview URL에서 E2E 수동 확인:
   - 로그인 → 질문 → 승인 → 답변 → 기억 저장
   - **새로고침/재요청 후에도 proposal이 살아있는지** (인메모리였으면 여기서 터짐)
   - 답변 버튼 연타 → 한 번만 생성되는지 (낙관적 잠금 확인)
4. 다른 사용자 토큰으로 남의 프로필 접근 → 404/403 확인 (RLS)
5. 문제 없으면 그때 Production(`main`) 승격

## Preview vs Production

- **Preview**: backend 브랜치 push → 자동. 테스트용 Supabase 프로젝트 권장.
- **Production**: main 병합 → 수동 승격. 발표용 Supabase 프로젝트.
- 환경변수를 Preview/Production 각각 넣으면 서로 다른 DB를 가리키게 할 수 있다.

## 흔한 함정

- **`app.listen`이 Vercel에서 에러**: 이미 `import.meta.url` 가드로 막혀 있음. 확인만.
- **`dist`가 없음**: `buildCommand: vite build`가 vercel.json에 있어야 함.
- **API 404**: rewrites 순서 중요. `/api/(.*)`가 SPA fallback보다 **위**에 있어야 함.
- **CORS**: 같은 도메인에 배포하면 CORS 불필요. 프론트를 다른 도메인에 두면
  `createApp`의 `cors()`를 허용 origin 목록으로 좁혀야 함.
- **함수 콜드스타트 타임아웃**: `maxDuration: 30` 설정됨. Gemini가 느리면 조정.
