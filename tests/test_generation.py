import pytest
from domain.generation import GenerationService, GenerationSafeFail, IntegrityError
from domain.state_machine import StateMachine, IllegalTransition
from domain.approval import build_snapshot, ApprovalSnapshot
from llm.fakes import FakeGenerator, TimeoutGenerator, SpyGenerator

Q = "이번 방학에 뭘 공부할까?"
def snap():
    return build_snapshot("i1", [
        {"id":"p1","category":"education.major","label":"전공","value":"AISW"},
        {"id":"p2","category":"career.goal","label":"진로 목표","value":"클라우드 엔지니어"},
    ])

def test_happy_path_approved_to_answered():
    sm = StateMachine("APPROVED")
    res = GenerationService(FakeGenerator()).run(Q, snap(), sm)
    assert sm.state == "ANSWERED"
    assert res.answer                      # 비어있지 않음
    assert res.input_context_hash == snap().snapshot_hash  # 스냅샷 == 생성 입력 컨텍스트

def test_cannot_generate_from_non_approved_state():
    sm = StateMachine("CONTEXT_PROPOSED")   # APPROVED 아님
    with pytest.raises(IllegalTransition):  # INV-6: 승인 전 생성 금지
        GenerationService(FakeGenerator()).run(Q, snap(), sm)

def test_timeout_moves_to_failed_and_safe_fails():
    sm = StateMachine("APPROVED")
    with pytest.raises(GenerationSafeFail):
        GenerationService(TimeoutGenerator()).run(Q, snap(), sm)
    assert sm.state == "FAILED"             # 안전 상태로 전이, 답변 없음

def test_tampered_snapshot_hash_raises_integrity_error():
    bad = ApprovalSnapshot("i1", snap().items, "deadbeef")  # 해시 위조
    sm = StateMachine("APPROVED")
    with pytest.raises(IntegrityError):     # 생성 전 무결성 검문 (REQ-3)
        GenerationService(FakeGenerator()).run(Q, bad, sm)

def test_generator_only_sees_snapshot_context():
    sm = StateMachine("APPROVED")
    spy = SpyGenerator()
    GenerationService(spy).run(Q, snap(), sm)
    assert "AISW" in spy.last_prompt
    assert "하루 2시간" not in spy.last_prompt   # 스냅샷에 없는 값은 프롬프트에도 없음 (REQ-1)
