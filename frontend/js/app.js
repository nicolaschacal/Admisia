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

const PENDING_ACTION_KEY = "nubarian_chat_pending_action";
let conversationHistory = [];
let pendingAction = sessionStorage.getItem(PENDING_ACTION_KEY);
let currentAppointment = null;

const params = new URLSearchParams(window.location.search);
const attribution = {
  utmSource: params.get("utm_source") || "",
  utmMedium: params.get("utm_medium") || "",
  utmCampaign: params.get("utm_campaign") || ""
};

function messageTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return [date.getFullYear(), date.getMonth(), date.getDate()].join("-");
}

function dayLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (dayKey(date) === dayKey(now)) return "Hoy";
  if (dayKey(date) === dayKey(yesterday)) return "Ayer";

  return new Intl.DateTimeFormat("es-UY", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

function stampStaticTimes() {
  document.querySelectorAll(".message-time:empty").forEach((node) => {
    node.textContent = messageTime();
  });
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

function setLoading(isLoading) {
  sendButton.disabled = isLoading;
}

function removeWelcomeActions() {
  const quick = messagesContainer.querySelector(".quick-section");
  if (quick) quick.remove();
}

function ensureConversationRoot() {
  return messagesContainer.querySelector(".conversation") || conversationRoot;
}

function addDayDivider(value) {
  const root = ensureConversationRoot();
  const divider = document.createElement("div");
  divider.className = "day-divider";
  const span = document.createElement("span");
  span.textContent = dayLabel(value);
  divider.appendChild(span);
  root.appendChild(divider);
}

function addMessage(text, sender, options = {}) {
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
  const timestamp = options.timestamp || new Date();

  if (sender === "user") {
    const delivery = document.createElement("span");
    delivery.className = "delivery-check";
    delivery.textContent = "✓✓";

    const time = document.createElement("span");
    time.textContent = messageTime(timestamp);
    meta.append(delivery, time);
  } else {
    const author = document.createElement("span");
    author.textContent = "Admisiones";

    const time = document.createElement("span");
    time.textContent = messageTime(timestamp);
    meta.append(author, time);
  }

  stack.append(message, meta);
  row.appendChild(stack);
  root.appendChild(row);

  if (!options.skipScroll) scrollToBottom();
  return row;
}

function addCustomAssistantCard(node, extraClass = "") {
  removeWelcomeActions();

  const root = ensureConversationRoot();
  const row = document.createElement("div");
  row.className = `message-row assistant ${extraClass}`.trim();

  const stack = document.createElement("div");
  stack.className = "message-stack custom-card";

  const card = document.createElement("div");
  card.className = "message assistant-message";
  card.appendChild(node);

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.innerHTML = `<span>Admisiones</span><span>${messageTime()}</span>`;

  stack.append(card, meta);
  row.appendChild(stack);
  root.appendChild(row);

  scrollToBottom();
  return row;
}

function restoreConversation(messages) {
  if (!messages?.length) return;

  const root = ensureConversationRoot();
  root.innerHTML = "";

  let previousDay = null;
  conversationHistory = [];

  messages.forEach((item) => {
    if (!item?.text || !["user", "assistant"].includes(item.role)) return;

    const createdAt = item.createdAt || new Date();
    const key = dayKey(createdAt);

    if (key !== previousDay) {
      addDayDivider(createdAt);
      previousDay = key;
    }

    addMessage(item.text, item.role === "assistant" ? "assistant" : "user", {
      timestamp: createdAt,
      skipScroll: true
    });

    conversationHistory.push({
      role: item.role === "assistant" ? "model" : "user",
      text: item.text
    });
  });

  conversationHistory = conversationHistory.slice(-12);
  scrollToBottom("auto");
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

function isBookingIntent(text) {
  return /\b(agend|agenda|coordinar|visita|entrevista presencial|conocer el colegio|ir al colegio)\b/i.test(text);
}

function isRescheduleIntent(text) {
  const normalized = normalizeIntentText(text);
  return /\b(cambiar|modificar|reprogramar|reagendar|mover|otro horario|otra hora|otra fecha)\b/.test(normalized);
}

function isCancelIntent(text) {
  const normalized = normalizeIntentText(text);
  return /\b(cancelar|anular|cancelarla|cancelarlo|no podemos ir|no puedo ir|no vamos a ir)\b/.test(normalized);
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

function lastAssistantOffersBooking() {
  const lastAssistant = [...conversationHistory].reverse().find((item) => item?.role === "model" && item?.text);
  return Boolean(lastAssistant && suggestsBooking(lastAssistant.text));
}

function removeAppointmentCard() {
  ensureConversationRoot().querySelectorAll(".appointment-card-row").forEach((node) => node.remove());
}

function showAppointmentCard(appointment = currentAppointment) {
  if (!appointment) return;
  removeAppointmentCard();

  const wrap = document.createElement("div");
  wrap.className = "appointment-card";

  const eyebrow = document.createElement("small");
  eyebrow.textContent = "Tu próxima visita";

  const title = document.createElement("strong");
  title.textContent = appointment.display || appointment.shortDisplay || "Visita agendada";

  const subtitle = document.createElement("span");
  subtitle.textContent = appointment.studentName
    ? `${appointment.studentName} · Agraciada 2850`
    : "Colegio Nubarian · Agraciada 2850";

  const actions = document.createElement("div");
  actions.className = "appointment-actions";

  const change = document.createElement("button");
  change.type = "button";
  change.textContent = "Cambiar horario";
  change.addEventListener("click", () => startReschedule({ echoUser: true }));

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "danger-link";
  cancel.textContent = "Cancelar";
  cancel.addEventListener("click", () => showCancelConfirmation({ echoUser: true }));

  actions.append(change, cancel);
  wrap.append(eyebrow, title, subtitle, actions);
  addCustomAssistantCard(wrap, "appointment-card-row");
}

async function bootstrapConversation() {
  setLoading(true);

  try {
    const response = await fetch("/api/chat/session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    });
    const data = await response.json();

    if (response.ok && data.success) {
      restoreConversation(data.messages || []);
      currentAppointment = data.appointment || null;

      if (currentAppointment) showAppointmentCard(currentAppointment);

      if (!pendingAction && lastAssistantOffersBooking()) {
        setPendingAction("booking");
      }
      if (pendingAction === "booking" && !currentAppointment) {
        addBookingAction();
      }
    }
  } catch (error) {
    console.error("No se pudo restaurar la conversación:", error);
  } finally {
    setLoading(false);
    scrollToBottom("auto");
  }
}

async function getAvailability() {
  const response = await fetch("/api/booking/availability?days=5", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || "No se pudo consultar la agenda.");
  return data.availability || [];
}

function renderSlots(availability, onSelect) {
  const wrapper = document.createElement("div");
  wrapper.className = "slot-groups";

  availability.forEach((day) => {
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
      button.addEventListener("click", () => onSelect(slot, day));
      slots.appendChild(button);
    });

    group.appendChild(slots);
    wrapper.appendChild(group);
  });

  return wrapper;
}

async function startBooking({ userMessage = "Quiero agendar una visita.", echoUser = true } = {}) {
  await bootstrapPromise;
  setPendingAction(null);
  removeBookingAction();

  if (currentAppointment) {
    if (echoUser) addMessage(userMessage, "user");
    addMessage("Ya tenés una visita agendada. Podés cambiarla o cancelarla desde acá.", "assistant");
    showAppointmentCard(currentAppointment);
    return;
  }

  if (echoUser) addMessage(userMessage, "user");
  setLoading(true);
  setTyping(true, "revisando agenda…");

  try {
    const availability = await getAvailability();
    setTyping(false);

    if (!availability.length) {
      addMessage("No encontré horarios disponibles en los próximos días. El equipo de Admisiones puede ayudarte a coordinar otra opción.", "assistant");
      return;
    }

    addMessage("Tengo estos horarios disponibles. Elegí el que te quede mejor:", "assistant");
    addCustomAssistantCard(renderSlots(availability, (slot, day) => {
      showBookingForm(slot.start, `${day.label} · ${slot.label}`);
    }));
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
    payload.utmSource = attribution.utmSource;
    payload.utmMedium = attribution.utmMedium;
    payload.utmCampaign = attribution.utmCampaign;

    try {
      const response = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      setTyping(false);

      if (!response.ok || !data.success) throw new Error(data.message || "No se pudo confirmar la visita.");

      currentAppointment = data.appointment;
      container.innerHTML = `
        <div class="booking-success">
          <strong>✓ Visita confirmada</strong>
          <p>${data.appointment.display}</p>
          <p>Agraciada 2850, Montevideo.</p>
          <small>Podés cambiarla o cancelarla desde este mismo chat.</small>
        </div>
      `;

      addMessage("¡Listo! Tu visita quedó agendada. Si necesitás cambiar el horario, decímelo acá mismo.", "assistant");
      showAppointmentCard(currentAppointment);
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

async function startReschedule({ echoUser = false } = {}) {
  await bootstrapPromise;

  if (!currentAppointment) {
    addMessage("No encontré una visita activa asociada a este chat.", "assistant");
    return;
  }

  if (echoUser) addMessage("Quiero cambiar el horario de mi visita.", "user");
  setLoading(true);
  setTyping(true, "buscando otros horarios…");

  try {
    const availability = await getAvailability();
    setTyping(false);

    addMessage(
      `Tu visita actual es ${currentAppointment.display}. Elegí un nuevo horario:`,
      "assistant"
    );

    addCustomAssistantCard(renderSlots(availability, async (slot, day) => {
      await rescheduleAppointment(slot.start, `${day.label} · ${slot.label}`);
    }));
  } catch (error) {
    setTyping(false);
    addMessage("No pude consultar otros horarios en este momento.", "assistant");
  } finally {
    setLoading(false);
  }
}

async function rescheduleAppointment(startAt, label) {
  setTyping(true, "reprogramando visita…");

  try {
    const response = await fetch("/api/booking/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "reschedule", startAt })
    });
    const data = await response.json();
    setTyping(false);

    if (!response.ok || !data.success) throw new Error(data.message || "No se pudo cambiar la visita.");

    addMessage(`Me queda bien ${label}.`, "user");
    currentAppointment = data.appointment;
    addMessage(`Listo. Tu visita ahora es ${currentAppointment.display}.`, "assistant");
    showAppointmentCard(currentAppointment);
  } catch (error) {
    setTyping(false);
    addMessage(error.message || "No se pudo cambiar la visita.", "assistant");
  }
}

function showCancelConfirmation({ echoUser = false } = {}) {
  if (!currentAppointment) return;
  if (echoUser) addMessage("Quiero cancelar mi visita.", "user");

  const wrapper = document.createElement("div");
  wrapper.className = "cancel-confirmation";

  const text = document.createElement("p");
  text.textContent = `¿Querés cancelar la visita del ${currentAppointment.display}?`;

  const actions = document.createElement("div");
  actions.className = "appointment-actions";

  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "danger-button";
  confirm.textContent = "Sí, cancelar";

  const keep = document.createElement("button");
  keep.type = "button";
  keep.textContent = "Mantener visita";

  confirm.addEventListener("click", cancelAppointment);
  keep.addEventListener("click", () => wrapper.closest(".message-row")?.remove());

  actions.append(confirm, keep);
  wrapper.append(text, actions);
  addCustomAssistantCard(wrapper);
}

async function cancelAppointment() {
  setTyping(true, "cancelando visita…");

  try {
    const response = await fetch("/api/booking/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "cancel" })
    });
    const data = await response.json();
    setTyping(false);

    if (!response.ok || !data.success) throw new Error(data.message || "No se pudo cancelar la visita.");

    currentAppointment = null;
    removeAppointmentCard();
    addMessage("Listo. La visita quedó cancelada. Cuando quieras, podemos coordinar otra fecha.", "assistant");
  } catch (error) {
    setTyping(false);
    addMessage(error.message || "No se pudo cancelar la visita.", "assistant");
  }
}

async function sendMessage(message) {
  await bootstrapPromise;
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
        credentials: "same-origin",
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
    setTyping(false);

    if (!response.ok || !data.success) throw new Error(data.message || "No pudimos completar la consulta.");

    addMessage(data.response, "assistant");
    conversationHistory.push({ role: "user", text: message });
    conversationHistory.push({ role: "model", text: data.response });
    conversationHistory = conversationHistory.slice(-12);

    const nextAction = data.action || (suggestsBooking(data.response) ? "booking" : null);
    setPendingAction(nextAction);
    if (nextAction === "booking" && !currentAppointment) addBookingAction();
  } catch (error) {
    setTyping(false);
    console.error("Chat:", error);

    addMessage(
      error?.name === "AbortError"
        ? "Estoy demorando más de lo normal. Probá nuevamente en unos segundos."
        : "No pude responder esa consulta en este momento. Probá nuevamente en unos segundos.",
      "assistant"
    );
  } finally {
    setLoading(false);
    messageInput.focus({ preventScroll: true });
  }
}

async function submitQuestion(text) {
  await bootstrapPromise;
  const cleanText = text.trim();
  if (!cleanText || sendButton.disabled) return;

  messageInput.value = "";
  messageInput.style.height = "auto";

  if (currentAppointment && isRescheduleIntent(cleanText)) {
    addMessage(cleanText, "user");
    await startReschedule({ echoUser: false });
    return;
  }

  if (currentAppointment && isCancelIntent(cleanText)) {
    addMessage(cleanText, "user");
    showCancelConfirmation({ echoUser: false });
    return;
  }

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

function syncVisualViewport() {
  const viewport = window.visualViewport;
  const height = viewport ? viewport.height : window.innerHeight;
  const top = viewport ? viewport.offsetTop : 0;

  document.documentElement.style.setProperty("--visual-height", `${Math.round(height)}px`);
  document.documentElement.style.setProperty("--visual-top", `${Math.round(top)}px`);
}

function settleKeyboardViewport() {
  syncVisualViewport();

  [40, 120, 240, 360].forEach((delay) => {
    setTimeout(() => {
      syncVisualViewport();
      scrollToBottom("auto");
    }, delay);
  });
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

messageInput.addEventListener("focus", () => {
  document.body.classList.add("keyboard-open");
  settleKeyboardViewport();
});

messageInput.addEventListener("blur", () => {
  document.body.classList.remove("keyboard-open");
  setTimeout(syncVisualViewport, 80);
});

window.visualViewport?.addEventListener("resize", settleKeyboardViewport);
window.visualViewport?.addEventListener("scroll", syncVisualViewport);
window.addEventListener("resize", syncVisualViewport);
window.addEventListener("orientationchange", settleKeyboardViewport);

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

newChatButton.addEventListener("click", async () => {
  await bootstrapPromise;
  setPendingAction(null);
  removeBookingAction();
  scrollToBottom("smooth");
  messageInput.focus({ preventScroll: true });
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

syncVisualViewport();
stampStaticTimes();
const bootstrapPromise = bootstrapConversation();
