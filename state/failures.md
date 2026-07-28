# 실패와 수정 기록

## F-PREAPPROVAL-LEAK

기존 `/api/analyze-context`가 활성 카드의 실제 값을 모두 Gemini에 보낸 뒤 승인
모달을 열었다. 승인 UI는 있었지만 외부 전송은 이미 끝난 상태였다.

수정: 후보화는 서버 로컬 규칙으로 수행하고 외부 AI를 호출하지 않는다.

## F-CLIENT-CONTEXT-TRUST

기존 생성 API가 클라이언트의 질문과 `approvedContexts` 전체를 신뢰했다.

수정: Proposal에 질문과 카드 원본을 고정하고 생성 API는 승인 ID만 받는다.

## F-PRIVACY-DOWNGRADE

사용자가 건강·접근성 카드도 normal로 낮출 수 있었다.

수정: 서버가 내용·태그를 검사해 해당 범주를 최소 sensitive로 강제한다.

## F-PRESET-MIXING

Preset을 불러오면 별도 상황이 아니라 기존 Vault에 모든 카드가 섞였다.

수정: 각 Preset을 독립 상황 프로필로 생성하고 상단에서 전환한다.

## F-CONDITIONAL-HOOK

Preview 컴포넌트가 닫힌 상태에서 Hook 호출 전에 반환해 다시 열 때 React Hook
순서가 달라질 수 있었다.

수정: 모든 Hook을 항상 호출한 뒤 닫힌 상태를 반환한다.

## F-LOCALSTORAGE-IDENTITY

브라우저 localStorage 프로필은 실제 로그인 계정의 소유권이나 서버 격리를 증명하지
못했다.

수정: Supabase Auth 토큰을 서버에서 검증하고 프로필·카드·감사 기록을 계정별 DB
행으로 옮겼다. 환경값이 없을 때의 로컬 모드는 명시적인 리허설 폴백으로만 남겼다.

## F-CLIENT-SELECTION-SOURCE

질문 분석 API가 클라이언트가 보낸 카드 목록을 후보화 입력으로 사용하면 다른 계정
값이나 위조 값을 섞을 수 있었다.

수정: 분석 API는 질문과 profile ID만 받고 서버가 인증 계정의 DB 카드를 다시 읽는다.

## F-CROSS-OWNER-REFERENCE

`user_id` RLS만으로는 자기 소유 행에서 타 계정 profile UUID를 참조하는 교차 소유자
외래키를 구조적으로 막지 못한다.

수정: 프로필과 Proposal에 `(id, user_id)` 유일키를 두고 관련 테이블이 같은
`user_id`를 포함한 복합 외래키로 참조하도록 했다.
