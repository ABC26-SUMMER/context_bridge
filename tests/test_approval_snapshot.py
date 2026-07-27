import pytest
from domain.approval import build_snapshot, recompute_hash

def approved():
    return [
        {"id":"p1","category":"education.major","label":"전공","value":"AISW"},
        {"id":"p2","category":"career.goal","label":"진로 목표","value":"클라우드 엔지니어"},
    ]

def test_hash_is_deterministic_and_order_independent():
    a = build_snapshot("i1", approved())
    b = build_snapshot("i1", list(reversed(approved())))
    assert a.snapshot_hash == b.snapshot_hash   # canonical → 순서 무관

def test_snapshot_is_immutable_after_source_change():
    items = approved()
    snap = build_snapshot("i1", items)
    items.append({"id":"p9","category":"health.condition","label":"건강","value":"무릎 관절염"})
    items[0]["value"] = "변조"
    assert len(snap.items) == 2                 # 원본 변경이 스냅샷을 바꾸지 않음
    assert all(it.value != "변조" for it in snap.items)
    assert snap.snapshot_hash == recompute_hash(snap.items)  # 해시도 그대로

def test_frozen_snapshot_cannot_be_reassigned():
    snap = build_snapshot("i1", approved())
    with pytest.raises(Exception):
        snap.snapshot_hash = "tampered"          # frozen (REQ-3)

def test_recompute_matches_stored_hash():
    # 데모 증명: 스냅샷 해시 == composer에 들어간 항목으로 재계산한 해시
    snap = build_snapshot("i1", approved())
    assert recompute_hash(snap.items) == snap.snapshot_hash
