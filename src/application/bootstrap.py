"""Composition root — 구체 구현을 조립하는 유일한 지점. UI는 여기서 만든 서비스만 쓴다."""
import os, json, pathlib
from infrastructure.repository import SqliteRepository
from llm.fakes import DefaultRelevantRanker, FakeGenerator
from application.service import ApplicationService
from domain.models import ProfileItem

ROOT = pathlib.Path(__file__).resolve().parents[2]
POLICY = str(ROOT / "specs" / "context-policy.yaml")
SEED = ROOT / "data" / "seed_profile.json"

def seed_if_empty(repo, user_id):
    profiles = repo.list_profiles(user_id)
    if any(repo.load_profile_items(user_id, p.id) for p in profiles):
        return
    # 샘플은 최초의 기본 프로필에만 넣는다. 사용자가 만든 빈 프로필을
    # 앱 재시작 시 샘플 카드로 오염시키지 않는다.
    if len(profiles) != 1 or profiles[0].id != "default":
        return
    data = json.loads(SEED.read_text(encoding="utf-8"))
    items = [ProfileItem(i["id"], i["category"], i["value"], i["enabled"], i["sensitivity"])
             for i in data["items"]]
    repo.save_profile_items(user_id, items, profiles[0].id)

def build_service(db_path):
    repo = SqliteRepository(db_path)
    mode = os.environ.get("CB_LLM", "fake").lower()   # fake | gemini/live/auto | groq
    if mode == "fake":
        ranker, generator = DefaultRelevantRanker(), FakeGenerator()
    else:
        from llm.live_adapters import build_live_gateways
        ranker, generator = build_live_gateways(mode)
    return ApplicationService(repo, ranker, generator, POLICY), repo
