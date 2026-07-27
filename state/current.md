# 현재 상태 (state/current.md)

## 하네스: v4 채택
규칙 원천 = 업로드된 v4 (plan/AGENTS/checklist + context-policy.yaml + JSON 스키마 + validator).
구현 방법론 = superpowers TDD (RED→GREEN, verification-before-completion).
→ 둘은 경쟁이 아니라 규칙(WHAT) 층 + 방법(HOW) 층으로 결합.

## 완료 (Phase 0 → Phase 3 walking skeleton)
- state_machine / policy / composer / approval / models / SQLite repository (Phase 0~1)
- intent.py — 규칙 기반 의도 분석, 지원 밖 unsupported, clarification 최대 1회 후 unsupported (REQ-11)
- ranker.py — 허용 후보 내 순위화, Pydantic 검증, 잘못된 출력 재시도 1회 후 안전 실패,
  후보 밖 id 거부(REQ-2), 재시도가 후보 집합 확장 안 함, uncertain 자동체크 안 함
- ports.py(RankerGateway/GeneratorGateway 추상), llm/fakes.py(Ranker+Generator Fake들) — CI 오프라인용
- generation.py — 응답 생성 서비스. APPROVED→GENERATING→ANSWERED 전이, 생성 전 무결성 검문(해시 불일치→IntegrityError), 실패 시 FAILED 안전 전이, 승인 전 생성 차단(INV-6)
- scripts/validate_context_policy.py — G0 정책 스키마+교차참조 검증
- application/service.py — UI 유일 진입점(ask/approve_and_generate/recover/history/reason_text), UI는 DB/LLM 미접근(G2)
- application/bootstrap.py — 조립 루트(구체 저장소·Fake 게이트 조립, seed 로드)
- app.py — Streamlit 3화면 뷰(메인/프로필/사용기록), 승인 스냅샷 해시==생성 입력 해시 배지
- repository.list_interactions/save_answer, seed_profile.json, README, requirements.txt

## 검증 (실제 통과)
- pytest tests/ → 44 passed
- validate_context_policy.py → PASSED v2
- Phase 2 오프라인 관통 + 생성 결합: 질문→의도→정책→랭커(fake)→승인→스냅샷→생성(fake)→ANSWERED,
  스냅샷 해시 == 생성 입력 컨텍스트 해시, 미승인/restricted 값은 생성 프롬프트에도 부재

## 아직 안 함 (정직 보고)
- LLM 실제 어댑터(라이브 API) — 현재는 Ranker/Generator 모두 Fake만. 실제 Gemini/OpenAI 어댑터 미구현
- Streamlit UI 3화면 (Phase 3), 새로고침 상태 복구
- 사용 기록 마스킹/삭제, 신규 후보 저장 승인 UI (Phase 3)
- import-linter(G2)·detect_secret(G6)·골드셋(G7)·CI 파이프라인 미구성
- 응답 방식(response_style) 승인 경유 적용(REQ-13) 코드 미반영

## 안 된 것 / 주의 (정직 보고)
- **Streamlit 앱은 이 환경에서 런타임 실행 검증 못 함.** py_compile 문법 검사와
  ApplicationService 44개 테스트(새로고침 DB 복구 포함)로만 확인. 브라우저 렌더링·상호작용 미검증.
- 실제 LLM 어댑터 미구현(Ranker/Generator Fake). response_style 승인 경유(REQ-13) 코드 미반영.
- import-linter(G2)·detect_secret(G6)·CI·골드셋(G7) 미구성. 프로필 편집/삭제 미구현.


## 저장소 아키텍처 결정 (ADR-0001)
- 기본 = SQLite + Repository 포트(domain/ports.py). Supabase/Postgres는 P2 어댑터로 예약.
- InMemoryRepository 추가 + 계약 테스트(test_repository_contract.py)로 어댑터 교체 가능성 증명(SQLite/InMemory 동일 계약 통과).
- PostgresRepository 참조 어댑터 제공(라이브 DB 필요, 이 환경 미검증).
- pytest tests/ → 54 passed.


