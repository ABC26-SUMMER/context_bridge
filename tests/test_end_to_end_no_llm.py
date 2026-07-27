"""LLM 없이 승인→스냅샷→composer 경로 관통 (Phase 1 종료 조건)."""
from domain.policy import PolicyEngine
from domain.approval import build_snapshot, recompute_hash
from domain.composer import compose_prompt_from_snapshot
from infrastructure.repository import SqliteRepository
from domain.models import ProfileItem
import pathlib

POLICY = str(pathlib.Path(__file__).resolve().parents[1] / "specs" / "context-policy.yaml")

def seed():
    return [
        ProfileItem("p1","education.major","AISW",True,"normal"),
        ProfileItem("p2","career.goal","클라우드 엔지니어",True,"normal"),
        ProfileItem("p3","skills.current","Python 기초",True,"normal"),
        ProfileItem("p4","constraints.available_time","하루 2시간",True,"normal"),
        ProfileItem("p7","health.condition","무릎 관절염",True,"restricted"),
    ]

def test_full_path_excluded_item_absent_from_prompt():
    repo = SqliteRepository(":memory:")
    repo.save_profile_items("u1", seed())
    profile = repo.load_profile_items("u1")

    pe = PolicyEngine.from_yaml(POLICY)
    candidates = pe.propose("study_plan", profile)

    # 사용자가 '하루 2시간'(p4) 승인 해제 → 나머지만 승인
    approved = [{"id":c.item_id,"category":c.category,"label":c.category,"value":c.value}
                for c in candidates if c.item_id != "p4"]
    snap = build_snapshot("i1", approved)

    prompt = compose_prompt_from_snapshot("이번 방학에 뭘 공부할까?", snap)
    assert "AISW" in prompt
    assert "하루 2시간" not in prompt     # 승인 해제 → 프롬프트에 없음 (INV-1)
    assert "무릎 관절염" not in prompt     # restricted → 애초에 후보 아님 (INV-4)
    assert recompute_hash(snap.items) == snap.snapshot_hash  # 무결성
