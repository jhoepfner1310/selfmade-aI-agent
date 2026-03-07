/**
 * Chat UI for Selfmade Agent.
 * Handles conversation flow, message display, run polling, and tool log.
 */

const API_BASE = "";
const SESSION_KEY = "agent_session_id";

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

let conversationId = null;
let pendingRunId = null;
let pollInterval = null;

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const welcome = document.getElementById("welcome");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");
const toolLog = document.getElementById("tool-log");
const btnNewChat = document.getElementById("btn-new-chat");
const btnToggleTools = document.getElementById("btn-toggle-tools");
const gmailStatus = document.getElementById("gmail-status");
const gmailLink = document.getElementById("gmail-link");
const conversationList = document.getElementById("conversation-list");

// --- API helpers ---

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { "X-Session-ID": getSessionId() },
  };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = res.ok ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// --- Gmail status ---

async function refreshGmailStatus() {
  try {
    const data = await api("GET", "/auth/gmail/status");
    gmailStatus.textContent = data.hasTokens ? "Gmail verbunden" : "Gmail nicht verbunden";
    gmailStatus.className = "status-badge " + (data.hasTokens ? "connected" : "disconnected");
    gmailLink.style.display = data.configured && !data.hasTokens ? "inline-flex" : "none";
  } catch {
    gmailStatus.textContent = "Status unbekannt";
    gmailStatus.className = "status-badge";
  }
}

// --- Conversation ---

async function createConversation() {
  const conv = await api("POST", "/conversations");
  conversationId = conv.id;
  await refreshConversationList();
  return conv;
}

async function refreshConversationList() {
  try {
    const { conversations } = await api("GET", "/conversations");
    renderConversationList(conversations || []);
  } catch (e) {
    console.error("Failed to load conversation list:", e);
  }
}

function renderConversationList(conversations) {
  conversationList.innerHTML = "";
  conversations.forEach((c) => {
    const item = document.createElement("div");
    item.className = "conversation-item" + (c.id === conversationId ? " active" : "");
    item.dataset.id = c.id;
    const time = new Date(c.createdAt).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    item.innerHTML = `<span>${time}</span>${c.preview ? `<div class="conversation-item-preview">${escapeHtml(c.preview)}</div>` : ""}`;
    item.addEventListener("click", () => switchConversation(c.id));
    conversationList.appendChild(item);
  });
}

async function switchConversation(id) {
  if (id === conversationId) return;
  stopPolling();
  conversationId = id;
  pendingRunId = null;
  toolLog.innerHTML = '<p class="tool-log-empty">Noch keine Tool-Aufrufe.</p>';
  await refreshConversationList();
  await loadConversation();
}

async function loadConversation() {
  if (!conversationId) return;
  const conv = await api("GET", `/conversations/${conversationId}`);
  renderMessages(conv.messages || []);
}

function renderMessages(messages) {
  welcome?.classList.add("hidden");
  const existing = chatMessages.querySelectorAll(".message");
  existing.forEach((el) => el.remove());

  messages.forEach((m) => {
    const div = document.createElement("div");
    div.className = `message message-${m.role}`;
    div.textContent = m.content;
    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = new Date(m.createdAt).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    div.appendChild(meta);
    chatMessages.appendChild(div);
  });

  if (messages.length > 0) welcome?.classList.add("hidden");
  else welcome?.classList.remove("hidden");
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Tool log ---

function appendToolLog(entries) {
  const empty = toolLog.querySelector(".tool-log-empty");
  if (empty) empty.remove();

  entries.forEach((e) => {
    const div = document.createElement("div");
    div.className = "tool-entry " + (e.success ? "" : "error");
    div.innerHTML = `
      <div class="tool-entry-header">
        <span class="tool-name">${escapeHtml(e.tool)}</span>
        <span class="tool-status ${e.success ? "success" : "error"}">${e.success ? "OK" : "Fehler"}</span>
      </div>
      <div class="tool-result">${escapeHtml(String(e.result || "").slice(0, 500))}${String(e.result || "").length > 500 ? "…" : ""}</div>
    `;
    toolLog.appendChild(div);
  });
  toolLog.scrollTop = toolLog.scrollHeight;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// --- Polling ---

function startPolling(runId) {
  if (pollInterval) clearInterval(pollInterval);
  pendingRunId = runId;

  pollInterval = setInterval(async () => {
    try {
      const run = await api("GET", `/runs/${runId}`);
      if (run.status === "completed") {
        stopPolling();
        if (run.result?.toolResults?.length) {
          appendToolLog(run.result.toolResults);
        }
        await loadConversation();
        removeLoadingMessage();
      } else if (run.status === "failed") {
        stopPolling();
        removeLoadingMessage();
        showError(run.error || "Verarbeitung fehlgeschlagen.");
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
  }, 800);
}

function stopPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = null;
  pendingRunId = null;
}

function addLoadingMessage() {
  const div = document.createElement("div");
  div.className = "message message-assistant loading";
  div.id = "msg-loading";
  div.textContent = "Agent denkt nach";
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoadingMessage() {
  document.getElementById("msg-loading")?.remove();
}

function showError(msg) {
  const div = document.createElement("div");
  div.className = "message message-assistant error";
  div.textContent = "Fehler: " + msg;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Send message ---

async function sendMessage(text) {
  if (!text.trim()) return;
  if (!conversationId) await createConversation();

  const userDiv = document.createElement("div");
  userDiv.className = "message message-user";
  userDiv.textContent = text.trim();
  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  userDiv.appendChild(meta);
  welcome?.classList.add("hidden");
  chatMessages.appendChild(userDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  chatInput.value = "";
  chatInput.style.height = "auto";
  btnSend.disabled = true;

  try {
    const { runId } = await api("POST", `/conversations/${conversationId}/messages`, {
      userText: text.trim(),
    });
    addLoadingMessage();
    startPolling(runId);
  } catch (e) {
    removeLoadingMessage();
    showError(e.message || "Nachricht konnte nicht gesendet werden.");
  } finally {
    btnSend.disabled = false;
  }
}

// --- New chat ---

async function newChat() {
  stopPolling();
  conversationId = null;
  pendingRunId = null;
  renderMessages([]);
  welcome?.classList.remove("hidden");
  toolLog.innerHTML = '<p class="tool-log-empty">Noch keine Tool-Aufrufe.</p>';
  await createConversation();
}

// --- Toggle tool log (mobile) ---

function toggleToolLog() {
  document.querySelector(".tool-log-section").classList.toggle("collapsed");
}

// --- Event listeners ---

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(chatInput.value);
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(chatInput.value);
  }
});

chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";
});

btnNewChat.addEventListener("click", newChat);
btnToggleTools.addEventListener("click", toggleToolLog);

// --- Init ---

(async () => {
  try {
    const { conversations } = await api("GET", "/conversations");
    if (conversations?.length > 0) {
      conversationId = conversations[0].id;
      await loadConversation();
    } else {
      await createConversation();
    }
    await refreshConversationList();
  } catch {
    await createConversation();
  }
  await refreshGmailStatus();
})();
