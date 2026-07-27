"""SQLite Repository — 다중 상황 프로필과 기존 DB 비파괴 마이그레이션."""
import json
import sqlite3
from functools import wraps
from pathlib import Path
from threading import RLock

from domain.approval import ApprovalSnapshot, ApprovedItem
from domain.models import ProfileItem, UserProfile

DEFAULT_PROFILE_ID = "default"


def _serialized(method):
    """하나의 SQLite 연결에 대한 작업을 스레드 간 직렬화한다."""
    @wraps(method)
    def wrapped(self, *args, **kwargs):
        with self._lock:
            return method(self, *args, **kwargs)
    return wrapped


class SqliteRepository:
    def __init__(self, db_path=":memory:"):
        self._lock = RLock()
        self.migration_backup_path = self._backup_legacy_db(db_path)
        self.db = sqlite3.connect(db_path, check_same_thread=False)
        self.db.execute("""CREATE TABLE IF NOT EXISTS user_profile(
            id TEXT, user_id TEXT, name TEXT, description TEXT,
            icon TEXT, is_active INT DEFAULT 0,
            PRIMARY KEY(user_id, id))""")
        self.db.execute("""CREATE TABLE IF NOT EXISTS profile_item(
            id TEXT PRIMARY KEY, user_id TEXT, category TEXT, value TEXT,
            enabled INT, sensitivity TEXT, version INT DEFAULT 1,
            profile_id TEXT NOT NULL DEFAULT 'default')""")
        self.db.execute("""CREATE TABLE IF NOT EXISTS interaction(
            id TEXT PRIMARY KEY, user_id TEXT, question TEXT, intent TEXT,
            state TEXT, answer TEXT, profile_id TEXT)""")
        self.db.execute("""CREATE TABLE IF NOT EXISTS approval_snapshot(
            interaction_id TEXT PRIMARY KEY, items_json TEXT, snapshot_hash TEXT)""")
        self.db.execute("""CREATE TABLE IF NOT EXISTS context_proposal(
            interaction_id TEXT PRIMARY KEY, items_json TEXT)""")
        self._migrate_legacy_schema()
        self.db.commit()

    @staticmethod
    def _backup_legacy_db(db_path):
        """ALTER 전 구버전 파일 DB를 SQLite backup API로 한 번 보존한다."""
        if db_path == ":memory:" or not Path(db_path).exists():
            return None
        source = sqlite3.connect(db_path)
        try:
            tables = {
                row[0] for row in source.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            if "profile_item" not in tables:
                return None
            columns = {
                row[1] for row in source.execute("PRAGMA table_info(profile_item)")
            }
            if "profile_id" in columns:
                return None
            backup_path = f"{db_path}.pre-multiprofile.bak"
            if not Path(backup_path).exists():
                destination = sqlite3.connect(backup_path)
                try:
                    source.backup(destination)
                finally:
                    destination.close()
            return backup_path
        finally:
            source.close()

    def _column_names(self, table):
        return {row[1] for row in self.db.execute(f"PRAGMA table_info({table})")}

    def _migrate_legacy_schema(self):
        """구버전 단일 프로필 DB의 카드와 상호작용을 보존한다."""
        if "profile_id" not in self._column_names("profile_item"):
            self.db.execute(
                "ALTER TABLE profile_item ADD COLUMN profile_id "
                "TEXT NOT NULL DEFAULT 'default'"
            )
        if "profile_id" not in self._column_names("interaction"):
            self.db.execute("ALTER TABLE interaction ADD COLUMN profile_id TEXT")

        users = {
            row[0] for row in self.db.execute(
                "SELECT DISTINCT user_id FROM profile_item WHERE user_id IS NOT NULL"
            )
        }
        users.update(
            row[0] for row in self.db.execute(
                "SELECT DISTINCT user_id FROM interaction WHERE user_id IS NOT NULL"
            )
        )
        for user_id in users:
            self._ensure_default_profile(user_id)
        self.db.execute(
            "UPDATE interaction SET profile_id=? WHERE profile_id IS NULL",
            (DEFAULT_PROFILE_ID,),
        )

    def _ensure_default_profile(self, user_id):
        count = self.db.execute(
            "SELECT COUNT(*) FROM user_profile WHERE user_id=?", (user_id,)
        ).fetchone()[0]
        if count == 0:
            self.db.execute(
                "INSERT INTO user_profile(id,user_id,name,description,icon,is_active) "
                "VALUES (?,?,?,?,?,1)",
                (DEFAULT_PROFILE_ID, user_id, "기본 프로필",
                 "기존 카드와 기본 설정", "🧭"),
            )
        active = self.db.execute(
            "SELECT COUNT(*) FROM user_profile WHERE user_id=? AND is_active=1",
            (user_id,),
        ).fetchone()[0]
        if active == 0:
            first = self.db.execute(
                "SELECT id FROM user_profile WHERE user_id=? ORDER BY rowid LIMIT 1",
                (user_id,),
            ).fetchone()
            if first:
                self.db.execute(
                    "UPDATE user_profile SET is_active=1 WHERE user_id=? AND id=?",
                    (user_id, first[0]),
                )

    def _resolve_profile_id(self, user_id, profile_id):
        self._ensure_default_profile(user_id)
        if profile_id is not None:
            return profile_id
        row = self.db.execute(
            "SELECT id FROM user_profile WHERE user_id=? AND is_active=1 LIMIT 1",
            (user_id,),
        ).fetchone()
        return row[0] if row else DEFAULT_PROFILE_ID

    # --- profile sets ---
    @_serialized
    def create_profile(self, user_id, profile):
        self._ensure_default_profile(user_id)
        if profile.is_active:
            self.db.execute(
                "UPDATE user_profile SET is_active=0 WHERE user_id=?", (user_id,)
            )
        self.db.execute(
            "INSERT INTO user_profile(id,user_id,name,description,icon,is_active) "
            "VALUES (?,?,?,?,?,?)",
            (profile.id, user_id, profile.name, profile.description, profile.icon,
             1 if profile.is_active else 0),
        )
        self.db.commit()

    @_serialized
    def list_profiles(self, user_id):
        self._ensure_default_profile(user_id)
        self.db.commit()
        rows = self.db.execute(
            "SELECT id,name,description,icon,is_active FROM user_profile "
            "WHERE user_id=? ORDER BY is_active DESC, rowid",
            (user_id,),
        ).fetchall()
        return [UserProfile(r[0], r[1], r[2] or "", r[3] or "🧭", bool(r[4]))
                for r in rows]

    @_serialized
    def get_profile(self, user_id, profile_id):
        self._ensure_default_profile(user_id)
        row = self.db.execute(
            "SELECT id,name,description,icon,is_active FROM user_profile "
            "WHERE user_id=? AND id=?",
            (user_id, profile_id),
        ).fetchone()
        return None if row is None else UserProfile(
            row[0], row[1], row[2] or "", row[3] or "🧭", bool(row[4])
        )

    @_serialized
    def get_active_profile(self, user_id):
        profile_id = self._resolve_profile_id(user_id, None)
        self.db.commit()
        row = self.db.execute(
            "SELECT id,name,description,icon,is_active FROM user_profile "
            "WHERE user_id=? AND id=?",
            (user_id, profile_id),
        ).fetchone()
        return UserProfile(row[0], row[1], row[2] or "", row[3] or "🧭", bool(row[4]))

    @_serialized
    def set_active_profile(self, user_id, profile_id):
        exists = self.db.execute(
            "SELECT 1 FROM user_profile WHERE user_id=? AND id=?",
            (user_id, profile_id),
        ).fetchone()
        if not exists:
            raise ValueError("프로필을 찾을 수 없습니다")
        self.db.execute(
            "UPDATE user_profile SET is_active=0 WHERE user_id=?", (user_id,)
        )
        self.db.execute(
            "UPDATE user_profile SET is_active=1 WHERE user_id=? AND id=?",
            (user_id, profile_id),
        )
        self.db.commit()

    @_serialized
    def update_profile(self, user_id, profile_id, name, description):
        cur = self.db.execute(
            "UPDATE user_profile SET name=?,description=? WHERE user_id=? AND id=?",
            (name, description, user_id, profile_id),
        )
        if cur.rowcount == 0:
            raise ValueError("프로필을 찾을 수 없습니다")
        self.db.commit()

    @_serialized
    def delete_profile(self, user_id, profile_id):
        was_active = self.db.execute(
            "SELECT is_active FROM user_profile WHERE user_id=? AND id=?",
            (user_id, profile_id),
        ).fetchone()
        if was_active is None:
            raise ValueError("프로필을 찾을 수 없습니다")
        self.db.execute(
            "DELETE FROM profile_item WHERE user_id=? AND profile_id=?",
            (user_id, profile_id),
        )
        self.db.execute(
            "DELETE FROM user_profile WHERE user_id=? AND id=?",
            (user_id, profile_id),
        )
        if was_active[0]:
            next_row = self.db.execute(
                "SELECT id FROM user_profile WHERE user_id=? ORDER BY rowid LIMIT 1",
                (user_id,),
            ).fetchone()
            if next_row:
                self.db.execute(
                    "UPDATE user_profile SET is_active=1 WHERE user_id=? AND id=?",
                    (user_id, next_row[0]),
                )
        self.db.commit()

    # --- profile items ---
    @_serialized
    def save_profile_items(self, user_id, items, profile_id=None):
        resolved = self._resolve_profile_id(user_id, profile_id)
        for item in items:
            self._upsert_item(user_id, resolved, item)
        self.db.commit()

    def _upsert_item(self, user_id, profile_id, item):
        self.db.execute(
            "INSERT OR REPLACE INTO profile_item"
            "(id,user_id,category,value,enabled,sensitivity,version,profile_id) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (item.id, user_id, item.category, item.value,
             1 if item.enabled else 0, item.sensitivity, item.version, profile_id),
        )

    @_serialized
    def add_profile_item(self, user_id, item, profile_id=None):
        resolved = self._resolve_profile_id(user_id, profile_id)
        self._upsert_item(user_id, resolved, item)
        self.db.commit()

    @_serialized
    def get_profile_item(self, user_id, item_id, profile_id=None):
        resolved = self._resolve_profile_id(user_id, profile_id)
        row = self.db.execute(
            "SELECT id,category,value,enabled,sensitivity,version FROM profile_item "
            "WHERE user_id=? AND profile_id=? AND id=?",
            (user_id, resolved, item_id),
        ).fetchone()
        return None if row is None else ProfileItem(
            row[0], row[1], row[2], bool(row[3]), row[4], row[5]
        )

    @_serialized
    def update_profile_value(self, user_id, item_id, new_value, new_version,
                             profile_id=None):
        resolved = self._resolve_profile_id(user_id, profile_id)
        self.db.execute(
            "UPDATE profile_item SET value=?,version=? "
            "WHERE user_id=? AND profile_id=? AND id=?",
            (new_value, new_version, user_id, resolved, item_id),
        )
        self.db.commit()

    @_serialized
    def set_enabled(self, user_id, item_id, enabled, profile_id=None):
        resolved = self._resolve_profile_id(user_id, profile_id)
        self.db.execute(
            "UPDATE profile_item SET enabled=? "
            "WHERE user_id=? AND profile_id=? AND id=?",
            (1 if enabled else 0, user_id, resolved, item_id),
        )
        self.db.commit()

    @_serialized
    def delete_profile_item(self, user_id, item_id, profile_id=None):
        resolved = self._resolve_profile_id(user_id, profile_id)
        self.db.execute(
            "DELETE FROM profile_item WHERE user_id=? AND profile_id=? AND id=?",
            (user_id, resolved, item_id),
        )
        self.db.commit()

    @_serialized
    def load_profile_items(self, user_id, profile_id=None):
        resolved = self._resolve_profile_id(user_id, profile_id)
        self.db.commit()
        rows = self.db.execute(
            "SELECT id,category,value,enabled,sensitivity,version FROM profile_item "
            "WHERE user_id=? AND profile_id=?",
            (user_id, resolved),
        ).fetchall()
        return [ProfileItem(r[0], r[1], r[2], bool(r[3]), r[4], r[5])
                for r in rows]

    # --- interaction ---
    @_serialized
    def save_interaction(self, interaction_id, user_id, question, intent, state,
                         profile_id=None):
        resolved = self._resolve_profile_id(user_id, profile_id)
        self.db.execute(
            "INSERT OR REPLACE INTO interaction"
            "(id,user_id,question,intent,state,profile_id) VALUES (?,?,?,?,?,?)",
            (interaction_id, user_id, question, intent, state, resolved),
        )
        self.db.commit()

    @_serialized
    def update_state(self, interaction_id, state):
        self.db.execute("UPDATE interaction SET state=? WHERE id=?", (state, interaction_id))
        self.db.commit()

    @_serialized
    def list_interactions(self, user_id):
        rows = self.db.execute(
            "SELECT id,user_id,question,intent,state,answer,profile_id "
            "FROM interaction WHERE user_id=?",
            (user_id,),
        ).fetchall()
        keys = ("id", "user_id", "question", "intent", "state", "answer", "profile_id")
        return [dict(zip(keys, row)) for row in rows]

    @_serialized
    def save_answer(self, interaction_id, answer):
        self.db.execute("UPDATE interaction SET answer=? WHERE id=?", (answer, interaction_id))
        self.db.commit()

    @_serialized
    def load_interaction(self, interaction_id):
        row = self.db.execute(
            "SELECT id,user_id,question,intent,state,answer,profile_id "
            "FROM interaction WHERE id=?",
            (interaction_id,),
        ).fetchone()
        if row is None:
            return None
        keys = ("id", "user_id", "question", "intent", "state", "answer", "profile_id")
        return dict(zip(keys, row))

    # --- proposal / snapshot ---
    @_serialized
    def save_proposal(self, interaction_id, candidates):
        self.db.execute(
            "INSERT OR REPLACE INTO context_proposal VALUES (?,?)",
            (interaction_id, json.dumps(candidates, ensure_ascii=False)),
        )
        self.db.commit()

    @_serialized
    def load_proposal(self, interaction_id):
        row = self.db.execute(
            "SELECT items_json FROM context_proposal WHERE interaction_id=?",
            (interaction_id,),
        ).fetchone()
        return None if row is None else json.loads(row[0])

    @_serialized
    def save_snapshot(self, snap):
        items_json = json.dumps(
            [{"id": item.id, "category": item.category,
              "label": item.label, "value": item.value} for item in snap.items],
            ensure_ascii=False,
        )
        self.db.execute(
            "INSERT OR REPLACE INTO approval_snapshot VALUES (?,?,?)",
            (snap.interaction_id, items_json, snap.snapshot_hash),
        )
        self.db.commit()

    @_serialized
    def load_snapshot(self, interaction_id):
        row = self.db.execute(
            "SELECT interaction_id,items_json,snapshot_hash "
            "FROM approval_snapshot WHERE interaction_id=?",
            (interaction_id,),
        ).fetchone()
        if row is None:
            return None
        items = tuple(
            ApprovedItem(d["id"], d["category"], d["label"], d["value"])
            for d in json.loads(row[1])
        )
        return ApprovalSnapshot(row[0], items, row[2])

    @_serialized
    def close(self):
        self.db.close()
