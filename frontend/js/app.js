const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messagesContainer = document.getElementById("messages");
const newChatButton = document.getElementById("new-chat");
const sendButton = document.getElementById("send-button");
const quickQuestions = document.querySelectorAll(".quick-question");

const HISTORY_KEY = "admisia_session_history";
let conversationHistory = [];

try {
  conversationHistory = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
  if (!Array.isArray(conversationHistory)) conversationHistory = [];
} catch {
  conversationHistory = [];
}

const API_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:3000/api/chat"
  : "/api/chat";

function addMessage(text, sender, extraClass = "") {
  const welcome = messagesContainer.querySelector(".welcome");
  if (welcome) welcome.remove();

  const row = document.createElement("div");
  row.className = `message-row ${sender}`;

  const message = document.createElement("div");
  message.className = `message ${extraClass}`.trim();
  message.textContent = text;

  row.appendChild(message);
  messagesContainer.appendChild(row);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  return row;
}

function saveHistory() {
  conversationHistory = conversationHistory.slice(-10);
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(conversationHistory));
}

function restoreConversation() {
  if (!conversationHistory.length) return;

  const welcome = messagesContainer.querySelector(".welcome");
  if (welcome) welcome.remove();

  for (const item of conversationHistory) {
    if (!item || !item.text) continue;
    addMessage(item.text, item.role === "model" ? "assistant" : "user");
  }
}

function setLoading(isLoading) {
  sendButton.disabled = isLoading;
  messageInput.disabled = isLoading;
}

async function sendMessage(message) {
  setLoading(true);
  const loadingRow = addMessage("Estoy preparando la información…", "assistant", "loading");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let response;

    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: conversationHistory
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();
    loadingRow.remove();

    if (!response.ok || !data.success) {
      const detail = data.detail ? ` Detalle: ${data.detail}` : "";
      throw new Error((data.message || "Error del servidor") + detail);
    }

    addMessage(data.response, "assistant");
    conversationHistory.push({ role: "user", text: message });
    conversationHistory.push({ role: "model", text: data.response });
    saveHistory();
  } catch (error) {
    loadingRow.remove();
    console.error("Error al comunicarse con el backend:", error);

    const message = error?.name === "AbortError"
      ? "La consulta demoró demasiado y fue cancelada. Probá nuevamente."
      : `No pude completar la consulta. ${error.message}`;

    addMessage(message, "assistant");
  } finally {
    setLoading(false);
    messageInput.focus();
  }
}

async function submitQuestion(text) {
  const cleanText = text.trim();
  if (!cleanText) return;
  addMessage(cleanText, "user");
  messageInput.value = "";
  messageInput.style.height = "auto";
  await sendMessage(cleanText);
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitQuestion(messageInput.value);
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 150)}px`;
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

quickQuestions.forEach((button) => {
  button.addEventListener("click", () => submitQuestion(button.dataset.question));
});

newChatButton.addEventListener("click", () => {
  conversationHistory = [];
  sessionStorage.removeItem(HISTORY_KEY);
  window.location.reload();
});

restoreConversation();
