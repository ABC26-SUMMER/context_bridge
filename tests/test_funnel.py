"""정보 깔때기: 전체 카드 → 정책 허용 → 질문 관련. 실제 파이프라인 단계별 수(하드코딩 아님)."""
import pathlib
from infrastructure.repository import SqliteRepository
from application.service import ApplicationService
from domain.models import ProfileItem
from llm.fakes import DefaultRelevantRanker, FakeGenerator

POLICY = str(pathlib.Path(__file__).resolve().parents[1] / "specs" / "context-policy.yaml")

def test_ask_returns_pipeline_funnel(tmp_path):
    repo = SqliteRepository(str(tmp_path/"cb.db"))
    repo.save_profile_items("u1", [
        ProfileItem("p1","education.major","AISW",True,"normal"),        # 허용
        ProfileItem("p2","career.goal","클라우드 엔지니어",True,"normal"),   # 허용
        ProfileItem("p3","skills.current","Python 기초",True,"normal"),    # 허용
        ProfileItem("p4","constraints.available_time","하루 2시간",True,"normal"), # 허용
        ProfileItem("p5","preferences.food","매운맛 비선호",True,"normal"), # 범주 밖 → 제외
        ProfileItem("p6","constraints.budget","2만원",False,"normal"),     # 비활성 → 제외
        ProfileItem("p7","health.condition","무릎",True,"restricted"),     # restricted → 제외
    ])
    s = ApplicationService(repo, DefaultRelevantRanker(), FakeGenerator(), POLICY)
    r = s.ask("u1", "방학 공부 계획, 목표는 엔지니어", "i1")
    assert r.total_cards == 7          # 전체
    assert r.policy_allowed == 4       # 정책 허용(비활성·범주밖·restricted 제외)
    assert r.question_related == len(r.candidates)  # 질문 관련(랭커 통과)
    assert r.total_cards >= r.policy_allowed >= r.question_related  # 단조 감소
