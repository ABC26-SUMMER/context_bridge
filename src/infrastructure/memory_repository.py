"""InMemoryRepository — SQLite와 같은 다중 프로필 계약을 구현한다."""
import copy

from domain.models import UserProfile

DEFAULT_PROFILE_ID = "default"


class InMemoryRepository:
    def __init__(self):
        self._profile_sets = {}  # user_id -> {profile_id: UserProfile}
        self._items = {}         # (user_id, profile_id) -> {item_id: ProfileItem}
        self._interactions = {}
        self._snapshots = {}
        self._proposals = {}

    def _ensure_default(self, user_id):
        profiles = self._profile_sets.setdefault(user_id, {})
        if not profiles:
            profiles[DEFAULT_PROFILE_ID] = UserProfile(
                DEFAULT_PROFILE_ID, "기본 프로필", "기존 카드와 기본 설정", "🧭", True
            )

    def _resolve(self, user_id, profile_id):
        self._ensure_default(user_id)
        if profile_id is not None:
            return profile_id
        for profile in self._profile_sets[user_id].values():
            if profile.is_active:
                return profile.id
        first = next(iter(self._profile_sets[user_id].values()))
        first.is_active = True
        return first.id

    # --- profile sets ---
    def create_profile(self, user_id, profile):
        self._ensure_default(user_id)
        if profile.id in self._profile_sets[user_id]:
            raise ValueError("이미 존재하는 프로필입니다")
        if profile.is_active:
            for current in self._profile_sets[user_id].values():
                current.is_active = False
        self._profile_sets[user_id][profile.id] = copy.copy(profile)

    def list_profiles(self, user_id):
        self._ensure_default(user_id)
        return [copy.copy(p) for p in self._profile_sets[user_id].values()]

    def get_profile(self, user_id, profile_id):
        self._ensure_default(user_id)
        profile = self._profile_sets[user_id].get(profile_id)
        return copy.copy(profile) if profile else None

    def get_active_profile(self, user_id):
        profile_id = self._resolve(user_id, None)
        return copy.copy(self._profile_sets[user_id][profile_id])

    def set_active_profile(self, user_id, profile_id):
        self._ensure_default(user_id)
        if profile_id not in self._profile_sets[user_id]:
            raise ValueError("프로필을 찾을 수 없습니다")
        for current in self._profile_sets[user_id].values():
            current.is_active = current.id == profile_id

    def update_profile(self, user_id, profile_id, name, description):
        profile = self._profile_sets.get(user_id, {}).get(profile_id)
        if profile is None:
            raise ValueError("프로필을 찾을 수 없습니다")
        profile.name = name
        profile.description = description

    def delete_profile(self, user_id, profile_id):
        profiles = self._profile_sets.get(user_id, {})
        profile = profiles.get(profile_id)
        if profile is None:
            raise ValueError("프로필을 찾을 수 없습니다")
        was_active = profile.is_active
        del profiles[profile_id]
        self._items.pop((user_id, profile_id), None)
        if was_active and profiles:
            next(iter(profiles.values())).is_active = True

    # --- items ---
    def save_profile_items(self, user_id, items, profile_id=None):
        resolved = self._resolve(user_id, profile_id)
        bucket = self._items.setdefault((user_id, resolved), {})
        for item in items:
            bucket[item.id] = copy.copy(item)

    def load_profile_items(self, user_id, profile_id=None):
        resolved = self._resolve(user_id, profile_id)
        return [copy.copy(i) for i in self._items.get((user_id, resolved), {}).values()]

    def add_profile_item(self, user_id, item, profile_id=None):
        resolved = self._resolve(user_id, profile_id)
        self._items.setdefault((user_id, resolved), {})[item.id] = copy.copy(item)

    def get_profile_item(self, user_id, item_id, profile_id=None):
        resolved = self._resolve(user_id, profile_id)
        item = self._items.get((user_id, resolved), {}).get(item_id)
        return copy.copy(item) if item else None

    def update_profile_value(self, user_id, item_id, new_value, new_version,
                             profile_id=None):
        resolved = self._resolve(user_id, profile_id)
        item = self._items[(user_id, resolved)][item_id]
        item.value = new_value
        item.version = new_version

    def set_enabled(self, user_id, item_id, enabled, profile_id=None):
        resolved = self._resolve(user_id, profile_id)
        self._items[(user_id, resolved)][item_id].enabled = enabled

    def delete_profile_item(self, user_id, item_id, profile_id=None):
        resolved = self._resolve(user_id, profile_id)
        self._items.get((user_id, resolved), {}).pop(item_id, None)

    # --- interaction / snapshot ---
    def save_interaction(self, interaction_id, user_id, question, intent, state,
                         profile_id=None):
        resolved = self._resolve(user_id, profile_id)
        self._interactions[interaction_id] = {
            "id": interaction_id, "user_id": user_id, "question": question,
            "intent": intent, "state": state, "answer": None,
            "profile_id": resolved,
        }

    def update_state(self, interaction_id, state):
        self._interactions[interaction_id]["state"] = state

    def save_answer(self, interaction_id, answer):
        self._interactions[interaction_id]["answer"] = answer

    def load_interaction(self, interaction_id):
        row = self._interactions.get(interaction_id)
        return dict(row) if row else None

    def list_interactions(self, user_id):
        return [dict(r) for r in self._interactions.values() if r["user_id"] == user_id]

    def save_proposal(self, interaction_id, candidates):
        self._proposals[interaction_id] = [dict(c) for c in candidates]

    def load_proposal(self, interaction_id):
        proposal = self._proposals.get(interaction_id)
        return [dict(c) for c in proposal] if proposal is not None else None

    def save_snapshot(self, snap):
        self._snapshots[snap.interaction_id] = snap

    def load_snapshot(self, interaction_id):
        return self._snapshots.get(interaction_id)
