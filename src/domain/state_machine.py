"""중앙 상태 머신 (INV-6). 금지 전이는 코드로 차단한다."""

class IllegalTransition(Exception):
    def __init__(self, src, dst):
        super().__init__(f"금지된 상태 전이: {src} -> {dst}")
        self.src, self.dst = src, dst

ALLOWED = {
    "QUESTION_RECEIVED":      {"CONTEXT_PROPOSED", "CLARIFICATION_REQUIRED"},
    "CLARIFICATION_REQUIRED": {"QUESTION_RECEIVED"},
    "CONTEXT_PROPOSED":       {"AWAITING_APPROVAL"},
    "AWAITING_APPROVAL":      {"APPROVED", "CANCELLED"},
    "APPROVED":               {"GENERATING"},
    "GENERATING":             {"ANSWERED", "FAILED"},
    "ANSWERED":               {"MEMORY_REVIEW", "COMPLETED"},
    "MEMORY_REVIEW":          {"COMPLETED"},
    "FAILED":                 {"CANCELLED"},
}

class StateMachine:
    def __init__(self, state="QUESTION_RECEIVED"):
        self.state = state
    def can(self, target):
        return target in ALLOWED.get(self.state, set())
    def to(self, target):
        if not self.can(target):
            raise IllegalTransition(self.state, target)
        self.state = target
        return self.state
