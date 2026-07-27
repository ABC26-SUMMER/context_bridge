"""테스트/CI용 Fake 게이트웨이. rank_candidates(question, candidates) — candidates=[{id,category,value}]."""
class FakeRanker:
    def __init__(self, mapping): self.mapping = mapping
    def rank_candidates(self, question, candidates): return dict(self.mapping)

class TimeoutRanker:
    def rank_candidates(self, question, candidates): raise TimeoutError("llm timeout")

class BadOutputRanker:
    def __init__(self): self.calls = 0
    def rank_candidates(self, question, candidates):
        self.calls += 1
        return {candidates[0]["id"]: "definitely_not_a_label"}

class SpyRanker:
    """호출마다 전달된 id 집합 기록. 잘못된 출력으로 재시도 유발."""
    def __init__(self): self.seen_id_sets = []
    def rank_candidates(self, question, candidates):
        self.seen_id_sets.append({c["id"] for c in candidates})
        return {"p1": "not_a_valid_label"}

class DefaultRelevantRanker:
    """모든 후보를 relevant(오프라인 스켈레톤/데모용)."""
    def rank_candidates(self, question, candidates):
        return {c["id"]: "relevant" for c in candidates}

class FakeGenerator:
    def generate(self, prompt): return "개인화 답변(테스트): " + prompt[:20]

class TimeoutGenerator:
    def generate(self, prompt): raise TimeoutError("generation timeout")

class SpyGenerator:
    def __init__(self): self.last_prompt = None
    def generate(self, prompt):
        self.last_prompt = prompt
        return "ok"
