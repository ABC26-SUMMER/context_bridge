import pytest

from llm.live_adapters import (
    FallbackComplete,
    GroqComplete,
    LLMConfigurationError,
    build_live_gateways,
)


def test_gemini_mode_builds_gemini_with_groq_fallback():
    ranker, generator = build_live_gateways("gemini")
    assert isinstance(ranker._complete, FallbackComplete)
    assert generator._complete is ranker._complete


def test_groq_mode_builds_groq_only():
    ranker, generator = build_live_gateways("groq")
    assert isinstance(ranker._complete, GroqComplete)
    assert generator._complete is ranker._complete


def test_unknown_live_mode_is_rejected():
    with pytest.raises(LLMConfigurationError, match="지원하지 않는"):
        build_live_gateways("anthropic")
