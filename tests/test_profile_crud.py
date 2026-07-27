import pathlib, pytest
from infrastructure.repository import SqliteRepository
from application.service import ApplicationService
from domain.approval import build_snapshot
from llm.fakes import DefaultRelevantRanker, FakeGenerator

POLICY = str(pathlib.Path(__file__).resolve().parents[1] / "specs" / "context-policy.yaml")

def svc(tmp_path):
    repo = SqliteRepository(str(tmp_path/"cb.db"))
    return ApplicationService(repo, DefaultRelevantRanker(), FakeGenerator(), POLICY), repo

def test_add_card_creates_item_with_policy_sensitivity(tmp_path):
    s, repo = svc(tmp_path)
    item = s.add_card("u1", "education.major", "AISW")
    assert item.version == 1 and item.enabled is True
    assert item.sensitivity == "normal"                 # 정책에서 파생
    assert any(i.value == "AISW" for i in repo.load_profile_items("u1"))

def test_add_card_forces_grade_and_caller_cannot_lower(tmp_path):
    # REQ-18: 호출자가 등급을 정하지 못한다. health.condition은 정책상 restricted 강제.
    s, _ = svc(tmp_path)
    item = s.add_card("u1", "health.condition", "무릎")
    assert item.sensitivity == "restricted"

def test_add_card_rejects_empty_and_duplicate(tmp_path):
    s, _ = svc(tmp_path)
    with pytest.raises(ValueError):
        s.add_card("u1", "education.major", "  ")        # 빈 값
    s.add_card("u1", "education.major", "AISW")
    with pytest.raises(ValueError):
        s.add_card("u1", "education.major", "AISW")       # 중복

def test_add_card_rejects_unknown_category(tmp_path):
    s, _ = svc(tmp_path)
    with pytest.raises(Exception):
        s.add_card("u1", "not.a.category", "x")           # 정책 밖 → fail closed

def test_edit_card_increments_version(tmp_path):
    s, repo = svc(tmp_path)
    it = s.add_card("u1", "skills.current", "AWS 초보")
    s.edit_card("u1", it.id, "AWS 중급")
    got = {i.id: i for i in repo.load_profile_items("u1")}[it.id]
    assert got.value == "AWS 중급" and got.version == 2   # REQ-15 version↑

def test_edit_does_not_change_past_snapshot(tmp_path):
    # REQ-15: 수정해도 이미 만들어진 승인 스냅샷의 값·해시는 불변
    s, _ = svc(tmp_path)
    it = s.add_card("u1", "skills.current", "AWS 초보")
    snap = build_snapshot("i1", [{"id":it.id,"category":it.category,"label":"수준","value":it.value}])
    h0 = snap.snapshot_hash
    s.edit_card("u1", it.id, "AWS 중급")
    assert snap.items[0].value == "AWS 초보"              # 과거 스냅샷 불변
    assert snap.snapshot_hash == h0

def test_toggle_and_delete(tmp_path):
    s, repo = svc(tmp_path)
    it = s.add_card("u1", "preferences.food", "매운 음식 비선호")
    s.toggle_card("u1", it.id, False)
    assert {i.id:i for i in repo.load_profile_items("u1")}[it.id].enabled is False
    s.delete_card("u1", it.id)
    assert all(i.id != it.id for i in repo.load_profile_items("u1"))