## '나의 카드' CRUD (앞면 P0) — 구현 완료
- ProfileItem에 version 추가. 저장소(SQLite/InMemory)에 개별 CRUD: add/get/update(value+version)/set_enabled/delete.
- ApplicationService: add_card(정책 등급 강제 REQ-18·빈값/중복 검증 REQ-14)·edit_card(version↑ REQ-15)·toggle_card·delete_card·categories.
- app.py '나의 카드' 화면: 라벨 변경 + 추가/수정/on-off/삭제 연결(등록만 되던 읽기전용 → CRUD). Streamlit 런타임은 여전히 미검증(py_compile만).
- 문서: plan/checklist P0에 앞면(등록·수정·on/off·삭제)/뒷면(version·스냅샷 불변·공격테스트) 구분 반영, pitch.md 동기화.
- pytest 61 passed(+7 CRUD), validator PASS. REQ-15 격리(수정해도 과거 스냅샷 불변)·REQ-18(등급 강제) 테스트 통과.


## 승인 경계 수정 (ID-only 서버 재검증) — 완료
- 결함: 클라이언트가 보낸 값/질문을 서버가 신뢰(문서 주장과 불일치, P0 보안).
- 수정: ask()가 서버 제안 후보 저장 → approve_and_generate(interaction_id, approved_ids)로 ID만 수신,
  서버가 제안 후보 검증 + 저장 값/질문으로 스냅샷 재구성. (repository/InMemory에 save/load_proposal 추가)
- tests/test_approval_boundary.py 5개 통과. 전체 66 passed.


## 실제 LLM 어댑터 + 서사 재정의 — 완료
- llm/live_adapters.py: LiveCardSelector(Haiku)/LiveAnswerGenerator(Sonnet). 포트를 후보 내용 전달로 변경(ranker/fakes 갱신).
  주입 transport로 파싱·통합 단위검증(test_live_adapters 5개). 라이브 호출은 미검증(키 필요). bootstrap CB_LLM 스위치.
- pitch.md 재정의: '질문 격차 해소' 중심, '나의 상황 카드', 새 데모(같은 질문 다른 답변 + 7→5→4→3), 제품 지표.
- pytest 71 passed.


## 일반 vs 개인화 비교 모드 (데모 핵심) — 완료
- service.approve_and_compare(interaction_id, approved_ids): 개인화(승인 스냅샷)+일반(카드 0개 baseline) 동시 생성.
  승인 경계는 approve_and_generate 재사용으로 ID-only 유지. R-06대로 기본 경로 아닌 데모 모드.
- app.py: '일반 답변과 비교(데모)' 토글 + 2단 표시("같은 질문, 다른 답변"). 화면 SHA-256 캡션 제거(서사대로 해시 숨김).
- test_comparison.py 3개 포함 전체 74 passed. (Streamlit 런타임은 여전히 미검증)


## 정보 흐름 시각화 (7→5→4→3, 해시 대신) — 완료
- service.ask가 실제 파이프라인 카운트 반환(total_cards→policy_allowed→question_related). 하드코딩 아님.
- app.py: 답변 아래 5단 metric(전체→정책허용→질문관련→내가승인→AI전달) + "승인 수=AI 전달 수" 캡션.
- test_funnel.py 포함 전체 75 passed. Streamlit 런타임 미검증.

## 다음 한 가지 우선순위
### 진행 중: 프로필 우선 진입 및 빈 프로필 온보딩
- 목표: 앱 첫 화면을 `나의 카드`로 바꾸고, 프로필이 없으면 질문 전에 카드 등록 화면으로 유도한다.
- 연결 요구사항: REQ-14(Profile Builder), REQ-16(활성 프로필 관리)
- 단계/우선순위: Phase 1B / P0
- 수정 예정 파일: `app.py`, `src/application/navigation.py`, `tests/test_navigation.py`, `README.md`, `state/current.md`
- 정상 경로 검증: 카드가 있으면 사용자가 선택한 화면을 유지하고, 초기 메뉴의 첫 항목은 `나의 카드`.
- 실패 경로 검증: 카드가 없는데 질문/기록 화면을 요청하면 `나의 카드`로 안전하게 되돌린다.
- 롤백: 위 파일의 프로필 우선 내비게이션 변경만 되돌린다. DB·정책·스키마 변경은 없다.
- 구현:
  - 사이드바 순서를 `나의 카드 → Context Bridge 메인 → 사용 기록`으로 변경.
  - 빈 프로필에서 질문/기록 화면을 요청하면 `나의 카드`로 되돌리는 순수 내비게이션 규칙 추가.
  - 빈 프로필 안내 문구와 README 실행 설명 추가.
