import pytest
from domain.state_machine import StateMachine, IllegalTransition

def test_forbidden_question_received_to_generating():
    sm = StateMachine("QUESTION_RECEIVED")
    assert sm.can("GENERATING") is False
    with pytest.raises(IllegalTransition):
        sm.to("GENERATING")

def test_forbidden_context_proposed_to_generating():
    sm = StateMachine("CONTEXT_PROPOSED")
    with pytest.raises(IllegalTransition):
        sm.to("GENERATING")

def test_allowed_question_received_to_context_proposed():
    sm = StateMachine("QUESTION_RECEIVED")
    assert sm.to("CONTEXT_PROPOSED") == "CONTEXT_PROPOSED"

def test_allowed_approved_to_generating():
    sm = StateMachine("APPROVED")
    assert sm.to("GENERATING") == "GENERATING"

def test_happy_path_full_flow():
    sm = StateMachine("QUESTION_RECEIVED")
    for nxt in ["CONTEXT_PROPOSED","AWAITING_APPROVAL","APPROVED","GENERATING","ANSWERED","MEMORY_REVIEW","COMPLETED"]:
        sm.to(nxt)
    assert sm.state == "COMPLETED"
