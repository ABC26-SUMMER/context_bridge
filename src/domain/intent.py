"""의도·필수 슬롯 분석. 지원 3개 밖이면 unsupported. clarification 최대 1회."""
from dataclasses import dataclass

INTENT_KEYWORDS = {
    "study_plan":        ["공부", "학습", "스터디", "방학에 뭐"],
    "outing_plan":       ["만나", "외출", "놀러", "어디 가", "데이트"],
    "how_to_explanation":["방법", "어떻게", "알려줘", "하는 법", "연결하는 법"],
}
REQUIRED_SLOT_KEYWORDS = {          # 필수 슬롯이 질문에 채워졌는지 판단하는 신호
    "study_plan":  ["목표", "되려", "엔지니어", "취업", "자격증", "위해"],   # goal
    "outing_plan": ["에서", "동네", "지역", "근처", "역"],                    # region
    "how_to_explanation": [],       # task는 질문 자체로 충족
}

@dataclass
class IntentResult:
    intent: str | None
    unsupported: bool
    needs_clarification: bool
    missing_slots: list

def _match_intent(q):
    for name, kws in INTENT_KEYWORDS.items():
        if any(k in q for k in kws):
            return name
    return None

class IntentAnalyzer:
    def analyze(self, question, clarification_round=0):
        intent = _match_intent(question)
        if intent is None:
            return IntentResult(None, True, False, [])
        slot_kws = REQUIRED_SLOT_KEYWORDS.get(intent, [])
        slot_filled = (not slot_kws) or any(k in question for k in slot_kws)
        if not slot_filled:
            if clarification_round >= 1:            # 최대 1회 후에도 부족 → unsupported
                return IntentResult(intent, True, False, ["goal"])
            return IntentResult(intent, False, True, ["goal"])
        return IntentResult(intent, False, False, [])
