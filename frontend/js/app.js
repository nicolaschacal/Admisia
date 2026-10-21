const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messagesContainer = document.getElementById("messages");
const newChatButton = document.getElementById("new-chat");
const bookingHeaderButton = document.getElementById("booking-header");
const sendButton = document.getElementById("send-button");
const quickQuestions = document.querySelectorAll(".quick-question");
const typingIndicator = document.getElementById("typing-indicator");
const contactStatus = document.getElementById("contact-status");
const conversationRoot = messagesContainer.querySelector(".conversation");

const API_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:3000/api/chat"
  : "/api/chat";

const HISTORY_KEY = "nubarian_chat_session_history";
const SESSION_KEY = "nubarian_chat_session_id";
const PENDING_ACTION_KEY = "nubarian_chat_pending_action";
let conversationHistory = [];
let sessionId = sessionStorage.getItem(SESSION_KEY);
let pendingAction = sessionStorage.getItem(PENDING_ACTION_KEY);

const params = new URLSearchParams(window.location.search);
const attribution = {
  utmSource: params.get("utm_source") || "",
  utmMedium: params.get("utm_medium") || "",
  utmCampaign: params.get("utm_campaign") || ""
};

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

function nowLabel() {
  return new Intl.DateTimeFormat("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}

function stampStaticTimes() {
  document.querySelectorAll(".message-time:empty").forEach((node) => {
    node.textContent = nowLabel();
  });
}

function saveHistory() {
  conversationHistory = conversationHistory.slice(-10);
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(conversationHistory));
}

function scrollToBottom(behavior = "smooth") {
  requestAnimationFrame(() => {
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior
    });
  });
}

function setTyping(isTyping, label = "escribiendo…") {
  typingIndicator.hidden = !isTyping;
  contactStatus.textContent = isTyping ? label : "En línea · Admisiones";
  contactStatus.classList.toggle("is-typing", isTyping);

  if (isTyping) scrollToBottom("smooth");
}

function removeWelcomeActions() {
  const quick = messagesContainer.querySelector(".quick-section");
  if (quick) quick.remove();
}

function ensureConversationRoot() {
  return messagesContainer.querySelector(".conversation") || conversationRoot;
}

function addMessage(text, sender) {
  removeWelcomeActions();

  const root = ensureConversationRoot();
  const row = document.createElement("div");
  row.className = `message-row ${sender}`;

  const stack = document.createElement("div");
  stack.className = "message-stack";

  const message = document.createElement("div");
  message.className = `message ${sender === "user" ? "user-message" : "assistant-message"}`;
  message.textContent = text;

  const meta = document.createElement("div");
  meta.className = "message-meta";

  if (sender === "user") {
    const delivery = document.createElement("span");
    delivery.className = "delivery-check";
    delivery.textContent = "✓✓";

    const time = document.createElement("span");
    time.textContent = nowLabel();

    meta.append(delivery, time);
  } else {
    const author = document.createElement("span");
    author.textContent = "Admisiones";

    const time = document.createElement("span");
    time.textContent = nowLabel();

    meta.append(author, time);
  }

  stack.append(message, meta);
  row.appendChild(stack);
  root.appendChild(row);

  scrollToBottom();
  return row;
}

function addCustomAssistantCard(node) {
  removeWelcomeActions();

  const root = ensureConversationRoot();
  const row = document.createElement("div");
  row.className = "message-row assistant";

  const stack = document.createElement("div");
  stack.className = "message-stack custom-card";

  const card = document.createElement("div");
  card.className = "message assistant-message";
  card.appendChild(node);

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.innerHTML = `<span>Admisiones</span><span>${nowLabel()}</span>`;

  stack.append(card, meta);
  row.appendChild(stack);
  root.appendChild(row);

  scrollToBottom();
  return row;
}

function restoreConversation() {
  if (!conversationHistory.length) return;

  const welcome = messagesContainer.querySelector(".welcome-card");
  if (welcome) welcome.remove();

  conversationHistory.forEach((item) => {
    if (!item || !item.text) return;
    addMessage(item.text, item.role === "model" ? "assistant" : "user");
  });

  scrollToBottom("auto");
}

function setLoading(isLoading) {
  sendButton.disabled = isLoading;
}

function normalizeIntentText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAffirmative(text) {
  return /^(si|s|dale|claro|perfecto|ok|okay|quiero|de acuerdo|bueno|vamos|agendemos|me gustaria|por favor)(\s|$)/.test(normalizeIntentText(text));
}

function isNegative(text) {
  return /^(no|no gracias|ahora no|mas tarde)(\s|$)/.test(normalizeIntentText(text));
}

function suggestsBooking(text) {
  const normalized = normalizeIntentText(text);
  const invitation = /\b(queres|te gustaria|si queres|puedo ayudarte|puedo mostrarte|te muestro|agendamos)\b/.test(normalized);
  const booking = /\b(agendar|coordinar|agenda|horarios disponibles|visita|entrevista)\b/.test(normalized);
  return invitation && booking;
}

function lastAssistantOffersBooking() {
  const lastAssistant = [...conversationHistory].reverse().find((item) => item?.role === "model" && item?.text);
  return Boolean(lastAssistant && suggestsBooking(lastAssistant.text));
}

function setPendingAction(action) {
  pendingAction = action || null;
  if (pendingAction) {
    sessionStorage.setItem(PENDING_ACTION_KEY, pendingAction);
  } else {
    sessionStorage.removeItem(PENDING_ACTION_KEY);
  }
}

