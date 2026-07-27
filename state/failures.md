
## F-APPROVAL-TRUST (수정 완료)
- 증상: approve_and_generate가 클라이언트가 보낸 id·category·value·question을 그대로 신뢰해 스냅샷 생성.
  해시는 "넘어온 값이 이후 바뀌지 않았는지"만 검증할 뿐, "그 값이 서버가 제안한 후보인가"는 미검증.
  → 문서 주장("ID-only 승인, 서버 후보 재구성")과 코드 불일치. P0 보안 결함.
- 원인: 승인 API가 값까지 클라이언트에서 수신. 서버가 제안 후보를 저장하지 않음.
- 수정: ask()가 서버 제안 후보(context_proposal)를 저장. approve_and_generate(interaction_id, approved_ids)로
  변경 — 클라이언트는 ID만 전달, 서버가 제안 후보에 있었는지 검증하고 저장된 category/value와
  저장된 질문으로 재구성해 스냅샷 생성.
- 재발 방지: tests/test_approval_boundary.py — 제안 안 된 ID 거부, 스냅샷이 서버 값 사용, 질문 서버 조회.

## F-STREAMLIT-CMP-KEY (수정 완료)
- 증상: 비교 체크박스를 만든 뒤 `st.session_state["cmp"]`에 비교 결과를 저장하면서
  `StreamlitAPIException` 발생.
- 원인: 위젯 키와 계산 결과 키가 모두 `cmp`로 같아 Streamlit의 위젯 상태 소유권 규칙 위반.
- 수정: 위젯 `compare_enabled`, 결과 `comparison_result`, 단일 답변 `answer_result`로 분리.
- 재발 방지: `tests/test_ui_state.py`에서 위젯·결과 키의 고유성 검사.
