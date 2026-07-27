import pathlib, pytest
from infrastructure.repository import SqliteRepository
from application.service import ApplicationService
from domain.models import ProfileItem
from llm.fakes import DefaultRelevantRanker, FakeGenerator

POLICY = str(pathlib.Path(__file__).resolve().parents[1] / "specs" / "context-policy.yaml")

def seed(repo):
    repo.save_profile_items("u1", [
        ProfileItem("p1","education.major","AISW",True,"normal"),
        ProfileItem("p2","career.goal","클라우드 엔지니어",True,"normal"),
        ProfileItem("p3","skills.current","Python 기초",True,"normal"),
        ProfileItem("p4","constraints.available_time","하루 2시간",True,"normal"),
        ProfileItem("p7","health.condition","무릎 관절염",True,"restricted"),
    ])

def svc(repo):
    return ApplicationService(repo, DefaultRelevantRanker(), FakeGenerator(), POLICY)

def test_ask_unsupported_question():
    repo = SqliteRepository(":memory:"); seed(repo)
    r = svc(repo).ask("u1", "오늘 날씨 어때?", "i1")
    assert r.state == "UNSUPPORTED"
    assert r.candidates == []

def test_ask_returns_candidates_without_restricted():
    repo = SqliteRepository(":memory:"); seed(repo)
    r = svc(repo).ask("u1", "방학에 공부 계획 짜줘, 목표는 클라우드 엔지니어", "i1")
    cats = {c.category for c in r.candidates}
    assert r.state == "AWAITING_APPROVAL"
    assert "health.condition" not in cats     # restricted 미노출
    assert "education.major" in cats

def test_approve_generates_answer_and_persists_state(tmp_path):
    db = str(tmp_path / "cb.db")
    repo = SqliteRepository(db); seed(repo)
    s = svc(repo)
    r = s.ask("u1", "방학에 공부 계획 짜줘, 목표는 클라우드 엔지니어", "i1")
    g = s.approve_and_generate("i1", [c.item_id for c in r.candidates if c.item_id != "p4"])
    assert g.answer
    assert repo.load_interaction("i1")["state"] == "ANSWERED"

def test_refresh_recovers_state_from_db(tmp_path):
    # REQ-7: 새 세션(새로고침)이 DB에서 상태를 복구한다
    db = str(tmp_path / "cb.db")
    repo1 = SqliteRepository(db); seed(repo1)
    s = ApplicationService(repo1, DefaultRelevantRanker(), FakeGenerator(), POLICY)
    r = s.ask("u1", "방학에 공부 계획 짜줘, 목표는 클라우드 엔지니어", "i1")
    s.approve_and_generate("i1", [c.item_id for c in r.candidates])

    repo2 = SqliteRepository(db)               # 브라우저 새로고침 = 새 연결
    row = repo2.load_interaction("i1")
    assert row["state"] == "ANSWERED"          # 세션이 아니라 DB에서 복구
    assert repo2.load_snapshot("i1") is not None
