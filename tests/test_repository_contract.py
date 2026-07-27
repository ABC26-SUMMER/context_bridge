"""저장소 포트 계약. 어떤 어댑터(SQLite/InMemory/Postgres/Supabase)든 이 계약을 통과해야 한다.
→ 저장소 교체는 '아키텍처 변경'이 아니라 '어댑터 교체'임을 증명한다."""
import pytest
from domain.models import ProfileItem, UserProfile
from domain.approval import build_snapshot
from infrastructure.repository import SqliteRepository
from infrastructure.memory_repository import InMemoryRepository

@pytest.fixture(params=["sqlite", "memory"])
def repo(request, tmp_path):
    if request.param == "sqlite":
        return SqliteRepository(str(tmp_path / "cb.db"))
    return InMemoryRepository()

def test_profile_roundtrip_and_enabled_flag(repo):
    repo.save_profile_items("u1", [
        ProfileItem("p1","education.major","AISW",True,"normal"),
        ProfileItem("p8","constraints.budget","2만원",False,"normal"),
    ])
    loaded = {i.id: i for i in repo.load_profile_items("u1")}
    assert loaded["p1"].value == "AISW"
    assert loaded["p8"].enabled is False

def test_multi_profile_lifecycle_and_isolation(repo):
    repo.create_profile(
        "u1", UserProfile("work", "취업 준비", "", "🎯", True)
    )
    repo.save_profile_items(
        "u1",
        [ProfileItem("work-card","career.goal","클라우드 엔지니어",True,"normal")],
        "work",
    )
    repo.set_active_profile("u1", "default")
    assert repo.get_active_profile("u1").id == "default"
    assert repo.load_profile_items("u1", "default") == []
    assert {i.id for i in repo.load_profile_items("u1", "work")} == {"work-card"}

def test_user_isolation(repo):
    repo.save_profile_items("u1", [ProfileItem("p1","education.major","AISW",True,"normal")])
    repo.save_profile_items("u2", [ProfileItem("p2","career.goal","X",True,"normal")])
    assert {i.id for i in repo.load_profile_items("u1")} == {"p1"}

def test_profile_set_user_isolation(repo):
    repo.create_profile("u1", UserProfile("work", "취업", "", "🎯", True))
    assert {p.id for p in repo.list_profiles("u1")} == {"default", "work"}
    assert {p.id for p in repo.list_profiles("u2")} == {"default"}

def test_interaction_state_and_answer(repo):
    repo.save_interaction("i1","u1","q","study_plan","QUESTION_RECEIVED")
    repo.update_state("i1","ANSWERED")
    repo.save_answer("i1","답변")
    row = repo.load_interaction("i1")
    assert row["state"] == "ANSWERED" and row["answer"] == "답변"

def test_list_interactions(repo):
    repo.save_interaction("i1","u1","q","study_plan","ANSWERED")
    assert any(x["id"]=="i1" for x in repo.list_interactions("u1"))

def test_snapshot_roundtrip(repo):
    snap = build_snapshot("i1",[{"id":"p1","category":"education.major","label":"전공","value":"AISW"}])
    repo.save_snapshot(snap)
    r = repo.load_snapshot("i1")
    assert r.snapshot_hash == snap.snapshot_hash and len(r.items) == 1
