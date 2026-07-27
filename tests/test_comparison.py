"""일반 vs 개인화 비교(데모 모드). 개인화=승인 스냅샷, 일반=카드 없는 baseline.
같은 질문, 다른 답변을 증명 — 단 승인 경계(ID-only)는 그대로 지킨다."""
import pathlib, pytest
from infrastructure.repository import SqliteRepository
from application.service import ApplicationService, ApprovalError
from domain.models import ProfileItem
from llm.fakes import DefaultRelevantRanker

POLICY = str(pathlib.Path(__file__).resolve().parents[1] / "specs" / "context-policy.yaml")
Q = "AWS 공부 어떻게 해? 목표는 클라우드 엔지니어"

class RecordingGenerator:
    def __init__(self): self.prompts = []
    def generate(self, prompt):
        self.prompts.append(prompt)
        return f"answer#{len(self.prompts)}::{prompt[:16]}"

def setup(tmp_path, gen):
    repo = SqliteRepository(str(tmp_path/"cb.db"))
    repo.save_profile_items("u1", [
        ProfileItem("p1","education.major","AISW",True,"normal"),
        ProfileItem("p2","career.goal","클라우드 엔지니어",True,"normal"),
    ])
    return ApplicationService(repo, DefaultRelevantRanker(), gen, POLICY), repo

def test_compare_returns_both_answers_and_they_differ(tmp_path):
    gen = RecordingGenerator()
    s, _ = setup(tmp_path, gen)
    s.ask("u1", Q, "i1")
    res = s.approve_and_compare("i1", ["p1"])
    assert res.general_answer and res.personalized_answer
    assert res.general_answer != res.personalized_answer

def test_general_prompt_has_no_cards_personalized_does(tmp_path):
    gen = RecordingGenerator()
    s, _ = setup(tmp_path, gen)
    s.ask("u1", Q, "i1")
    s.approve_and_compare("i1", ["p1"])                # p1 = AISW
    with_card = [p for p in gen.prompts if "AISW" in p]
    without_card = [p for p in gen.prompts if "AISW" not in p]
    assert with_card and without_card                  # 개인화엔 카드, 일반엔 없음

def test_compare_keeps_id_only_security(tmp_path):
    gen = RecordingGenerator()
    s, _ = setup(tmp_path, gen)
    s.ask("u1", Q, "i1")
    with pytest.raises(ApprovalError):
        s.approve_and_compare("i1", ["p999"])          # 제안 안 된 ID 거부
