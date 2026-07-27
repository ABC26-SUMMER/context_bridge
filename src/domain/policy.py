"""정책 우선 Context Selection. LLM 이전에 규칙으로 후보를 제한한다.
context-policy.yaml 이 단일 진실원천 (INV-2, INV-4)."""
import yaml
from .models import Candidate

class UnsupportedIntent(Exception):
    pass

class UnknownCategory(Exception):
    pass

class PolicyEngine:
    def __init__(self, policy: dict):
        self.p = policy
        # category -> reason_code (normal 범주용 역인덱스)
        self._cat_reason = {}
        for code, spec in policy.get("reason_codes", {}).items():
            for cat in spec.get("applies_to", []):
                self._cat_reason[cat] = code

    @classmethod
    def from_yaml(cls, path):
        with open(path, encoding="utf-8") as f:
            return cls(yaml.safe_load(f))

    def sensitivity_of(self, category):
        pc = self.p.get("profile_categories", {}).get(category)
        if pc is None:
            raise UnknownCategory(category)   # 정책 밖 → fail closed (REQ-18)
        return pc.get("sensitivity", "normal")

    def propose(self, intent, profile_items):
        intents = self.p.get("intents", {})
        if intent not in intents:
            raise UnsupportedIntent(intent)
        spec = intents[intent]
        allowed = set(spec.get("allowed_categories", []))
        purpose = {r["category"]: r for r in spec.get("sensitive_purpose_rules", [])}

        out = []
        for it in profile_items:
            if not it.enabled:
                continue
            if it.sensitivity == "restricted":       # INV-4: 절대 자동 후보 금지
                continue
            if it.sensitivity == "normal":
                if it.category in allowed:
                    out.append(Candidate(it.id, it.category, it.value, it.sensitivity,
                                         self._cat_reason.get(it.category, "UNSPECIFIED"), True))
            elif it.sensitivity == "sensitive":
                rule = purpose.get(it.category)       # 목적 규칙 있을 때만
                if rule:
                    out.append(Candidate(it.id, it.category, it.value, it.sensitivity,
                                         rule["reason_code"], False))  # 기본 해제
        return out

    def validate_llm_ids(self, candidates, requested_ids):
        """LLM이 반환한 id 중 실제 후보 집합 안에 있는 것만 유지 (INV-2)."""
        valid = {c.item_id for c in candidates}
        return [c for c in candidates if c.item_id in requested_ids and c.item_id in valid]
