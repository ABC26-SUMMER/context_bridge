"""허용 후보 내 관련성 순위화. LLM은 candidate id에 라벨만 부여(candidate_id_only).
잘못된 출력은 재시도 1회 후 안전 실패. 재시도가 후보 집합을 넓히지 않는다."""
from pydantic import BaseModel, field_validator
from .models import Candidate

ALLOWED_LABELS = {"relevant", "irrelevant", "uncertain"}

class RankerSafeFail(Exception):
    pass

class _RankOutput(BaseModel):
    labels: dict
    @field_validator("labels")
    @classmethod
    def _check(cls, v):
        if not isinstance(v, dict) or not v:
            raise ValueError("labels must be non-empty dict")
        for lab in v.values():
            if lab not in ALLOWED_LABELS:
                raise ValueError(f"invalid label: {lab}")
        return v

class ContextRanker:
    def __init__(self, gateway):
        self.gw = gateway

    def rank(self, question, candidates):
        payload = [{"id": c.item_id, "category": c.category, "value": c.value}
                   for c in candidates]                 # 고정 — 재시도에도 이 집합만 사용
        valid = {c.item_id for c in candidates}
        labels = self._call_validated(question, payload)  # 재시도/안전실패 내부 처리
        by_id = {c.item_id: c for c in candidates}
        out = []
        for cid, lab in labels.items():
            if cid not in valid:            # 후보 밖 id 거부 (REQ-2)
                continue
            if lab == "irrelevant":
                continue
            c = by_id[cid]
            checked = (lab == "relevant") and (c.sensitivity == "normal")  # uncertain/sensitive는 해제
            out.append(Candidate(c.item_id, c.category, c.value, c.sensitivity, c.reason_code, checked))
        return out

    def _call_validated(self, question, payload):
        for attempt in range(2):            # 최초 + 재시도 1회
            try:
                raw = self.gw.rank_candidates(question, payload)  # 항상 같은 후보 집합
                return _RankOutput(labels=raw).labels
            except RankerSafeFail:
                raise
            except Exception:
                if attempt == 1:
                    raise RankerSafeFail("ranker output invalid after retry")
        raise RankerSafeFail("unreachable")
