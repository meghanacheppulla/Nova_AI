"""
llm.py - one tiny wrapper around the two supported model back-ends.

  * Ollama  (default)  -> runs locally, no API key required
  * Gemini  (optional) -> used automatically when GEMINI_API_KEY is set in .env

The API key is read from the environment / .env file only. It is never
hard-coded, never sent to the browser and never logged.
"""
import json
import os
from typing import Dict, Iterator, List

import requests
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = (
    "You are a friendly, accurate AI assistant. Answer clearly and concisely. "
    "Use Markdown (lists, **bold**, code blocks) when it helps readability."
)


class LLMError(Exception):
    """Raised with a human-friendly message when the model cannot be reached."""


# ----------------------------------------------------------------- settings
def provider() -> str:
    return "gemini" if os.getenv("GEMINI_API_KEY", "").strip() else "ollama"


def model_name() -> str:
    if provider() == "gemini":
        return os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    return os.getenv("OLLAMA_MODEL", "llama3.2")


def _ollama_url() -> str:
    return os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")


# ------------------------------------------------------------------- health
def health() -> Dict:
    """Cheap connectivity check used by the status badge in the UI."""
    info = {"provider": provider(), "model": model_name(), "ready": False, "detail": ""}
    if info["provider"] == "gemini":
        info["ready"] = True
        info["detail"] = "Gemini API key found."
        return info
    try:
        r = requests.get(f"{_ollama_url()}/api/tags", timeout=3)
        r.raise_for_status()
        names = [m.get("name", "") for m in r.json().get("models", [])]
        if any(n.split(":")[0] == info["model"].split(":")[0] for n in names):
            info["ready"] = True
            info["detail"] = "Ollama is running."
        else:
            info["detail"] = f"Model not found. Run: ollama pull {info['model']}"
    except requests.RequestException:
        info["detail"] = "Ollama is not running. Start it with: ollama serve"
    return info


# ----------------------------------------------------------------- streaming
def stream_reply(messages: List[Dict[str, str]]) -> Iterator[str]:
    """Yield the assistant reply in small text chunks."""
    if provider() == "gemini":
        yield from _stream_gemini(messages)
    else:
        yield from _stream_ollama(messages)


def _stream_ollama(messages) -> Iterator[str]:
    payload = {
        "model": model_name(),
        "stream": True,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
    }
    try:
        with requests.post(
            f"{_ollama_url()}/api/chat", json=payload, stream=True, timeout=(5, 300)
        ) as r:
            if r.status_code == 404:
                raise LLMError(f"Model '{model_name()}' not found. Run: ollama pull {model_name()}")
            r.raise_for_status()
            for line in r.iter_lines():
                if not line:
                    continue
                data = json.loads(line)
                chunk = data.get("message", {}).get("content", "")
                if chunk:
                    yield chunk
                if data.get("done"):
                    break
    except requests.ConnectionError:
        raise LLMError("Cannot reach Ollama. Start it with `ollama serve` and try again.")
    except requests.RequestException as exc:
        raise LLMError(f"Ollama request failed: {exc}")


def _stream_gemini(messages) -> Iterator[str]:
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise LLMError("Package missing. Run: pip install google-genai")

    try:
        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"].strip())
        contents = [
            types.Content(
                role="model" if m["role"] == "assistant" else "user",
                parts=[types.Part.from_text(text=m["content"])],
            )
            for m in messages
        ]
        stream = client.models.generate_content_stream(
            model=model_name(),
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        )
        for chunk in stream:
            if chunk.text:
                yield chunk.text
    except Exception as exc:  # SDK raises several different error types
        raise LLMError(f"Gemini error: {exc}")
