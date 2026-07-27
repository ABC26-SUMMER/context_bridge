import sqlite3

from infrastructure.repository import SqliteRepository


def test_legacy_single_profile_database_is_migrated_without_data_loss(tmp_path):
    db_path = tmp_path / "legacy.db"
    db = sqlite3.connect(db_path)
    db.execute("""CREATE TABLE profile_item(
        id TEXT PRIMARY KEY, user_id TEXT, category TEXT, value TEXT,
        enabled INT, sensitivity TEXT, version INT DEFAULT 1)""")
    db.execute(
        "INSERT INTO profile_item VALUES (?,?,?,?,?,?,?)",
        ("old-card", "u1", "career.goal", "클라우드 엔지니어", 1, "normal", 2),
    )
    db.execute("""CREATE TABLE interaction(
        id TEXT PRIMARY KEY, user_id TEXT, question TEXT, intent TEXT,
        state TEXT, answer TEXT)""")
    db.commit()
    db.close()

    repo = SqliteRepository(str(db_path))
    profiles = repo.list_profiles("u1")
    items = repo.load_profile_items("u1", profiles[0].id)

    assert len(profiles) == 1
    assert profiles[0].name == "기본 프로필"
    assert [(item.id, item.value, item.version) for item in items] == [
        ("old-card", "클라우드 엔지니어", 2)
    ]
    assert repo.migration_backup_path is not None
    assert (tmp_path / "legacy.db.pre-multiprofile.bak").exists()
