"""
app.py - Flask server for the Nova AI chat app.

Run:  python app.py      then open  http://localhost:3000
"""
import os

from flask import Flask, Response, jsonify, render_template, request, stream_with_context

import llm

APP_NAME = "GEMINI AI"
ERR_MARK = "\x00ERR:"          # lets the browser tell an error from normal text
MAX_TURNS = 20                 # how much history is sent to the model

app = Flask(__name__)


def clean_history(raw):
    """Keep only valid {role, content} pairs from the browser."""
    out = []
    for m in raw if isinstance(raw, list) else []:
        role, content = m.get("role"), m.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            out.append({"role": role, "content": content})
    return out[-MAX_TURNS:]


@app.get("/")
def index():
    return render_template("index.html", app_name=APP_NAME)


@app.get("/api/health")
def health():
    return jsonify(llm.health())


@app.post("/api/chat")
def chat():
    data = request.get_json(silent=True) or {}
    messages = clean_history(data.get("messages"))
    if not messages or messages[-1]["role"] != "user":
        return jsonify(error="Send at least one user message."), 400

    def generate():
        try:
            for chunk in llm.stream_reply(messages):
                yield chunk
        except llm.LLMError as exc:
            yield ERR_MARK + str(exc)

    return Response(stream_with_context(generate()), mimetype="text/plain; charset=utf-8",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    print(f"\n  {APP_NAME} running on http://localhost:{port}\n  Provider: {llm.provider()} ({llm.model_name()})\n")
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
