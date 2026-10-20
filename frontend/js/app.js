const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messagesContainer = document.getElementById("messages");
const newChatButton = document.getElementById("new-chat");
const sendButton = document.getElementById("send-button");
const quickQuestions = document.querySelectorAll(".quick-question");

const API_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:3000/api/chat"
  : "/api/chat";

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatInlineMarkdown(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function formatAssistantMessage(text) {
  const safeText = escapeHtml(text);
  const lines = safeText.split("\n");
  let html = "";
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${formatInlineMarkdown(line.slice(2))}</li>`;
      continue;
    }

    if (inList) {
      html += "</ul>";
      inList = false;
    }

    if (!line) {
      html += "<br>";
      continue;
    }

    html += `<p>${formatInlineMarkdown(line)}</p>`;
  }

  if (inList) html += "</ul>";

  return html;
}

function addMessage(text, sender, extraClass = "") {
  const welcome = messagesContainer.querySelector(".welcome");
  if (welcome) welcome.remove();

  const row = document.createElement("div");
  row.className = `message-row ${sender}`;

  const message = document.createElement("div");
  message.className = `message ${extraClass}`.trim();

  const shouldRenderMarkdown = sender === "assistant" && extraClass !== "loading";

  if (shouldRenderMarkdown) {
    message.innerHTML = formatAssistantMessage(text);
  } else {
    message.textContent = text;
  }

  row.appendChild(message);
  messagesContainer.appendChild(row);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  return row;
}

function setLoading(isLoading) {
  sendButton.disabled = isLoading;
  messageInput.disabled = isLoading;
}

async function sendMessage(message) {
  setLoading(true);
  const loadingRow = addMessage("Estoy preparando la información…", "assistant", "loading");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    loadingRow.remove();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Error del servidor");
    }

    addMessage(data.response, "assistant");
  } catch (error) {
    loadingRow.remove();
    console.error("Error al comunicarse con el backend:", error);
    addMessage(
      "No pude conectarme con el asistente en este momento. Probá nuevamente en unos segundos.",
      "assistant"
    );
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
  window.location.reload();
});