- 검증:
  - 전체 테스트 `79 passed`.
  - 정책 검증 `POLICY VALIDATION PASSED: context-bridge-mvp v2`.
  - `app.py`, `navigation.py` 문법 컴파일 통과.
- 상태: PERSIST 완료

## 진행 중: 다중 상황 프로필 선택·관리
- 목표: 여러 상황 프로필 중 하나를 선택하고, 선택한 프로필의 카드만 수정·질문에 사용한다.
- 연결 요구사항: REQ-14~16(Profile Builder/Manager), REQ-19(다중 프로필 격리·선택)
- 단계/우선순위: Phase 1B / P0 제품 핵심
- 사용자 승인: 다중 프로필 DB 스키마와 선택·수정 UI 구현을 명시적으로 요청받음.
- 수정 예정 파일: `plan.md`, `checklist.md`, `README.md`, `app.py`, `src/domain/models.py`,
  `src/domain/ports.py`, `src/application/service.py`, `src/application/bootstrap.py`,
  `src/infrastructure/repository.py`, `src/infrastructure/memory_repository.py`,
  `tests/test_multi_profile.py`, `tests/test_repository_contract.py`,
  `tests/test_repository_migration.py`, `state/current.md`, `state/failures.md`
- 정상 경로 검증: 프로필 생성→선택→이름 수정→카드 CRUD→선택 프로필만 질문 후보화.
- 실패 경로 검증: 프로필 간 카드 접근·중복 혼합 차단, 마지막 프로필 삭제 차단,
  질문 후 활성 프로필 변경에도 저장된 제안이 불변.
- 마이그레이션 검증: 구버전 SQLite의 기존 카드를 삭제 없이 `기본 프로필`에 귀속.
- 롤백: 변경 전 DB 파일을 보존하며, 신규 ZIP에는 런타임 DB를 포함하지 않는다.
- 구현:
  - `UserProfile` 및 SQLite/InMemory 다중 프로필 저장소 계약 추가.
  - 첫 화면 프로필 선택·생성·이름/설명 수정·확인 삭제 UI 추가.
  - 카드 CRUD와 질문 후보를 선택 프로필 ID로 격리.
  - 질문 시 profile_id와 서버 후보를 고정해 이후 프로필 변경 영향 차단.
  - 구버전 DB를 `기본 프로필`로 자동 이전하고 이전 전
    `.pre-multiprofile.bak` 백업 생성.
  - 마지막 프로필 삭제와 타 프로필 경유 카드 수정을 차단.
- 검증:
  - 전체 테스트 `103 passed`.
  - 다중 프로필 CRUD·사용자/카드 격리·질문 후보 격리·승인 스냅샷 불변 통과.
  - 구버전 SQLite 데이터 보존 및 백업 생성 테스트 통과.
  - 정책 검증 `POLICY VALIDATION PASSED: context-bridge-mvp v2`.
  - Streamlit AppTest 첫 화면·프로필 선택 렌더링 스모크 통과.
  - 실제 Gemini/Groq 라이브 호출은 키가 없는 환경이라 미실행.
- 상태: PERSIST 완료

## 다음 한 가지 우선순위
프로필 우선 진입 변경 검증 후 CB_LLM=anthropic 라이브 스모크.

## 진행 중: Streamlit SQLite 교차 스레드 오류 수정
- 목표: Streamlit rerun 스레드가 바뀌어도 캐시된 ApplicationService의 SQLite 연결을 안전하게 사용한다.
- 연결 요구사항: REQ-7(DB 기준 상태 복구), REQ-14(프로필 DB 복구)
- 단계/우선순위: Phase 3 / P0 런타임 결함
- 수정 예정 파일: `src/infrastructure/repository.py`, `tests/test_repository_threading.py`, `state/current.md`
- 정상 경로 검증: 연결을 만든 스레드와 다른 스레드에서 프로필을 읽고 쓸 수 있다.
- 실패 경로 검증: 다중 스레드 접근 중 SQLite ProgrammingError 또는 트랜잭션 충돌이 발생하지 않는다.
- 롤백: 저장소의 `check_same_thread=False` 및 직렬화 잠금 변경만 되돌린다. DB 스키마 변경은 없다.
- 구현:
  - SQLite 연결에 `check_same_thread=False` 적용.
  - 단일 연결의 모든 공개 DB 작업을 `RLock`으로 직렬화.
  - Streamlit rerun 형태의 교차 스레드 읽기와 동시 쓰기 회귀 테스트 추가.
