# Context Bridge — 프론트엔드 연동 패키지

종현 선배님께. 이 폴더만 있으면 백엔드 서버 없이도 UI를 끝까지 만들 수 있습니다.

## 뭐가 들어있나

| 파일 | 용도 |
|---|---|
| `types.ts` | 요청·응답 타입 전부. **이 파일을 import 해서 쓰세요.** 백엔드도 같은 파일을 씁니다. |
| `API_CONTRACT.md` | 각 API가 뭘 받고 뭘 주는지 (실제 서버 코드 기준) |
| `error-codes.ts` | 오류 처리 기준(`handleStatus`) |
| `mocks/*.json` | **실제 서버를 돌려서 뽑은** 진짜 응답 샘플. 손으로 쓴 게 아님 |
| `.env.frontend.example` | 프론트 환경변수 템플릿 |
| `mock-server.mjs` | 백엔드 없이 이 mock을 서빙하는 초간단 서버 |

## 지금 바로 시작하는 법

```bash
# 1) mock 서버 띄우기 (백엔드 불필요)
node mock-server.mjs      # http://localhost:4000

# 2) 프론트 .env
VITE_API_BASE_URL=http://localhost:4000
```

이제 프론트에서 `GET /api/bootstrap`, `POST /api/proposals` 등을 부르면 mock JSON이 옵니다. UI 흐름 전체를 이걸로 완성하시면 됩니다.

## 화면 ↔ API 요약

1. 로그인 → `GET /api/bootstrap` → 프로필·카드 받음
2. 질문 → `POST /api/proposals` → 후보 카드(`evaluations`) 받음 → 승인 모달
3. 승인 → `POST /api/proposals/{id}/generate` (승인한 카드 **ID만** 전송) → 답변 + 기억 후보
4. 기억 저장 → `POST /api/memory-candidates/{id}` (`{action:'save'|'ignore'}`)

## 프론트가 지켜야 할 4가지 (보안·계약)

1. **카드 값을 서버로 되보내지 않는다.** 답변 생성 땐 `approvedIds`(ID 배열)만.
2. **`id`/`updatedAt`을 만들지 않는다.** 서버가 생성. 카드 추가는 `CreateContextRequest`만 보냄.
3. **`valueVisible: false` 카드**(기밀)는 값 대신 라벨만, 체크박스 비활성.
4. **오류는 status로 분기**(`error-codes.ts`의 `handleStatus`). message 문자열로 분기 금지.

## 실서버로 바꿀 때

`VITE_API_BASE_URL`만 실제 Controller 주소로 바꾸면 끝. 코드 수정 없음.
(mock과 실서버가 **같은 경로·같은 JSON**이라서 그렇습니다.)

## 아직 안 정해진 것 (같이 정해야 함)

- 데모 모드 토큰을 프론트가 어떻게 얻는지 (`bootstrap` 전 단계)
- 답변 생성 요청 키 최종 이름 (`approvedIds` 유지 vs `approvedContextIds`로 변경)
- 프로필 수정/삭제 API 필요 여부 (UI에 있으면 백엔드가 추가)

`API_CONTRACT.md` 맨 아래와 통합계약서 §12 참고.
