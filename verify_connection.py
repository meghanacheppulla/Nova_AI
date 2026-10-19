"""
verify_connection.py - Lab aim: Environment & Connectivity check.

1. Checks the Python version and that the required packages are installed.
2. Reads the API key / model settings securely from .env (never printed).
3. Sends a simple "Hello, world!" prompt and prints the model's reply.

Run:  python verify_connection.py
"""
import importlib
import sys

print("=" * 55)
print(" STEP 1: Environment")
print("=" * 55)
print(f"Python version : {sys.version.split()[0]}")

all_ok = True
for pkg in ("flask", "requests", "dotenv", "google.genai"):
    try:
        importlib.import_module(pkg)
        print(f"  [OK]      {pkg}")
    except ImportError:
        all_ok = False
        print(f"  [MISSING] {pkg}   ->  pip install -r requirements.txt")
if not all_ok:
    sys.exit("\nInstall the missing packages and run again.")

import llm  # noqa: E402  (after the package check on purpose)

print("\n" + "=" * 55)
print(" STEP 2: Secure configuration")
print("=" * 55)
print(f"Provider : {llm.provider()}")
print(f"Model    : {llm.model_name()}")
print("API key  : " + ("loaded from .env (hidden)" if llm.provider() == "gemini"
                      else "not needed (local Ollama model)"))
status = llm.health()
print(f"Status   : {'READY' if status['ready'] else 'NOT READY'} - {status['detail']}")

print("\n" + "=" * 55)
print(" STEP 3: Hello, world! prompt")
print("=" * 55)
print("Prompt   : Say 'Hello, world!' and introduce yourself in one sentence.\n")
try:
    reply = "".join(llm.stream_reply(
        [{"role": "user", "content": "Say 'Hello, world!' and introduce yourself in one sentence."}]))
    print("Response :", reply.strip())
    print("\nSUCCESS: model access verified.")
except llm.LLMError as exc:
    print("FAILED   :", exc)
    sys.exit(1)
