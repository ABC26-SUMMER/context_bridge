"""ApprovalSnapshot — 승인된 항목의 불변 스냅샷 + canonical JSON SHA-256 해시.
답변 생성의 유일한 개인화 입력이며(INV-3), 생성 후 원본 프로필 변경에 영향받지 않는다."""
import json, hashlib
from dataclasses import dataclass

@dataclass(frozen=True)
class ApprovedItem:
    id: str
    category: str
    label: str
    value: str

@dataclass(frozen=True)
class ApprovalSnapshot:
    interaction_id: str
    items: tuple            # tuple[ApprovedItem] — 불변
    snapshot_hash: str

def _canonical(items):
    """id 기준 정렬 + key 정렬 → 순서 무관 canonical JSON."""
    rows = sorted(
        ({"id":i.id,"category":i.category,"label":i.label,"value":i.value} for i in items),
        key=lambda r: r["id"],
    )
    return json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def recompute_hash(items):
    return hashlib.sha256(_canonical(items).encode("utf-8")).hexdigest()

def build_snapshot(interaction_id, approved_items):
    frozen = tuple(ApprovedItem(a["id"], a["category"], a["label"], a["value"]) for a in approved_items)
    return ApprovalSnapshot(interaction_id, frozen, recompute_hash(frozen))
