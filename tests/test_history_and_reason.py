import pathlib
from infrastructure.repository import SqliteRepository
from application.service import ApplicationService
from domain.models import ProfileItem
from llm.fakes import DefaultRelevantRanker, FakeGenerator

POLICY = str(pathlib.Path(__file__).resolve().parents[1] / "specs" / "context-policy.yaml")

def test_list_interactions_and_reason_text(tmp_path):
    repo = SqliteRepository(str(tmp_path/"cb.db"))
    repo.save_profile_items("u1", [ProfileItem("p1","education.major","AISW",True,"normal")])
    s = ApplicationService(repo, DefaultRelevantRanker(), FakeGenerator(), POLICY)
    r = s.ask("u1", "방학 공부 계획, 목표는 엔지니어", "i1")
    s.approve_and_generate("i1", [c.item_id for c in r.candidates])

    rows = repo.list_interactions("u1")
    assert any(x["id"]=="i1" and x["state"]=="ANSWERED" for x in rows)

    txt = s.reason_text("MAJOR_CONTEXT")
    assert txt and "전공" in txt
