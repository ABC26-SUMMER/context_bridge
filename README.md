# Context Bridge (MVP walking skeleton)

승인한 정보만으로 개인화 답변을 만드는 사용자 통제형 AI. 규칙(정책)이 먼저 후보를 제한하고, LLM은 후보 안에서만 판단하며, 승인 스냅샷만 답변 생성에 들어간다.

## 실행
```bash
pip install -r requirements.txt
streamlit run app.py          # 3화면: 메인 / 프로필 관리 / 사용 기록
```
첫 실행 시 `data/seed_profile.json`이 로컬 SQLite에 적재된다.
앱은 **나의 카드** 화면에서 시작한다. 먼저 `취업 준비`, `학교 공부`,
`일상·외출` 같은 상황 프로필을 여러 개 만들고 하나를 선택한 뒤, 선택한
프로필 안에서 카드를 등록·수정한다. 카드가 없는 프로필은 질문 화면 대신
카드 등록 화면으로 안내된다.

질문에는 현재 선택한 프로필의 카드만 후보로 들어간다. 질문별
`Context Preview`에서 다시 사용할 카드를 최종 승인하므로
`프로필 선택`과 `질문별 승인`은 별도 단계다.

기존 단일 프로필 SQLite DB는 첫 실행 시 카드가 `기본 프로필`로 자동
이전된다. 이전 전 DB는 같은 위치의
`context_bridge.db.pre-multiprofile.bak`에 한 번 백업된다.
현재 기본은 **Fake**(오프라인)라서 키 없이도 실행된다. 실제 LLM은
**Gemini 기본 + Groq 폴백**으로 켠다:
```bash
export CB_LLM=gemini
export GEMINI_API_KEY=...
export GROQ_API_KEY=...
streamlit run app.py
```
Gemini가 장애·한도 초과 등으로 실패하면 같은 요청을 Groq로 한 번
재시도한다. Groq만 쓰려면 `CB_LLM=groq`로 설정한다.

Windows PowerShell:
```powershell
$env:CB_LLM="gemini"
$env:GEMINI_API_KEY="본인의 Gemini 키"
$env:GROQ_API_KEY="본인의 Groq 키"
streamlit run app.py
```

기본 모델은 Gemini `gemini-3.6-flash`, Groq
`llama-3.3-70b-versatile`이다. 필요하면 `GEMINI_MODEL`,
`GROQ_MODEL` 환경변수로 바꿀 수 있다. 키는 코드나 `.env`에 커밋하지
않는다. 라이브 호출은 CI에서 실행하지 않으며 로컬 키로 별도 확인한다.

## 검증
```bash
python -m pytest tests/ -q                                   # 도메인·응용 테스트
python scripts/validate_context_policy.py specs/context-policy.yaml specs/context-policy.schema.json  # G0 정책
```

## 구조
- `src/domain` — 순수 도메인(상태머신·정책·랭커·스냅샷·생성). 외부 SDK 미의존.
- `src/application` — UI 진입점(ApplicationService)과 조립 루트(bootstrap).
- `src/infrastructure` — SQLite 저장소.
- `src/llm` — 게이트웨이 포트의 Fake 구현.
- `app.py` — Streamlit 뷰. ApplicationService만 호출.
