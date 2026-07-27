"""승인 경계: 클라이언트는 카드 ID만 보내고, 서버가 저장된 후보로 재검증·재구성한다.
클라이언트가 보낸 값/질문을 신뢰하지 않는다 (P0 보안)."""
import pathlib, pytest
from infrastructure.repository import SqliteRepository
from application.service import ApplicationService, ApprovalError
from domain.models import ProfileItem
from llm.fakes import DefaultRelevantRanker, FakeGenerator

POLICY = str(pathlib.Path(__file__).resolve().parents[1] / "specs" / "context-policy.yaml")
Q = "방학에 공부 계획 짜줘, 목표는 클라우드 엔지니어"

def setup(tmp_path):
    repo = SqliteRepository(str(tmp_path/"cb.db"))
    repo.save_profile_items("u1", [
        ProfileItem("p1","education.major","AISW",True,"normal"),
        ProfileItem("p2","career.goal","클라우드 엔지니어",True,"normal"),
        ProfileItem("p3","skills.current","Python 기초",True,"normal"),
        ProfileItem("p4","constraints.available_time","하루 2시간",True,"normal"),
    ])
    s = ApplicationService(repo, DefaultRelevantRanker(), FakeGenerator(), POLICY)
    return s, repo

def test_ask_persists_server_proposal(tmp_path):
    s, repo = setup(tmp_path)
    r = s.ask("u1", Q, "i1")
    stored = repo.load_proposal("i1")
    assert stored is not None
    assert {c["id"] for c in stored} == {c.item_id for c in r.candidates}

def test_approve_rejects_id_not_proposed(tmp_path):
    s, _ = setup(tmp_path)
    s.ask("u1", Q, "i1")
    with pytest.raises(ApprovalError):
        s.approve_and_generate("i1", ["p999"])     # 제안된 적 없는 카드

def test_snapshot_uses_server_value_not_client(tmp_path):
    s, repo = setup(tmp_path)
    s.ask("u1", Q, "i1")
    s.approve_and_generate("i1", ["p1"])           # id만 전달
    snap = repo.load_snapshot("i1")
    assert [it.value for it in snap.items] == ["AISW"]   # 서버 저장 값

def test_only_approved_ids_in_snapshot(tmp_path):
    s, repo = setup(tmp_path)
    s.ask("u1", Q, "i1")
    s.approve_and_generate("i1", ["p1","p2"])      # p3,p4 제외
    snap = repo.load_snapshot("i1")
    assert {it.value for it in snap.items} == {"AISW","클라우드 엔지니어"}
    assert "하루 2시간" not in {it.value for it in snap.items}

def test_question_read_from_server(tmp_path):
    s, repo = setup(tmp_path)
    s.ask("u1", Q, "i1")
    s.approve_and_generate("i1", ["p1"])           # 질문 인자 없음 — 서버 저장분 사용
    assert repo.load_interaction("i1")["state"] == "ANSWERED"
