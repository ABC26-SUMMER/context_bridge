# 최종 체크리스트 v10

## 계정·DB

- [x] Supabase 이메일 로그인
- [x] 전이현/김영자 데모 seed
- [x] 계정별 프로필·카드 CRUD
- [x] 모든 테이블 RLS 활성화
- [x] `auth.uid() = user_id` 소유자 정책
- [x] 프로필/Proposal 복합 FK로 교차 소유자 참조 차단
- [x] service role key 브라우저 비노출

## 질문·승인

- [x] 서버가 로그인 계정의 카드를 DB에서 직접 조회
- [x] 후보화 단계 외부 AI 호출 없음
- [x] 선택·제외 이유 UI 표시
- [x] 생성 API는 Proposal ID와 승인 ID만 사용
- [x] 타 사용자·Proposal 밖 ID·재승인 차단
- [x] confidential 비노출·승인 불가
- [x] sensitive·stale 기본 해제
- [x] 승인 Snapshot·감사 기록 DB 저장

## 기억·신선도

- [x] 답변 뒤 PENDING 기억 후보
- [x] 저장/무시 단회 승인
- [x] 저장 결과 계정 DB 반영
- [x] `updated_at` 및 90일 확인 배지

## 검증

- [x] `npm run lint`
- [x] 13개 회귀/API 테스트
- [x] 교차 계정 프로필 접근 차단 테스트
- [x] `npm run build`
- [ ] 실제 Supabase migration/seed 리허설
- [ ] 실제 Gemini 호출과 비교 답변 녹화
- [ ] Playwright 브라우저 E2E
- [ ] 팀원 2~3명 사용성 테스트

## 운영 전

- [ ] Proposal 재시작 복구
- [ ] DB 다중 기록 트랜잭션화
- [ ] rate limit·운영 CORS/CSRF
- [ ] secret scan·CI
