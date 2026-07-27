"""도메인 엔티티 (최소). Streamlit/SQLite/LLM SDK를 import하지 않는다 (INV/G2)."""
from dataclasses import dataclass

@dataclass
class UserProfile:
    id: str
    name: str
    description: str = ""
    icon: str = "🧭"
    is_active: bool = False

@dataclass
class ProfileItem:
    id: str
    category: str
    value: str
    enabled: bool
    sensitivity: str  # normal | sensitive | restricted
    version: int = 1

@dataclass
class Candidate:
    item_id: str
    category: str
    value: str
    sensitivity: str
    reason_code: str
    default_checked: bool
