# 프론트 유지형 메모리 백엔드 통합

- 기준 프론트: 업로드된 `context_bridge-main (1)(1).zip`의 `src/` 전체를 그대로 유지
- 적용 백엔드: 하이브리드 기억 추출, CREATE/UPDATE/DROP, Supabase 원자 저장
- 요청 안정화: Gemini 전체 실패 시 오프라인 답변 폴백, 비교 답변 실패 격리, 실제 서버 오류를 401로 오표시하지 않음
- 계약 호환: 최신 프론트의 `conversationHistory` 요청 필드를 유지하고 기억 후보에 `operation`, `updateTargetId`만 확장

Supabase에서는 `supabase/migrations/202607310001_memory_atomic_save.sql`을 적용해야 UPDATE 저장이 동작합니다.
