"""Phase 2 오프라인 관통: 질문→의도→정책후보→랭커(fake)→승인→스냅샷→프롬프트.
라이브 LLM 없이 CI에서 재현 가능해야 한다 (v4 CI 규칙)."""
import pathlib
from domain.intent import IntentAnalyzer
from domain.policy import PolicyEngine
from domain.ranker import ContextRanker
from domain.approval import build_snapshot, recompute_hash
from domain.composer import compose_prompt_from_snapshot
from domain.models import ProfileItem
from llm.fakes import FakeRanker

POLICY = str(pathlib.Path(__file__).resolve().parents[1] / "specs" / "context-policy.yaml")

def profile():
    return [
        ProfileItem("p1","education.major","AISW",True,"normal"),
        ProfileItem("p2","career.goal","클라우드 엔지니어",True,"normal"),
        ProfileItem("p3","skills.current","Python 기초",True,"normal"),
        ProfileItem("p4","constraints.available_time","하루 2시간",True,"normal"),
        ProfileItem("p7","health.condition","무릎 관절염",True,"restricted"),
    ]

def test_phase2_flow_excludes_unapproved_and_restricted():
    q = "이번 방학에 공부 계획 짜줘, 목표는 클라우드 엔지니어"
    intent = IntentAnalyzer().analyze(q)
    assert intent.intent == "study_plan" and not intent.unsupported

    candidates = PolicyEngine.from_yaml(POLICY).propose(intent.intent, profile())
    # 랭커: p4(가능시간)를 irrelevant로 → 최종 후보에서 제거
    labels = {c.item_id: ("irrelevant" if c.item_id=="p4" else "relevant") for c in candidates}
    ranked = ContextRanker(FakeRanker(labels)).rank(q, candidates)

    approved = [{"id":c.item_id,"category":c.category,"label":c.category,"value":c.value}
                for c in ranked if c.default_checked]
    snap = build_snapshot("i1", approved)
    prompt = compose_prompt_from_snapshot(q, snap)

    assert "AISW" in prompt
    assert "하루 2시간" not in prompt      # 랭커가 irrelevant → 프롬프트에 없음
    assert "무릎 관절염" not in prompt      # restricted → 애초에 후보 아님
    assert recompute_hash(snap.items) == snap.snapshot_hash
