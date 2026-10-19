# Nova AI Chat (Flask)

A Gemini-style chat web app built with **Flask + vanilla JS**, created for the lab aim:

> **Environment & Connectivity** - install required packages, configure the API key securely,
> and run a simple "Hello, world" prompt to verify model access.

## Features
- Streaming replies, Markdown + code blocks, copy button, stop button
- Sidebar with recent chats, search, delete (saved in the browser)
- Light / dark theme, responsive layout, live model status badge
- Two back-ends: **Ollama (local, no API key)** or **Google Gemini (API key in `.env`)**

## 1. Setup (Windows / Linux / Mac)
```bash
python -m venv .venv
.venv\Scripts\activate          # Windows   (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
```

## 2. Choose a model

**Option A - Ollama (no API key):**
```bash
ollama pull llama3.2
ollama serve        # skip if the Ollama app is already running
```

**Option B - Gemini (secure API key):**
1. Copy `.env.example` to `.env`
2. Put your key in `GEMINI_API_KEY=...`  (the key stays on the server; `.env` is git-ignored)

## 3. Verify connectivity ("Hello, world")
```bash
python verify_connection.py
```

## 4. Run the app
```bash
python app.py
```
Open **http://localhost:3000**

(Shortcut: double-click `run.bat` on Windows or run `./run.sh` on Linux/Mac.)

## Project structure
```
app.py                 Flask server (routes, streaming)
llm.py                 Ollama + Gemini wrapper, health check
verify_connection.py   Lab "Hello, world" check
templates/index.html   Page layout
static/style.css       Theme and layout
static/app.js          Chat logic
```

## Troubleshooting
| Problem | Fix |
|---|---|
| Badge says "Offline" | Start Ollama (`ollama serve`) or add a Gemini key to `.env` |
| `model not found` | `ollama pull llama3.2` |
| Port 3000 busy | Set `PORT=5000` in `.env` |
