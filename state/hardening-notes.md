# P0/P1/P2 하드닝 (2026-07-28)

## P0 — 승인 기반 기억 하드코딩 제거
- 결함: extractMemories가 '무릎/오래 걷기' 정규식 한 개만 잡고, 저장 카드도 '이동 접근성'/태그 고정.
  데모 각본 문장을 벗어나면 기억 제안이 아예 안 떴다(당뇨·예산·시간·설명방식·음식 전부 0건).
  api.test.ts가 통과한 건 그 테스트가 정확히 '무릎' 문장을 썼기 때문.
- 수정: src/server/memory.ts 신설 — 카테고리별 규칙 사전(건강/이동/예산/시간/설명/이동수단/음식).
  저장 카드의 제목·태그·등급을 추출 blueprint에서 생성(하드코딩 제거).
  중복 판정을 태그 겹침 → 제목/내용 유사도로 좁힘('이동 수단' vs '이동 접근성' 오검출 해결).
  extractMemories(proposal, extra)로 LLM 추출 결과와 규칙 결과를 라벨 기준 병합.

## P1 — 관련성 선별을 LLM에 위임(안전 경계 유지)
- 결함: relevance()가 순수 키워드 매칭이라 동의어·상위어를 못 잡음. 사용자가 카드 태그 단어를
  질문에 그대로 반복해야 작동 = 격차 해소 제품이 매칭에서 격차를 요구.
- 수정: evaluateContexts(query, contexts, now, overrideScores) — LLM 점수 주입 허용.
  단 정책(confidential 차단)·신선도·비활성 판정은 오버라이드 불가.
  server.ts scoreRelevance(): confidential은 selectableForRelevance가 사전 제거 →
  모델에 기밀 값이 절대 전달되지 않음. 실패 시 규칙 점수로 폴백.

## P2 — 유령 상태 정리
- 프론트가 호출하지 않는 인메모리 /api/audit 제거(감사 로그의 진짜 경로는 bootstrap의 Supabase).
  addAudit/listAudit/auditLogs 배열 제거.
- 모델 폴백 순서 최신→구형으로 교정: gemini-flash-latest(GA 별칭) → 2.5-flash → 2.5-flash-lite.
  (기존 gemini-2.5-lite는 유효 ID 아님)
- 고령 프로필에 confidential 데모 카드('복용 약물: 혈압약') 추가 — '값도 안 읽는다' 시연용.

## 검증 (2026-07-28)
- vitest: 28 passed (기존 13 + hardening 15)
- tsc --noEmit: 통과
- vite build: 통과
- E2E 확인: confidential 값('혈압약')이 API 응답에 유출 안 됨. 당뇨 질문 → 기억 후보 1건.

## 남은 P0 (미검증)
- 실제 Gemini 호출 0회. scoreRelevance/extractMemoriesLLM 라이브 1회씩:
  ①모델 ID 3개 유효성 ②LLM 추출이 규칙보다 나은지 확인 필요.

## 테스트 히트 방지 (2026-07-28, 라이브 키 설정 후 발견)
- 증상: GEMINI_API_KEY 설정 후 api.test.ts 2건이 5초 타임아웃(각 10초 소요).
- 원인: createApp이 모듈 싱글턴 ai로 실 Gemini를 호출. 테스트가 네트워크를 타서 느리고 불안정.
- 수정: generate를 순수 함수로 분리(offlineGenerate/makeLiveGenerate). createApp(deps)로
  generator·live 주입. startServer()는 무주입 → 키 있으면 실 Gemini. 테스트는 offlineGenerate 주입 →
  키 유무와 무관하게 네트워크 미접촉. 회귀 방지 가드 테스트 추가(spy 호출 수 == 2).
- 결과: GEMINI_API_KEY=dummy로도 29 passed, 2초 미만. 실 서버는 라이브 경로 유지.

## 라이브 스모크 (남은 P0) — 이제 실행 가능
서버를 실제로 띄워(키 설정) 두 경로를 각 1회 확인:
- POST /api/proposals: selectionMode가 'llm'으로 오는지(선별이 실제로 LLM 경유).
- 카드 태그에 없는 단어로 질문(예: '쿠버네티스 공부 순서') → 목표 카드가 잡히는지.
- POST .../generate: memoryCandidates가 규칙만으로는 안 나오는 문장에서도 나오는지.
- 응답에 confidential 카드 값('혈압약')이 절대 없는지 재확인.
