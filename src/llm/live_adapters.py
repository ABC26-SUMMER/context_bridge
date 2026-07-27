"""실제 LLM 어댑터 — Gemini 기본, Groq 폴백.

SDK는 실제 호출 시에만 지연 import한다. 키는 환경변수에서만 읽는다.
선택기는 정책이 허용한 후보만 보고 알려진 ID에만 라벨을 매핑한다.
라벨 검증·재시도·안전실패는 ContextRanker가 담당한다.
"""
import json
import os
import re


class LLMConfigurationError(RuntimeError):
    pass


def _strip_fences(text):
    t = text.strip()
    t = re.sub(r"^```(?:json)?", "", t).strip()
    t = re.sub(r"```$", "", t).strip()
    return t


def _require_key(explicit_key, env_name):
    key = explicit_key or os.environ.get(env_name)
    if not key:
        raise LLMConfigurationError(f"{env_name} 환경변수가 설정되지 않았습니다")
    return key


class GeminiComplete:
    """Google GenAI SDK의 generate_content를 사용하는 단일 호출기."""

    def __init__(self, model=None, api_key=None, client_factory=None):
        self.model = model or os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
        self.api_key = api_key
        self.client_factory = client_factory

    def __call__(self, prompt):
        key = _require_key(self.api_key, "GEMINI_API_KEY")
        if self.client_factory:
            client = self.client_factory(key)
        else:
            from google import genai  # 실제 라이브 모드에서만 필요
            client = genai.Client(api_key=key)
        response = client.models.generate_content(model=self.model, contents=prompt)
        text = getattr(response, "text", None)
        if not text:
            raise RuntimeError("Gemini가 빈 응답을 반환했습니다")
        return text


class GroqComplete:
    """Groq Chat Completions 호출기."""

    def __init__(self, model=None, api_key=None, client_factory=None, timeout=30):
        self.model = model or os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.api_key = api_key
        self.client_factory = client_factory
        self.timeout = timeout

    def __call__(self, prompt):
        key = _require_key(self.api_key, "GROQ_API_KEY")
        if self.client_factory:
            client = self.client_factory(key)
        else:
            from groq import Groq  # 실제 라이브 모드에서만 필요
            client = Groq(api_key=key, timeout=self.timeout)
        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.choices[0].message.content
        if not text:
            raise RuntimeError("Groq가 빈 응답을 반환했습니다")
        return text


class FallbackComplete:
    """기본 provider 실패 시 폴백 provider를 한 번 호출한다."""

    def __init__(self, primary, fallback):
        self.primary = primary
        self.fallback = fallback

    def __call__(self, prompt):
        try:
            return self.primary(prompt)
        except Exception as primary_error:
            try:
                return self.fallback(prompt)
            except Exception as fallback_error:
                raise RuntimeError(
                    f"Gemini와 Groq 호출이 모두 실패했습니다: "
                    f"{type(primary_error).__name__} / {type(fallback_error).__name__}"
                ) from fallback_error


_SELECTOR_INSTR = (
    '아래 질문에 각 카드가 관련 있는지 판정해 JSON만 출력하라. '
    '형식: {"카드ID": "relevant|irrelevant|uncertain"}. 다른 설명 금지.'
)


class LiveCardSelector:
    def __init__(self, complete):
        self._complete = complete

    def rank_candidates(self, question, candidates):
        listing = "\n".join(
            f'- {c["id"]}: [{c["category"]}] {c["value"]}' for c in candidates
        )
        prompt = f"{_SELECTOR_INSTR}\n\n질문: {question}\n카드:\n{listing}"
        data = json.loads(_strip_fences(self._complete(prompt)))
        return {c["id"]: data.get(c["id"], "uncertain") for c in candidates}


class LiveAnswerGenerator:
    def __init__(self, complete):
        self._complete = complete

    def generate(self, prompt):
        return self._complete(prompt)


def build_live_gateways(mode="gemini"):
    """provider 모드에 맞는 Ranker/Generator 게이트웨이를 만든다."""
    if mode == "groq":
        complete = GroqComplete()
    elif mode in ("gemini", "live", "auto"):
        complete = FallbackComplete(GeminiComplete(), GroqComplete())
    else:
        raise LLMConfigurationError(f"지원하지 않는 CB_LLM 모드: {mode}")
    return LiveCardSelector(complete), LiveAnswerGenerator(complete)
