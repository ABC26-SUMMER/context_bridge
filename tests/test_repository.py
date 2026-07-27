import pytest
from domain.models import ProfileItem
from domain.approval import build_snapshot
from infrastructure.repository import SqliteRepository

def items():
    return [
        ProfileItem("p1","education.major","AISW",True,"normal"),
        ProfileItem("p8","constraints.budget","2만원",False,"normal"),
    ]

def test_profile_roundtrip_preserves_enabled_flag():
    repo = SqliteRepository(":memory:")
    repo.save_profile_items("u1", items())
    loaded = {i.id: i for i in repo.load_profile_items("u1")}
    assert loaded["p1"].enabled is True
    assert loaded["p8"].enabled is False
    assert loaded["p1"].value == "AISW"

def test_interaction_state_persisted_and_updated():
    repo = SqliteRepository(":memory:")
    repo.save_interaction("i1","u1","질문","study_plan","QUESTION_RECEIVED")
    repo.update_state("i1","APPROVED")
    assert repo.load_interaction("i1")["state"] == "APPROVED"

def test_snapshot_hash_survives_reload():
    repo = SqliteRepository(":memory:")
    snap = build_snapshot("i1",[{"id":"p1","category":"education.major","label":"전공","value":"AISW"}])
    repo.save_snapshot(snap)
    reloaded = repo.load_snapshot("i1")
    assert reloaded.snapshot_hash == snap.snapshot_hash   # REQ-7 무결성 유지
    assert len(reloaded.items) == 1
