import pytest, pathlib
from domain.policy import PolicyEngine, UnsupportedIntent
from _fixtures import demo_profile

POLICY = str(pathlib.Path(__file__).resolve().parents[1] / "specs" / "context-policy.yaml")

def cats(cands): return {c.category for c in cands}

def test_restricted_never_auto_candidate():
    pe = PolicyEngine.from_yaml(POLICY)
    c = pe.propose("study_plan", demo_profile())
    assert "health.condition" not in cats(c)   # INV-4

def test_out_of_category_removed():
    pe = PolicyEngine.from_yaml(POLICY)
    c = pe.propose("study_plan", demo_profile())
    assert "preferences.food" not in cats(c)    # 학습과 무관

def test_disabled_item_removed():
    pe = PolicyEngine.from_yaml(POLICY)
    c = pe.propose("outing_plan", demo_profile())
    assert "constraints.budget" not in cats(c)  # enabled=False

def test_sensitive_excluded_without_purpose_rule():
    pe = PolicyEngine.from_yaml(POLICY)
    c = pe.propose("study_plan", demo_profile())
    assert "constraints.mobility" not in cats(c) # study_plan엔 목적규칙 없음

def test_sensitive_included_but_default_unchecked_with_purpose_rule():
    pe = PolicyEngine.from_yaml(POLICY)
    c = pe.propose("outing_plan", demo_profile())
    mob = [x for x in c if x.category == "constraints.mobility"]
    assert len(mob) == 1
    assert mob[0].default_checked is False       # 기본 해제
    assert mob[0].reason_code == "MOBILITY_ACCESS"

def test_unsupported_intent_rejected():
    pe = PolicyEngine.from_yaml(POLICY)
    with pytest.raises(UnsupportedIntent):
        pe.propose("hacking_plan", demo_profile())

def test_reject_llm_ids_outside_candidates():
    pe = PolicyEngine.from_yaml(POLICY)
    c = pe.propose("study_plan", demo_profile())
    valid = {x.item_id for x in c}
    kept = pe.validate_llm_ids(c, valid | {"p7"})  # p7=restricted, 후보 밖
    assert "p7" not in {x.item_id for x in kept}   # INV-2
