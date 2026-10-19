/* Nova AI front-end: chat history lives in localStorage, replies stream from /api/chat */
const $ = (s) => document.querySelector(s);
const ERR_MARK = "\u0000ERR:";
const KEY = "GEMINI.chats", THEME = "nova.theme";

let chats = JSON.parse(localStorage.getItem(KEY) || "[]");
let activeId = chats.length ? chats[0].id : null;
let busy = false, controller = null;

const el = {
  list: $("#chatList"), msgs: $("#messages"), welcome: $("#welcome"), stage: $("#stage"),
  input: $("#input"), send: $("#send"), title: $("#title"), search: $("#search"),
  badge: $("#badge"), badgeText: $("#badgeText"), sidebar: $("#sidebar"),
};

const save = () => localStorage.setItem(KEY, JSON.stringify(chats));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const active = () => chats.find((c) => c.id === activeId);
const esc = (t) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = (t) => (window.marked && window.DOMPurify)
  ? DOMPurify.sanitize(marked.parse(t)) : esc(t).replace(/\n/g, "<br>");
const scrollDown = () => (el.stage.scrollTop = el.stage.scrollHeight);

function copyBtn(getText) {
  const b = document.createElement("button");
  b.className = "copy"; b.textContent = "Copy";
  b.onclick = () => {
    navigator.clipboard.writeText(getText());
    b.textContent = "Copied!"; setTimeout(() => (b.textContent = "Copy"), 1200);
  };
  return b;
}

/* ---------- sidebar ---------- */
function renderList() {
  const q = el.search.value.trim().toLowerCase();
  const shown = chats.filter((c) => c.title.toLowerCase().includes(q));
  el.list.innerHTML = "";
  if (!shown.length) {
    el.list.innerHTML = `<li class="empty">${q ? "No matches" : "No chats yet"}</li>`;
    return;
  }
  shown.forEach((c) => {
    const li = document.createElement("li");
    if (c.id === activeId) li.className = "active";
    li.innerHTML = `<span>${esc(c.title)}</span><button class="del" title="Delete">&times;</button>`;
    li.onclick = () => { if (!busy) { activeId = c.id; render(); el.sidebar.classList.remove("open"); } };
    li.querySelector(".del").onclick = (e) => {
      e.stopPropagation();
      if (busy) return;
      chats = chats.filter((x) => x.id !== c.id);
      if (activeId === c.id) activeId = chats.length ? chats[0].id : null;
      save(); render();
    };
    el.list.appendChild(li);
  });
}

/* ---------- messages ---------- */
function addMsg(role, text, opts = {}) {
  const bot = role === "assistant";
  const row = document.createElement("div");
  row.className = "msg " + (bot ? "bot" : "user");
  row.innerHTML = `
    <div class="av">${bot ? "AI" : "U"}</div>
    <div class="col"><span class="who">${bot ? "GEMINI AI" : "You"}</span>
      <div class="bubble${opts.error ? " error" : ""}"></div></div>`;
  const bubble = row.querySelector(".bubble");
  if (opts.typing) bubble.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  else if (bot && !opts.error) bubble.innerHTML = md(text);
  else bubble.textContent = text;
  if (bot && !opts.typing && !opts.error) row.querySelector(".col").appendChild(copyBtn(() => text));
  el.msgs.appendChild(row);
  scrollDown();
  return { row, bubble };
}

function render() {
  const c = active();
  el.msgs.innerHTML = "";
  el.title.textContent = c ? c.title : "New Chat";
  el.welcome.style.display = c && c.messages.length ? "none" : "block";
  if (c) c.messages.forEach((m) => addMsg(m.role, m.content));
  renderList();
}

/* ---------- sending ---------- */
function setBusy(b) {
  busy = b;
  el.send.innerHTML = b ? "&#9632;" : "&#10148;";
  el.send.classList.toggle("stop", b);
  el.send.title = b ? "Stop" : "Send";
}

async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  if (!active()) {
    const c = { id: uid(), title: "New Chat", messages: [] };
    chats.unshift(c); activeId = c.id;
  }
  const chat = active();
  chat.messages.push({ role: "user", content: text });
  if (chat.messages.length === 1) chat.title = text.length > 32 ? text.slice(0, 32) + "..." : text;

  el.welcome.style.display = "none";
  el.title.textContent = chat.title;
  el.input.value = ""; autosize();
  addMsg("user", text);
  const bot = addMsg("assistant", "", { typing: true });
  renderList(); setBusy(true);

  let buf = "", failed = null;
  controller = new AbortController();
  try {
    const res = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chat.messages }), signal: controller.signal,
    });
    if (!res.ok) throw new Error((await res.json()).error || "Server error");
    const reader = res.body.getReader(), dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const i = buf.indexOf(ERR_MARK);
      if (i !== -1) { failed = buf.slice(i + ERR_MARK.length); buf = buf.slice(0, i); break; }
      bot.bubble.innerHTML = md(buf); scrollDown();
    }
  } catch (e) {
    if (e.name !== "AbortError") failed = e.message;
  }

  if (failed) {                                   // show the error, roll the question back
    bot.row.remove();
    addMsg("assistant", failed, { error: true });
    chat.messages.pop(); el.input.value = text; autosize();
  } else if (buf.trim()) {
    chat.messages.push({ role: "assistant", content: buf });
    bot.bubble.innerHTML = md(buf);
    bot.row.querySelector(".col").appendChild(copyBtn(() => buf));
  } else {                                        // stopped before any text arrived
    bot.row.remove(); chat.messages.pop();
  }
  save(); setBusy(false); controller = null; renderList();
}

/* ---------- wiring ---------- */
function autosize() { el.input.style.height = "auto"; el.input.style.height = Math.min(el.input.scrollHeight, 160) + "px"; }
el.input.addEventListener("input", autosize);
el.input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(el.input.value); } });
el.send.onclick = () => (busy ? controller && controller.abort() : send(el.input.value));
$("#newChat").onclick = () => { if (busy) return; activeId = null; render(); el.input.focus(); el.sidebar.classList.remove("open"); };
$("#clearAll").onclick = () => { if (!busy && chats.length && confirm("Delete all chats?")) { chats = []; activeId = null; save(); render(); } };
$("#menu").onclick = () => el.sidebar.classList.toggle("open");
el.search.oninput = renderList;
document.querySelectorAll(".card").forEach((c) => (c.onclick = () => send(c.dataset.p)));

$("#theme").onclick = () => {
  const dark = document.body.classList.toggle("dark");
  localStorage.setItem(THEME, dark ? "dark" : "light");
};
if (localStorage.getItem(THEME) === "dark") document.body.classList.add("dark");

async function checkHealth() {
  try {
    const h = await (await fetch("/api/health")).json();
    el.badgeText.textContent = h.ready ? h.model : "Offline";
    el.badge.className = "badge " + (h.ready ? "ok" : "bad");
    el.badge.title = h.detail;
  } catch { el.badgeText.textContent = "Server down"; el.badge.className = "badge bad"; }
}
checkHealth(); setInterval(checkHealth, 20000);
render();