- 검증:
  - 전체 테스트 `81 passed`.
  - 정책 검증 `POLICY VALIDATION PASSED: context-bridge-mvp v2`.
  - `app.py`, `repository.py` 문법 컴파일 통과.
- 상태: PERSIST 완료

## 진행 중: Gemini 기본 + Groq 폴백 LLM 전환
- 목표: Anthropic 어댑터를 제거하고 Gemini를 기본 라이브 모델, Groq를 장애·한도 초과 폴백으로 사용한다.
- 연결 요구사항: REQ-2(후보 밖 ID 거부), REQ-3(승인 스냅샷만 생성 입력), INV-7(키 환경변수)
- 단계/우선순위: Phase 2 / P0 데모 런타임
- 사용자 승인: Gemini/Groq 외부 API 및 SDK 도입을 명시적으로 요청받음.
- 수정 예정 파일: `src/llm/live_adapters.py`, `src/application/bootstrap.py`, `tests/test_live_adapters.py`, `tests/test_bootstrap.py`, `requirements.txt`, `README.md`, `state/current.md`
- 정상 경로 검증: Gemini 성공 시 Groq 미호출, Gemini 실패 시 Groq 결과 반환, `CB_LLM=groq` 단독 모드 조립.
- 실패 경로 검증: 두 키가 없거나 두 provider가 실패하면 명시적 예외로 안전 실패.
- 롤백: 위 LLM 어댑터·조립·의존성 변경만 되돌린다. 정책·DB 스키마 변경은 없다.
- 구현:
  - Anthropic 어댑터·의존성 제거.
  - `GeminiComplete`, `GroqComplete`, `FallbackComplete` 추가.
  - `CB_LLM=gemini|live|auto`: Gemini 우선, 실패 시 Groq 1회 폴백.
  - `CB_LLM=groq`: Groq 단독, `CB_LLM=fake`: 오프라인 테스트/데모.
  - 키는 `GEMINI_API_KEY`, `GROQ_API_KEY` 환경변수에서만 읽음.
  - 모델은 `GEMINI_MODEL`, `GROQ_MODEL`로 선택 가능.
- 검증:
  - 전체 테스트 `89 passed`.
  - Gemini 성공 시 Groq 미호출, Gemini 실패 시 Groq 호출, Groq 단독 및 알 수 없는 모드 거부 테스트 통과.
  - 정책 검증 `POLICY VALIDATION PASSED: context-bridge-mvp v2`.
  - 관련 Python 파일 문법 컴파일 통과.
  - 실제 외부 API 호출은 키가 없는 검증 환경이므로 미실행.
- 상태: PERSIST 완료

## 진행 중: Streamlit 비교 모드 상태 키 충돌 수정
- 목표: 비교 체크박스와 비교 결과가 서로 다른 Session State 키를 사용하게 한다.
- 연결 요구사항: R-06(비교는 데모 모드), Phase 3 비교 화면
- 단계/우선순위: Phase 3 / P0 런타임 결함
- 수정 예정 파일: `app.py`, `src/application/ui_state.py`, `tests/test_ui_state.py`, `state/current.md`, `state/failures.md`
- 정상 경로 검증: 비교 체크 후 일반/개인화 결과 객체가 별도 키에 저장되고 표시된다.
- 실패 경로 검증: 위젯 키와 결과 저장 키가 동일해지는 회귀를 단위 테스트로 차단한다.
- 롤백: 비교 모드 키 이름 변경만 되돌린다. 서비스·DB·정책 변경은 없다.
- 구현:
  - 체크박스 키를 `compare_enabled`로 변경.
  - 비교 결과를 `comparison_result`, 단일 답변을 `answer_result`에 저장.
  - 새 질문 시작 시 이전 결과 상태를 정리.
- 검증:
  - 전체 테스트 `90 passed`.
  - 키 고유성 회귀 테스트 통과.
  - 기존 충돌 키 `cmp` 사용 0건 확인.
  - 정책 검증 및 Python 문법 컴파일 통과.
- 상태: PERSIST 완료
