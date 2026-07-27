from domain.intent import IntentAnalyzer

def A(): return IntentAnalyzer()

def test_unsupported_question_not_forced_into_intent():
    r = A().analyze("오늘 날씨 어때?")
    assert r.unsupported is True          # REQ-11 / INV-9
    assert r.intent is None

def test_supported_study_plan_with_goal():
    r = A().analyze("이번 방학에 공부 계획 짜줘, 목표는 클라우드 엔지니어")
    assert r.intent == "study_plan"
    assert r.needs_clarification is False

def test_missing_required_slot_triggers_clarification_once():
    r = A().analyze("공부 뭐 하지?", clarification_round=0)
    assert r.intent == "study_plan"
    assert r.needs_clarification is True   # goal 없음 → 추가 질문 1회

def test_still_missing_after_one_round_becomes_unsupported():
    r = A().analyze("공부 뭐 하지?", clarification_round=1)
    assert r.unsupported is True           # 최대 1회 후 unsupported (재질문 루프 금지)
