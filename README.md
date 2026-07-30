# Context Bridge v20

사용자 프로필에서 현재 질문에 필요한 정보만 서버 내부에서 선별하고, 사용자가 승인한 정보만 최종 생성 모델에 전달하는 React·Express·Supabase 프로젝트입니다.

## v20 보안 흐름

1. 질문 구조화: 원하는 결과, 현재 결정, 조건, 위험 영역, 시간 범위, 접근성·안전을 추출합니다.
2. 후보 검색: 어휘·형태 정규화·최근 맥락·관련 위험 영역을 결합합니다.
3. 무결성 검사: 오래된 정보, 질문과 프로필의 수치 충돌, 같은 제목 카드 간 모순을 표시합니다.
4. 사용자 승인: 일반 정보만 조건부 기본 선택하며 민감정보는 항상 선택 해제입니다.
5. 답변 생성: Proposal Snapshot에서 승인 ID를 재검증하고 승인된 값만 모델에 전달합니다.
6. 생성 후 검증: 거절 정보 누출, 필수 제약 누락, 질문 미응답, 개인정보 반복을 검사해 자동 수정합니다.
7. 기억 제안: 새 정보는 `PENDING` 후보로만 만들고 사용자가 `save`를 선택해야 저장합니다.

`confidential` 카드는 후보·승인·생성에서 차단됩니다. 거절 카드의 값·제목·ID·전체 Vault 크기는 생성 프롬프트와 감사 로그에 남기지 않습니다. 후보 shortlist는 최대 14개입니다.

임베딩 검색은 실제 벡터 저장소가 없는 상태에서 흉내 내지 않았습니다. 현재 의미 우회는 서버 내부의 한국어 형태·동의 표현 정규화로 처리합니다.

## 사용자 화면

- 1단계: “무엇을 도와드릴까요?” → “다음”
- 2단계: “AI가 이 정보를 사용하려고 합니다.” → “확인하고 답변 받기”
- 민감정보: “[사용할게요] [사용하지 않을게요]”
- 쉬운 모드: 음성 질문, 답변 읽어주기, 되돌리기, 단계 표시, 최종 확인
- 관련도·confidence·내부 역할명은 기본 화면에 표시하지 않습니다.

## 확정 API 계약

| 기능 | Method | Path |
|---|---|---|
| 초기 계정·프로필 | GET | `/api/bootstrap` |
| 프로필·카드 CRUD | POST/PATCH/DELETE | `/api/profiles/...` |
| 자연어 카드 구조화 | POST | `/api/context/structure` |
| 맥락 후보 생성 | POST | `/api/proposals` |
| 승인 후 답변 | POST | `/api/proposals/:proposalId/answers` |
| 기억 후보 처리 | POST | `/api/memory-candidates/:candidateId` |

답변 요청 필드는 `approvedContextIds`, `temporaryNote`입니다. 폐기된 `/generate`, `approvedIds`, `tempNote`는 지원하지 않습니다. 공통 타입 정본은 `contracts/types.ts`입니다.

## 실행과 검증

```bash
npm ci
npm run dev
```

```bash
npm run lint
npm test
npm run build
```

v20 실제 결과:

- 자동 테스트 70/70 통과
- TypeScript 검사 통과
- Vite production build 통과
- 150개 카드 shortlist 상한 테스트 통과
- 거절 민감정보가 prompt·audit log·answer에 없는지 관통 테스트 통과
- 결정론 골드 평가 F1 57.1% → 66.7%, 치명적 누락 1 → 0

## 환경변수

`.env.example`을 참고해 `.env.local`을 만듭니다. AI·service-role 비밀키에는 `VITE_` 접두사를 붙이지 마세요. 운영 환경에서는 `CORS_ALLOWED_ORIGINS`를 지정합니다.

## 문서

- `IMPROVEMENT_REPORT_v20.md`: 요구사항 검증, 변경 이유, 실패·재수정, 비교 결과
- `PERFORMANCE_SELECTION_UPGRADE.md`: v20 선별·보안 성능
- `contracts/API_CONTRACT.md`: 프론트–백엔드 계약
- `docs/FRONTEND_HANDOFF.md`: 프론트 전달 사항
