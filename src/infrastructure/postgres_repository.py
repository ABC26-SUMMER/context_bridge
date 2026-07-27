"""PostgresRepository — Postgres/Supabase용 참조 어댑터(같은 Repository 포트 구현).

⚠️ 이 모듈은 이 환경/CI에서 실행·검증되지 않는다. 라이브 DB(DATABASE_URL)가 필요하다.
psycopg는 지연 import하므로 미설치 환경에서도 이 파일 import 자체는 실패하지 않는다.
Supabase로 갈 때: DATABASE_URL을 Supabase 연결 문자열로 두면 그대로 동작한다.
사용자 격리는 여기 user_id 조건에 더해 Supabase면 RLS로 DB단 이중화 가능(앱단 검증을 대체하지 않음)."""
import json

DDL = [
    "CREATE TABLE IF NOT EXISTS profile_item(id TEXT PRIMARY KEY, user_id TEXT, category TEXT, value TEXT, enabled BOOLEAN, sensitivity TEXT)",
    "CREATE TABLE IF NOT EXISTS interaction(id TEXT PRIMARY KEY, user_id TEXT, question TEXT, intent TEXT, state TEXT, answer TEXT)",
    "CREATE TABLE IF NOT EXISTS approval_snapshot(interaction_id TEXT PRIMARY KEY, items_json TEXT, snapshot_hash TEXT)",
]

class PostgresRepository:
    def __init__(self, dsn):
        import psycopg  # 지연 import: 미설치 환경에서 모듈 로드는 가능
        self.conn = psycopg.connect(dsn, autocommit=True)
        for stmt in DDL:
            self.conn.execute(stmt)

    def save_profile_items(self, user_id, items):
        for i in items:
            self.conn.execute(
                "INSERT INTO profile_item VALUES (%s,%s,%s,%s,%s,%s) "
                "ON CONFLICT (id) DO UPDATE SET value=EXCLUDED.value, enabled=EXCLUDED.enabled, sensitivity=EXCLUDED.sensitivity",
                (i.id, user_id, i.category, i.value, i.enabled, i.sensitivity))

    def load_profile_items(self, user_id):
        from domain.models import ProfileItem
        rows = self.conn.execute(
            "SELECT id,category,value,enabled,sensitivity FROM profile_item WHERE user_id=%s",
            (user_id,)).fetchall()
        return [ProfileItem(r[0], r[1], r[2], bool(r[3]), r[4]) for r in rows]
    # interaction/snapshot 메서드는 SqliteRepository와 동일 형태로 구현(플레이스홀더 %s만 차이).
    # 계약 테스트(test_repository_contract.py)를 라이브 DB 대상으로 돌려 검증할 것.
