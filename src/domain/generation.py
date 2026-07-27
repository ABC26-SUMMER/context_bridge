"""응답 생성 서비스. 승인 스냅샷만 입력받아(INV-3) APPROVED→GENERATING→ANSWERED 전이.
생성 전 무결성 검문, 실패 시 FAILED로 안전 전이."""
from dataclasses import dataclass
from .approval import recompute_hash
from .composer import compose_prompt_from_snapshot

class GenerationSafeFail(Exception):
    pass

class IntegrityError(Exception):
    pass

@dataclass
class GenerationResult:
    answer: str
    snapshot_hash: str
    input_context_hash: str

class GenerationService:
    def __init__(self, generator):
        self.gen = generator

    def run(self, question, snapshot, state_machine):
        # 생성 전 무결성: 스냅샷 항목으로 재계산한 해시가 저장 해시와 일치해야 함 (REQ-3)
        input_hash = recompute_hash(snapshot.items)
        if input_hash != snapshot.snapshot_hash:
            raise IntegrityError("승인 스냅샷 해시 불일치 — 생성 중단")

        state_machine.to("GENERATING")      # APPROVED에서만 허용 (INV-6). 아니면 IllegalTransition
        prompt = compose_prompt_from_snapshot(question, snapshot)  # 스냅샷만으로 구성
        try:
            answer = self.gen.generate(prompt)
        except Exception as e:
            state_machine.to("FAILED")       # 안전 상태로 전이
            raise GenerationSafeFail(str(e))

        state_machine.to("ANSWERED")
        return GenerationResult(answer, snapshot.snapshot_hash, input_hash)
