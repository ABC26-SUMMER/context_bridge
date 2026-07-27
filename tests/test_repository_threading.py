from concurrent.futures import ThreadPoolExecutor

from domain.models import ProfileItem
from infrastructure.repository import SqliteRepository


def test_sqlite_repository_can_be_used_from_streamlit_rerun_thread(tmp_path):
    repo = SqliteRepository(str(tmp_path / "cb.db"))
    repo.add_profile_item(
        "user-1",
        ProfileItem("card-1", "career.goal", "클라우드 엔지니어", True, "normal"),
    )

    with ThreadPoolExecutor(max_workers=1) as pool:
        items = pool.submit(repo.load_profile_items, "user-1").result()

    assert [item.id for item in items] == ["card-1"]


def test_sqlite_repository_serializes_concurrent_writes(tmp_path):
    repo = SqliteRepository(str(tmp_path / "cb.db"))

    def add(index):
        repo.add_profile_item(
            "user-1",
            ProfileItem(
                f"card-{index}",
                "skills.current",
                f"기술 {index}",
                True,
                "normal",
            ),
        )

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(add, range(12)))

    assert len(repo.load_profile_items("user-1")) == 12
