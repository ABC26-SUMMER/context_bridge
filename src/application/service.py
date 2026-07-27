"""Application Service — UI의 유일한 진입점. 도메인·정책·저장소·게이트웨이를 조율한다.
UI는 이 클래스만 호출하며 SQLite/LLM을 직접 만지지 않는다 (G2)."""
from dataclasses import dataclass, field
import uuid
from domain.models import ProfileItem, UserProfile
from domain.intent import IntentAnalyzer
from domain.policy import PolicyEngine
from domain.ranker import ContextRanker
from domain.approval import build_snapshot
from domain.composer import compose_prompt
from domain.generation import GenerationService
from domain.state_machine import StateMachine

@dataclass
class AskResult:
    interaction_id: str
    state: str
    intent: str | None
    candidates: list = field(default_factory=list)
    total_cards: int = 0        # 전체 카드
    policy_allowed: int = 0     # 정책 허용
    question_related: int = 0   # 질문 관련(랭커 통과)
    profile_id: str | None = None

@dataclass
class ApproveResult:
    interaction_id: str
    answer: str
    snapshot_hash: str
    input_context_hash: str

@dataclass
class ComparisonResult:
    interaction_id: str
    general_answer: str          # 카드 없는 baseline
    personalized_answer: str     # 승인 스냅샷 반영
    snapshot_hash: str
    input_context_hash: str

class ApprovalError(Exception):
    pass

class ProfileError(Exception):
    pass

