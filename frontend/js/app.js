const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messagesContainer = document.getElementById("messages");
const newChatButton = document.getElementById("new-chat");
const sendButton = document.getElementById("send-button");
const quickQuestions = document.querySelectorAll(".quick-question");

const API_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:3000/api/chat"
  : "/api/chat";

const HISTORY_KEY = "nubarian_chat_session_history";
const SESSION_KEY = "nubarian_chat_session_id";
let conversationHistory = [];
let sessionId = sessionStorage.getItem(SESSION_KEY);

if (!sessionId) {
  sessionId = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, sessionId);
}

try {
  const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
  if (Array.isArray(saved)) conversationHistory = saved;
} catch {
  conversationHistory = [];
}

function saveHistory() {
  conversationHistory = conversationHistory.slice(-10);
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(conversationHistory));
}

function addMessage(text, sender, extraClass = "") {
  const welcome = messagesContainer.querySelector(".welcome-card");
  if (welcome) welcome.remove();

  const row = document.createElement("div");
  row.className = `message-row ${sender}`;

  const message = document.createElement("div");
  const baseClass = sender === "user" ? "user-message" : "assistant-message";
  message.className = `message ${baseClass} ${extraClass}`.trim();
  message.textContent = text;

  row.appendChild(message);
  messagesContainer.appendChild(row);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return row;
}

function addCustomAssistantCard(node) {
  const welcome = messagesContainer.querySelector(".welcome-card");
  if (welcome) welcome.remove();

  const row = document.createElement("div");
  row.className = "message-row assistant";
  const card = document.createElement("div");
  card.className = "message assistant-message custom-card";
  card.appendChild(node);
  row.appendChild(card);
  messagesContainer.appendChild(row);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return row;
}

function restoreConversation() {
  if (!conversationHistory.length) return;
  conversationHistory.forEach((item) => {
    if (!item || !item.text) return;
    addMessage(item.text, item.role === "model" ? "assistant" : "user");
  });
}

function setLoading(isLoading) {
  sendButton.disabled = isLoading;
  messageInput.disabled = isLoading;
}

function isBookingIntent(text) {
  return /\b(agend|agenda|coordinar|visita|entrevista presencial|conocer el colegio|ir al colegio)\b/i.test(text);
}

async function startBooking() {
  addMessage("Quiero agendar una visita.", "user");
  setLoading(true);
  const loading = addMessage("Estoy revisando la agenda disponible…", "assistant", "loading");

  try {
    const response = await fetch("/api/booking/availability?days=5");
    const data = await response.json();
    loading.remove();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "No se pudo consultar la agenda.");
    }

    if (!data.availability?.length) {
      addMessage("No encontré horarios disponibles en los próximos días. El equipo de Admisiones puede ayudarte a coordinar otra opción.", "assistant");
      return;
    }

    addMessage("Podemos coordinar a partir del día siguiente, entre las 09:00 y las 16:00. Elegí una de estas opciones disponibles:", "assistant");

    const wrapper = document.createElement("div");
    wrapper.className = "slot-groups";

    data.availability.forEach((day) => {
      const group = document.createElement("div");
      group.className = "slot-day";
      const title = document.createElement("strong");
      title.textContent = day.label;
      group.appendChild(title);

      const slots = document.createElement("div");
      slots.className = "slot-list";

      day.slots.forEach((slot) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "slot-button";
        button.textContent = slot.label;
        button.addEventListener("click", () => showBookingForm(slot.start, `${day.label} · ${slot.label}`));
        slots.appendChild(button);
      });

      group.appendChild(slots);
      wrapper.appendChild(group);
    });

    addCustomAssistantCard(wrapper);
  } catch (error) {
    loading.remove();
    addMessage(`No pude consultar la agenda. ${error.message}`, "assistant");
  } finally {
    setLoading(false);
  }
}

function showBookingForm(startAt, label) {
  addMessage(`Me queda bien ${label}.`, "user");

  const container = document.createElement("div");
  container.className = "booking-form-card";

  const heading = document.createElement("div");
  heading.className = "booking-heading";
  heading.innerHTML = `<strong>Perfecto. Para confirmar ${label}, necesito estos datos:</strong>`;
  container.appendChild(heading);

  const form = document.createElement("form");
  form.className = "booking-form";
  form.innerHTML = `
    <label>Nombre y apellido
      <input name="adultName" autocomplete="name" required maxlength="200">
    </label>
    <label>Correo
      <input name="email" type="email" autocomplete="email" required maxlength="200">
    </label>
    <label>Teléfono
      <input name="phone" type="tel" autocomplete="tel" required maxlength="80">
    </label>
    <label>Nombre del estudiante
      <input name="studentName" required maxlength="200">
    </label>
    <label>Fecha de nacimiento
      <input name="birthDate" type="date" required>
    </label>
    <label>Institución de la que proviene <span>(si aplica)</span>
      <input name="previousInstitution" maxlength="250">
    </label>
    <label>Comentarios adicionales
      <textarea name="comments" rows="3" maxlength="1500"></textarea>
    </label>
    <button type="submit">Confirmar visita</button>
  `;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Confirmando…";

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.startAt = startAt;
    payload.sessionId = sessionId;

    try {
      const response = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "No se pudo confirmar la visita.");
      }

      container.innerHTML = `
        <div class="booking-success">
          <strong>Visita confirmada</strong>
          <p>${data.appointment.display}</p>
          <p>Agraciada 2850, Montevideo.</p>
          <small>Registramos tus datos y notificamos al equipo de Admisiones.</small>
        </div>
      `;
      addMessage("Tu visita quedó registrada. Si necesitás modificarla, comunicate con el Colegio Nubarian al 2208 0628.", "assistant");
    } catch (error) {
      submit.disabled = false;
      submit.textContent = "Confirmar visita";
      const errorBox = form.querySelector(".booking-error") || document.createElement("div");
      errorBox.className = "booking-error";
      errorBox.textContent = error.message;
      form.prepend(errorBox);
    }
  });

  container.appendChild(form);
  addCustomAssistantCard(container);
}

async function sendMessage(message) {
  setLoading(true);
  const loadingRow = addMessage("Escribiendo...", "assistant", "loading");

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
          history: conversationHistory,
          sessionId
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

    const friendlyMessage = error?.name === "AbortError"
      ? "La consulta demoró demasiado y fue cancelada. Probá nuevamente."
      : `No pude completar la consulta. ${error.message}`;

    addMessage(friendlyMessage, "assistant");
  } finally {
    setLoading(false);
    messageInput.focus();
  }
}

async function submitQuestion(text) {
  const cleanText = text.trim();
  if (!cleanText) return;

  if (isBookingIntent(cleanText)) {
    messageInput.value = "";
    messageInput.style.height = "auto";
    await startBooking();
    return;
  }

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
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 148)}px`;
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

quickQuestions.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.action === "booking") {
      startBooking();
      return;
    }
    submitQuestion(button.dataset.question || "");
  });
});

newChatButton.addEventListener("click", () => {
  conversationHistory = [];
  sessionStorage.removeItem(HISTORY_KEY);
  sessionId = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, sessionId);
  window.location.reload();
});

restoreConversation();
