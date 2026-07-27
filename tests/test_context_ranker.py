import pytest
from domain.ranker import ContextRanker, RankerSafeFail
from domain.models import Candidate
from llm.fakes import FakeRanker, TimeoutRanker, BadOutputRanker, SpyRanker

def cands():
    return [
        Candidate("p1","education.major","AISW","normal","MAJOR_CONTEXT",True),
        Candidate("p2","career.goal","클라우드","normal","LEARNING_GOAL",True),
        Candidate("p3","skills.current","Python 기초","normal","LEARNING_LEVEL",True),
    ]

def ids(c): return {x.item_id for x in c}

def test_keeps_relevant_drops_irrelevant():
    gw = FakeRanker({"p1":"relevant","p2":"relevant","p3":"irrelevant"})
    out = ContextRanker(gw).rank("q", cands())
    assert ids(out) == {"p1","p2"}

def test_uncertain_is_optional_not_auto_checked():
    gw = FakeRanker({"p1":"relevant","p2":"uncertain","p3":"irrelevant"})
    out = ContextRanker(gw).rank("q", cands())
    p2 = [c for c in out if c.item_id=="p2"][0]
    assert p2.default_checked is False       # uncertain 자동 체크 안 함

def test_llm_id_outside_candidate_set_rejected():
    gw = FakeRanker({"p1":"relevant","p9":"relevant"})  # p9 후보 밖
    out = ContextRanker(gw).rank("q", cands())
    assert "p9" not in ids(out)              # REQ-2

def test_bad_output_retries_once_then_safe_fail():
    gw = BadOutputRanker()                   # 항상 잘못된 라벨
    with pytest.raises(RankerSafeFail):
        ContextRanker(gw).rank("q", cands())
    assert gw.calls == 2                     # 재시도 1회 후 안전 실패

def test_timeout_is_safe_fail():
    with pytest.raises(RankerSafeFail):
        ContextRanker(TimeoutRanker()).rank("q", cands())

def test_retry_does_not_expand_candidate_set():
    spy = SpyRanker()                        # 첫 호출 잘못 → 재시도 유발
    try:
        ContextRanker(spy).rank("q", cands())
    except RankerSafeFail:
        pass
    assert all(s == {"p1","p2","p3"} for s in spy.seen_id_sets)  # 후보 확장 금지