class ApplicationService:
    def __init__(self, repo, ranker_gateway, generator_gateway, policy_path):
        self.repo = repo
        self.ranker_gw = ranker_gateway
        self.generator_gw = generator_gateway
        self.policy = PolicyEngine.from_yaml(policy_path)
        self.intent = IntentAnalyzer()

    # --- 상황 프로필 CRUD (REQ-19) ---
    def list_profiles(self, user_id):
        return self.repo.list_profiles(user_id)

    def active_profile(self, user_id):
        return self.repo.get_active_profile(user_id)

    def create_profile(self, user_id, name, description="", icon="🧭"):
        clean_name = (name or "").strip()
        if not clean_name:
            raise ProfileError("프로필 이름을 입력해주세요")
        if any(p.name.casefold() == clean_name.casefold()
               for p in self.repo.list_profiles(user_id)):
            raise ProfileError("이미 같은 이름의 프로필이 있습니다")
        profile = UserProfile(
            uuid.uuid4().hex[:8], clean_name, (description or "").strip(),
            icon or "🧭", True,
        )
        self.repo.create_profile(user_id, profile)
        return profile

    def select_profile(self, user_id, profile_id):
        self.repo.set_active_profile(user_id, profile_id)
        return self.repo.get_active_profile(user_id)

    def update_profile(self, user_id, profile_id, name, description=""):
        clean_name = (name or "").strip()
        if not clean_name:
            raise ProfileError("프로필 이름을 입력해주세요")
        others = [p for p in self.repo.list_profiles(user_id) if p.id != profile_id]
        if any(p.name.casefold() == clean_name.casefold() for p in others):
            raise ProfileError("이미 같은 이름의 프로필이 있습니다")
        self.repo.update_profile(
            user_id, profile_id, clean_name, (description or "").strip()
        )

    def delete_profile(self, user_id, profile_id):
        profiles = self.repo.list_profiles(user_id)
        if len(profiles) <= 1:
            raise ProfileError("마지막 프로필은 삭제할 수 없습니다")
        if not any(p.id == profile_id for p in profiles):
            raise ProfileError("프로필을 찾을 수 없습니다")
        self.repo.delete_profile(user_id, profile_id)
        return self.repo.get_active_profile(user_id)

    # --- 선택한 프로필의 카드 CRUD (앞면 P0) ---
    def add_card(self, user_id, category, value, profile_id=None):
        profile_id = profile_id or self.repo.get_active_profile(user_id).id
        v = (value or "").strip()
        if not v:
            raise ValueError("빈 값은 저장할 수 없습니다")
        sensitivity = self.policy.sensitivity_of(category)   # 정책 등급 강제 (REQ-18)
        if any(i.category == category and i.value == v
               for i in self.repo.load_profile_items(user_id, profile_id)):
            raise ValueError("이미 같은 카드가 있습니다")
        item = ProfileItem(uuid.uuid4().hex[:8], category, v, True, sensitivity, 1)
        self.repo.add_profile_item(user_id, item, profile_id)
        return item

    def edit_card(self, user_id, item_id, new_value, profile_id=None):
        profile_id = profile_id or self.repo.get_active_profile(user_id).id
        v = (new_value or "").strip()
        if not v:
            raise ValueError("빈 값은 저장할 수 없습니다")
        cur = self.repo.get_profile_item(user_id, item_id, profile_id)
        if cur is None:
            raise ValueError("카드를 찾을 수 없습니다")
        self.repo.update_profile_value(
            user_id, item_id, v, cur.version + 1, profile_id
        )  # version↑ (REQ-15)

    def toggle_card(self, user_id, item_id, enabled, profile_id=None):
        profile_id = profile_id or self.repo.get_active_profile(user_id).id
        self.repo.set_enabled(user_id, item_id, enabled, profile_id)

    def delete_card(self, user_id, item_id, profile_id=None):
        profile_id = profile_id or self.repo.get_active_profile(user_id).id
        self.repo.delete_profile_item(user_id, item_id, profile_id)

    def categories(self):
        return sorted(self.policy.p.get("profile_categories", {}).keys())

    def get_profile(self, user_id, profile_id=None):
        return self.repo.load_profile_items(user_id, profile_id)

    def ask(self, user_id, question, interaction_id, profile_id=None):
        profile_id = profile_id or self.repo.get_active_profile(user_id).id
        ir = self.intent.analyze(question)
        if ir.unsupported:
            self.repo.save_interaction(
                interaction_id, user_id, question, ir.intent or "",
                "UNSUPPORTED", profile_id,
            )
            return AskResult(
                interaction_id, "UNSUPPORTED", ir.intent, [], profile_id=profile_id
            )
        profile = self.repo.load_profile_items(user_id, profile_id)
        candidates = self.policy.propose(ir.intent, profile)
        ranked = ContextRanker(self.ranker_gw).rank(question, candidates)
        self.repo.save_interaction(
            interaction_id, user_id, question, ir.intent,
            "AWAITING_APPROVAL", profile_id,
        )
        funnel = dict(total_cards=len(profile), policy_allowed=len(candidates),
                      question_related=len(ranked))
        # 서버가 제안한 후보를 저장한다. 승인 시 클라이언트 값이 아니라 이 저장분으로 재구성한다.
        self.repo.save_proposal(interaction_id, [
            {"id": c.item_id, "profile_id": profile_id,
             "category": c.category, "value": c.value,
             "sensitivity": c.sensitivity, "reason_code": c.reason_code}
            for c in ranked])
        return AskResult(
            interaction_id, "AWAITING_APPROVAL", ir.intent, ranked,
            profile_id=profile_id, **funnel,
        )

    def approve_and_generate(self, interaction_id, approved_ids):
        """클라이언트는 승인한 카드 ID만 보낸다. 서버가 저장된 제안·질문으로 재검증·재구성한다."""
        proposal = self.repo.load_proposal(interaction_id)
        if proposal is None:
            raise ApprovalError("제안 기록이 없습니다")
        by_id = {c["id"]: c for c in proposal}
        for aid in approved_ids:
            if aid not in by_id:                       # 제안되지 않은 ID 거부 (승인 진위)
                raise ApprovalError(f"제안되지 않은 카드: {aid}")
        approved_items = [{"id": by_id[aid]["id"], "category": by_id[aid]["category"],
                           "label": by_id[aid]["category"], "value": by_id[aid]["value"]}
                          for aid in approved_ids]      # 서버 저장 값만 사용
        question = self.repo.load_interaction(interaction_id)["question"]  # 서버 저장 질문

        snap = build_snapshot(interaction_id, approved_items)
        self.repo.save_snapshot(snap)
        sm = StateMachine("AWAITING_APPROVAL")
        sm.to("APPROVED")
        res = GenerationService(self.generator_gw).run(question, snap, sm)
        self.repo.update_state(interaction_id, sm.state)
        self.repo.save_answer(interaction_id, res.answer)
        return ApproveResult(interaction_id, res.answer, res.snapshot_hash, res.input_context_hash)

    def history(self, user_id):
        return self.repo.list_interactions(user_id)

    def reason_text(self, reason_code):
        rc = self.policy.p.get("reason_codes", {}).get(reason_code)
        return rc["template"] if rc else ""

    def approve_and_compare(self, interaction_id, approved_ids):
        """데모/평가 모드(R-06): 개인화 답변 + 카드 없는 일반 답변을 함께 생성.
        승인 경계(ID-only 서버 재검증)는 approve_and_generate를 그대로 재사용해 지킨다."""
        personalized = self.approve_and_generate(interaction_id, approved_ids)
        question = self.repo.load_interaction(interaction_id)["question"]
        general = self.generator_gw.generate(compose_prompt(question, []))  # 카드 0개 baseline
        return ComparisonResult(interaction_id, general, personalized.answer,
                                personalized.snapshot_hash, personalized.input_context_hash)

    def recover(self, interaction_id):
        """새로고침 시 DB 기준 상태 복구 (REQ-7)."""
        return self.repo.load_interaction(interaction_id)
