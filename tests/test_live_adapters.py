"""실제 LLM 어댑터의 파싱·통합 로직 검증(네트워크 없음)."""
from types import SimpleNamespace

import pytest

from llm.live_adapters import (
    FallbackComplete,
    GeminiComplete,
    GroqComplete,
    LLMConfigurationError,
    LiveCardSelector,
    LiveAnswerGenerator,
)
from domain.ranker import ContextRanker
from domain.models import Candidate

def cards(*ids):
    return [{"id": i, "category": "c", "value": "v"} for i in ids]

def test_selector_keeps_only_known_ids():
    sel = LiveCardSelector(complete=lambda p: '{"p1":"relevant","p2":"irrelevant","pX":"relevant"}')
    out = sel.rank_candidates("q", cards("p1", "p2"))
    assert out == {"p1": "relevant", "p2": "irrelevant"}   # pX(후보 밖) 무시

def test_selector_defaults_missing_to_uncertain():
    sel = LiveCardSelector(complete=lambda p: '{"p1":"relevant"}')
    out = sel.rank_candidates("q", cards("p1", "p2"))
    assert out["p2"] == "uncertain"

def test_selector_strips_code_fences():
    sel = LiveCardSelector(complete=lambda p: '```json\n{"p1":"relevant"}\n```')
    assert sel.rank_candidates("q", cards("p1")) == {"p1": "relevant"}

def test_generator_returns_text():
    gen = LiveAnswerGenerator(complete=lambda p: "4주 계획입니다")
    assert gen.generate("prompt") == "4주 계획입니다"

def test_selector_drives_context_ranker():
    sel = LiveCardSelector(complete=lambda p: '{"p1":"relevant","p2":"irrelevant"}')
    cands = [Candidate("p1","education.major","AISW","normal","MAJOR_CONTEXT",True),
             Candidate("p2","preferences.food","매운맛","normal","FOOD_PREFERENCE",True)]
    out = ContextRanker(sel).rank("q", cands)
    assert {c.item_id for c in out} == {"p1"}   # 선택기 판정이 실제 후보 필터로 이어짐


def test_gemini_complete_uses_configured_model():
    seen = {}

    class Models:
        def generate_content(self, model, contents):
            seen.update(model=model, contents=contents)
            return SimpleNamespace(text="Gemini 응답")

    complete = GeminiComplete(
        model="gemini-test",
        api_key="test-key",
        client_factory=lambda key: SimpleNamespace(models=Models()),
    )
    assert complete("질문") == "Gemini 응답"
    assert seen == {"model": "gemini-test", "contents": "질문"}


def test_groq_complete_uses_configured_model():
    seen = {}

    class Completions:
        def create(self, model, messages):
            seen.update(model=model, messages=messages)
            message = SimpleNamespace(content="Groq 응답")
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    client = SimpleNamespace(chat=SimpleNamespace(completions=Completions()))
    complete = GroqComplete(
        model="groq-test",
        api_key="test-key",
        client_factory=lambda key: client,
    )
    assert complete("질문") == "Groq 응답"
    assert seen["model"] == "groq-test"


def test_fallback_uses_groq_only_after_gemini_failure():
    calls = []

    def primary(prompt):
        calls.append("gemini")
        raise TimeoutError("quota")

    def fallback(prompt):
        calls.append("groq")
        return "폴백 응답"

    assert FallbackComplete(primary, fallback)("질문") == "폴백 응답"
    assert calls == ["gemini", "groq"]


def test_fallback_does_not_call_groq_when_gemini_succeeds():
    calls = []
    complete = FallbackComplete(
        lambda prompt: "Gemini 응답",
        lambda prompt: calls.append("groq"),
    )
    assert complete("질문") == "Gemini 응답"
    assert calls == []


def test_missing_provider_key_is_explicit(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(LLMConfigurationError, match="GEMINI_API_KEY"):
        GeminiComplete()("질문")