function removeBookingAction() {
  ensureConversationRoot().querySelectorAll(".booking-action-row").forEach((node) => node.remove());
}

function addBookingAction() {
  removeBookingAction();

  const root = ensureConversationRoot();
  const row = document.createElement("div");
  row.className = "booking-action-row";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "booking-action-button";
  button.textContent = "Ver horarios disponibles";
  button.addEventListener("click", () => startBooking({ echoUser: false }));

  row.appendChild(button);
  root.appendChild(row);
  scrollToBottom();
}

function isBookingIntent(text) {
  return /\b(agend|agenda|coordinar|visita|entrevista presencial|conocer el colegio|ir al colegio)\b/i.test(text);
}

async function startBooking({ userMessage = "Quiero agendar una visita.", echoUser = true } = {}) {
  setPendingAction(null);
  removeBookingAction();
  if (echoUser) addMessage(userMessage, "user");
  setLoading(true);
  setTyping(true, "revisando agenda…");

  try {
    const response = await fetch("/api/booking/availability?days=5");
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "No se pudo consultar la agenda.");
    }

    setTyping(false);

    if (!data.availability?.length) {
      addMessage("No encontré horarios disponibles en los próximos días. El equipo de Admisiones puede ayudarte a coordinar otra opción.", "assistant");
      return;
    }

    addMessage("Tengo estos horarios disponibles. Elegí el que te quede mejor:", "assistant");

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
    setTyping(false);
    addMessage("No pude consultar la agenda en este momento. Probá nuevamente en unos segundos.", "assistant");
    console.error("Agenda:", error);
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
  heading.innerHTML = `<strong>Perfecto. Para reservar ${label}, completá estos datos:</strong>`;
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
    <label class="consent-row">
      <input name="privacyConsent" type="checkbox" value="true" required>
      <span>Autorizo el uso de estos datos exclusivamente para gestionar el proceso de admisión y contacto del Colegio Nubarian.</span>
    </label>
    <button type="submit">Confirmar visita</button>
  `;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Confirmando…";
    setTyping(true, "confirmando visita…");

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.startAt = startAt;
    payload.sessionId = sessionId;
    payload.utmSource = attribution.utmSource;
    payload.utmMedium = attribution.utmMedium;
    payload.utmCampaign = attribution.utmCampaign;

    try {
      const response = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      setTyping(false);

      if (!response.ok || !data.success) {
        throw new Error(data.message || "No se pudo confirmar la visita.");
      }

      container.innerHTML = `
        <div class="booking-success">
          <strong>✓ Visita confirmada</strong>
          <p>${data.appointment.display}</p>
          <p>Agraciada 2850, Montevideo.</p>
          <small>La reserva quedó registrada en Admisiones.</small>
        </div>
      `;

      addMessage("¡Listo! Tu visita quedó agendada. Si después necesitás modificarla, podés comunicarte al 2208 0628.", "assistant");
    } catch (error) {
      setTyping(false);
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
  setTyping(true);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

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
    setTyping(false);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "No pudimos completar la consulta.");
    }

    addMessage(data.response, "assistant");
    conversationHistory.push({ role: "user", text: message });
    conversationHistory.push({ role: "model", text: data.response });

    const nextAction = data.action || (suggestsBooking(data.response) ? "booking" : null);
    setPendingAction(nextAction);
    if (nextAction === "booking") addBookingAction();

    saveHistory();
  } catch (error) {
    setTyping(false);
    console.error("Chat:", error);

    const friendlyMessage = error?.name === "AbortError"
      ? "Estoy demorando más de lo normal. Probá nuevamente en unos segundos."
      : "No pude responder esa consulta en este momento. Probá nuevamente en unos segundos.";

    addMessage(friendlyMessage, "assistant");
  } finally {
    setLoading(false);
    messageInput.focus({ preventScroll: true });
  }
}

async function submitQuestion(text) {
  const cleanText = text.trim();
  if (!cleanText || sendButton.disabled) return;

  messageInput.value = "";
  messageInput.style.height = "auto";

  const bookingWasOffered = pendingAction === "booking" || lastAssistantOffersBooking();

  if (bookingWasOffered && isAffirmative(cleanText)) {
    addMessage(cleanText, "user");
    await startBooking({ echoUser: false });
    return;
  }

  if (bookingWasOffered && isNegative(cleanText)) {
    setPendingAction(null);
    removeBookingAction();
  }

  if (isBookingIntent(cleanText)) {
    await startBooking({ userMessage: cleanText });
    return;
  }

  addMessage(cleanText, "user");
  await sendMessage(cleanText);
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitQuestion(messageInput.value);
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 112)}px`;
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

bookingHeaderButton.addEventListener("click", () => startBooking());

newChatButton.addEventListener("click", () => {
  conversationHistory = [];
  sessionStorage.removeItem(HISTORY_KEY);
  sessionStorage.removeItem(PENDING_ACTION_KEY);
  pendingAction = null;
  sessionId = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, sessionId);
  window.location.reload();
});

window.addEventListener("wheel", (event) => {
  if (event.ctrlKey) event.preventDefault();
}, { passive: false });

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "0"].includes(event.key)) {
    event.preventDefault();
  }
});

document.addEventListener("gesturestart", (event) => event.preventDefault());

stampStaticTimes();
restoreConversation();

if (!pendingAction && lastAssistantOffersBooking()) {
  setPendingAction("booking");
}
if (pendingAction === "booking") {
  addBookingAction();
}
