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
const chatApp = document.querySelector(".chat-app");
const businessProfileTrigger = document.getElementById("business-profile-trigger");
const businessProfile = document.getElementById("business-profile");
const businessProfileBack = document.getElementById("business-profile-back");
const businessShareButton = document.getElementById("business-share");
const businessOpenStatus = document.getElementById("business-open-status");

const API_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:3000/api/chat"
  : "/api/chat";

const PENDING_ACTION_KEY = "admisia_chat_pending_action";
let conversationHistory = [];
let pendingAction = sessionStorage.getItem(PENDING_ACTION_KEY);
let currentAppointment = null;

const usesSoftwareKeyboardViewport =
  window.matchMedia("(pointer: coarse)").matches &&
  Number(navigator.maxTouchPoints || 0) > 0;

// Vocabulary of the business type (rubro). Defaults are the original school
// texts; /api/profile sends the right ones for this business.
let V = {
  type: "school",
  form: "school",
  team: "Admisiones",
  cta: "Agendar visita",
  ctaLong: "Agendar una visita",
  ctaTitle: "Agendar una visita",
  bookingIntro: "Completá tus datos para confirmar la visita.",
  confirmButton: "Confirmar visita",
  consentBooking: "Acepto que el colegio use estos datos solo para el proceso de admisión.",
  consentContact: "Acepto que el colegio use estos datos para contactarme sobre admisiones.",
  welcome: null,
  quick: null,
  vacancyTitle: "Aviso de vacantes",
  vacancySubtitle: "Te avisamos apenas haya novedades de vacantes e inscripciones.",
  vacancyButton: "Avisame",
  vacancyEcho: "Sí, avisame cuando haya novedades.",
  appt: {
    noun: "visita", Noun: "Visita", a: "una visita", the: "la visita", your: "tu visita", pron: "la",
    scheduled: "agendada", cancelledAdj: "cancelada", confirmed: "Visita confirmada", cancelled: "Visita cancelada"
  }
};
const isSchool = () => V.type === "school";
const apptO = () => (V.appt.pron === "la" ? "a" : "o");

// Neutral defaults. The real data comes from /api/profile (the client's own
// configuration in the dashboard).
let publicProfile = {
  name: "Admisiones",
  category: "Educación",
  shortDescription: "",
  statusText: "",
  addressLine1: "",
  addressLine2: "",
  mapQuery: "",
  phoneDisplay: "",
  phoneE164: "",
  email: "",
  website: "",
  instagram: "",
  instagramLabel: "",
  facebook: "",
  facebookLabel: "",
  openHour: 8,
  closeHour: 18,
  weekdays: [1,2,3,4,5],
  badgeEnabled: true,
  logoUrl: "",
  brandColor: "",
  secondaryColor: "",
  welcomeMessage: ""
};

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
  contactStatus.textContent = isTyping ? label : "en línea";
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

  const body = document.createElement("span");
  body.className = "message-text";
  body.textContent = text;

  const timestamp = options.timestamp || new Date();
  const meta = document.createElement("span");
  meta.className = "message-meta";

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = messageTime(timestamp);
  meta.appendChild(time);

  if (sender === "user") {
    const delivery = document.createElement("span");
    delivery.className = "delivery-check";
    delivery.setAttribute("aria-label", "Leído");
    delivery.innerHTML = '<svg viewBox="0 0 18 11" aria-hidden="true"><path d="M1 6l3.2 3.2L11 1.6M7 9.2 15.6 1.6"/></svg>';
    meta.appendChild(delivery);
  }

  message.append(body, meta);
  stack.appendChild(message);
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

  const meta = document.createElement("span");
  meta.className = "message-meta message-meta--block";
  meta.innerHTML = `<span class="message-time">${messageTime()}</span>`;
  card.appendChild(meta);

  stack.appendChild(card);
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
  const booking = /\b(agendar|coordinar|agenda|horarios disponibles|visita|entrevista|reservar|turno|cita)\b/.test(normalized);
  return invitation && booking;
}

function isBookingIntent(text) {
  if (!isSchool()) {
    return /\b(agend|reserv|sacar (un )?turno|pedir (un )?turno|quiero (un )?turno|sacar hora|pedir hora|una cita|turno para)/i.test(normalizeIntentText(text));
  }
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

function buildContactCopy() {
  return {
    info: {
      button: "Sí, que me escriban",
      title: "Recibir información",
      subtitle: `${V.team} te escribe por WhatsApp o correo.`,
      submit: "Enviar mis datos",
      echo: "Sí, quiero que me manden la información."
    },
    vacancy: {
      button: V.vacancyButton,
      title: V.vacancyTitle,
      subtitle: V.vacancySubtitle,
      submit: isSchool() ? "Quiero que me avisen" : "Anotarme",
      echo: V.vacancyEcho
    },
    brochure: {
      button: "Quiero el folleto",
      title: "Folleto",
      subtitle: "Te lo mandamos por correo y también lo podés descargar acá.",
      submit: "Recibir el folleto",
      echo: "Sí, quiero el folleto."
    },
    callback: {
      button: "Que me llamen",
      title: "Que te llamen",
      subtitle: `Una persona de ${V.team} te llama cuando te quede cómodo.`,
      submit: "Pedir llamada",
      echo: "Prefiero que me llamen."
    }
  };
}
let CONTACT_COPY = buildContactCopy();
let contactCaptured = false;
let knownContact = null;
let captureCallbackEnabled = true;

function contactReason(action) {
  const reason = String(action || "").startsWith("contact:") ? action.slice(8) : "";
  return CONTACT_COPY[reason] ? reason : null;
}

function addContactAction(reason) {
  removeBookingAction();
  const copy = CONTACT_COPY[reason];
  if (!copy) return;

  const row = document.createElement("div");
  row.className = "booking-action-row";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "booking-action-button";
  button.textContent = copy.button;
  button.addEventListener("click", () => {
    removeBookingAction();
    showContactCard(reason, { echo: copy.echo });
  });
  row.appendChild(button);
  ensureConversationRoot().appendChild(row);
  scrollToBottom();
}

// Quick replies under the last message (same look as "Ver horarios").
function addFollowUpActions(actions) {
  removeBookingAction();
  const row = document.createElement("div");
  row.className = "booking-action-row";
  actions.forEach(([label, onClick]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "booking-action-button";
    button.textContent = label;
    button.addEventListener("click", () => { removeBookingAction(); onClick(); });
    row.appendChild(button);
  });
  ensureConversationRoot().appendChild(row);
  scrollToBottom();
}

function showContactCard(reason, { echo = "" } = {}) {
  const copy = CONTACT_COPY[reason] || CONTACT_COPY.info;
  setPendingAction(null);
  if (echo) addMessage(echo, "user");

  const container = document.createElement("div");
  container.className = "booking-form-card contact-card";
  container.innerHTML = `
    <div class="booking-head">
      <span class="booking-head-copy">
        <strong>${escapeHtml(copy.title)}</strong>
        <small>${escapeHtml(copy.subtitle)}</small>
      </span>
    </div>`;

  const needsPhone = reason === "callback";
  const needsEmail = reason === "brochure";
  const form = document.createElement("form");
  form.className = "booking-form";
  form.noValidate = true;
  form.innerHTML = `
    <div class="field-group">
      <label class="field">
        <span>Nombre</span>
        <input placeholder="Nombre" name="name" autocomplete="name" required maxlength="200">
      </label>
      <label class="field">
        <span>${needsPhone ? "Teléfono" : "WhatsApp o teléfono"}</span>
        <input placeholder="${needsPhone ? "Teléfono" : "WhatsApp o teléfono"}" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="40" ${needsPhone ? "required" : ""}>
      </label>
      ${needsPhone ? "" : `
      <label class="field">
        <span>Correo electrónico</span>
        <input placeholder="Correo electrónico" name="email" type="email" inputmode="email" autocomplete="email" maxlength="200" ${needsEmail ? "required" : ""}>
      </label>`}
    </div>
    ${needsPhone ? `
    <div class="contact-time">
      <span class="contact-time-label">¿Cuándo te queda mejor?</span>
      <div class="slot-times">
        ${["Mañana", "Tarde", "Cualquier horario"].map((label, index) => `<button type="button" class="slot-time${index === 2 ? " is-selected" : ""}" data-time="${label}">${label}</button>`).join("")}
      </div>
    </div>` : `<p class="contact-hint">${needsEmail ? "Te mandamos el folleto a este correo." : "Con uno de los dos alcanza."}</p>`}
    <label class="consent-row">
      <input name="consent" type="checkbox" value="true" required>
      <span>${escapeHtml(V.consentContact)}</span>
    </label>
    <button type="submit" class="chat-btn chat-btn--primary booking-submit"><span>${escapeHtml(copy.submit)}</span></button>
  `;

  // Same browser that already left its details (visit or earlier contact).
  if (knownContact) {
    ["name", "phone", "email"].forEach((key) => {
      if (form.elements[key] && knownContact[key]) form.elements[key].value = knownContact[key];
    });
  }

  let bestTime = "Cualquier horario";
  form.querySelectorAll("[data-time]").forEach((chip) => chip.addEventListener("click", () => {
    bestTime = chip.dataset.time;
    form.querySelectorAll("[data-time]").forEach((other) => other.classList.toggle("is-selected", other === chip));
  }));

  const showError = (message) => {
    const errorBox = form.querySelector(".booking-error") || document.createElement("div");
    errorBox.className = "booking-error";
    errorBox.textContent = message;
    form.prepend(errorBox);
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const name = String(values.name || "").trim();
    const phone = String(values.phone || "").trim();
    const email = String(values.email || "").trim();

    if (!name) return showError("Contanos tu nombre.");
    if (needsPhone && !phone) return showError("Necesitamos un teléfono para llamarte.");
    if (needsEmail && !email) return showError("Dejanos un correo para mandarte el folleto.");
    if (!phone && !email) return showError("Dejanos un teléfono o un correo.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("El correo no parece válido.");
    if (!values.consent) return showError("Necesitamos tu autorización para contactarte.");

    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.querySelector("span").textContent = "Enviando…";
    setTyping(true, "guardando tus datos…");

    try {
      const response = await fetch("/api/lead/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          reason, name, phone, email,
          bestTime: needsPhone ? bestTime : "",
          consent: true,
          ...attribution
        })
      });
      const data = await response.json();
      setTyping(false);
      if (!response.ok || !data.success) throw new Error(data.message || "No se pudieron guardar tus datos.");

      contactCaptured = true;
      knownContact = { name, phone: phone || knownContact?.phone || "", email: email || knownContact?.email || "" };
      container.innerHTML = `
        <div class="booking-success">
          <p class="appt-status">${uiIcon("check")}Datos enviados</p>
          <p>${escapeHtml(copy.title)}${needsPhone ? ` · ${escapeHtml(bestTime.toLowerCase())}` : ""}</p>
        </div>`;

      addMessage(data.message, "assistant");
      conversationHistory.push({ role: "model", text: data.message });

      if (data.brochureUrl) {
        const wrap = document.createElement("div");
        wrap.className = "brochure-card";
        wrap.innerHTML = `<p class="brochure-title">${uiIcon("doc")}<span>Folleto de ${escapeHtml(publicProfile.name || "la institución")}</span></p>`;
        const actions = document.createElement("div");
        actions.className = "bubble-actions";
        actions.append(bubbleButton("Descargar folleto", { icon: "download", href: data.brochureUrl }));
        wrap.appendChild(actions);
        addCustomAssistantCard(wrap);
      }
    } catch (error) {
      setTyping(false);
      submit.disabled = false;
      submit.querySelector("span").textContent = copy.submit;
      showError(error.message);
    }
  });

  container.appendChild(form);
  addCustomAssistantCard(container);
}

function lastAssistantOffersBooking() {
  const lastAssistant = [...conversationHistory].reverse().find((item) => item?.role === "model" && item?.text);
  return Boolean(lastAssistant && suggestsBooking(lastAssistant.text));
}

function removeAppointmentCard() {
  ensureConversationRoot().querySelectorAll(".appointment-card-row").forEach((node) => node.remove());
}

const UI_ICONS = {
  calendar: '<path d="M7 3v3M17 3v3M3.5 9.5h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5Z"/>',
  calendarCheck: '<path d="M7 3v3M17 3v3M3.5 9.5h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5Z"/><path d="m9 14.5 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'
};

function uiIcon(name, className = "ui-icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${UI_ICONS[name] || ""}</svg>`;
}

function capitalize(value = "") {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function splitAppointmentDisplay(display = "") {
  const [datePart, timePart] = String(display).split(/\s+a\s+las\s+/i);
  let date = (datePart || display).trim();
  const match = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12);
    if (!Number.isNaN(parsed.getTime())) {
      date = new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long" }).format(parsed).replace(",", "");
    }
  }
  return { date: capitalize(date), time: (timePart || "").trim() };
}

function bubbleButton(label, { icon, tone = "", onClick, href } = {}) {
  const el = document.createElement(href ? "a" : "button");
  if (href) {
    el.href = href;
    el.target = "_blank";
    el.rel = "noreferrer";
  } else {
    el.type = "button";
  }
  el.className = `bubble-action${tone ? ` bubble-action--${tone}` : ""}`;
  el.innerHTML = `${icon ? uiIcon(icon) : ""}<span>${escapeHtml(label)}</span>`;
  if (onClick) el.addEventListener("click", onClick);
  return el;
}

function showAppointmentCard(appointment = currentAppointment) {
  if (!appointment) return;
  removeAppointmentCard();

  const { date, time } = splitAppointmentDisplay(appointment.display || appointment.shortDisplay || `${V.appt.Noun} ${V.appt.scheduled}`);
  const mapLink = document.getElementById("business-map-link")?.getAttribute("href");
  const mapHref = mapLink && mapLink !== "#" ? mapLink : "";
  const street = [publicProfile.addressLine1, publicProfile.addressLine2].filter(Boolean).join(", ");

  const wrap = document.createElement("div");
  wrap.className = "appointment-card";
  wrap.innerHTML = `
    <p class="appt-status">${uiIcon("check")}${escapeHtml(V.appt.confirmed)}</p>
    <p class="appt-date">${escapeHtml(date)}</p>
    ${time ? `<p class="appt-time">${escapeHtml(time)} h</p>` : ""}
    <ul class="appt-details">
      ${street ? `<li>${uiIcon("pin")}<span>${escapeHtml(street)}</span></li>` : ""}
      ${appointment.studentName ? `<li>${uiIcon("user")}<span>${escapeHtml(appointment.studentName)}</span></li>` : ""}
    </ul>
  `;

  const actions = document.createElement("div");
  actions.className = "bubble-actions bubble-actions--pair";
  if (!mapHref) actions.classList.remove("bubble-actions--pair");
  actions.append(
    ...(mapHref ? [bubbleButton("Cómo llegar", { icon: "pin", href: mapHref })] : []),
    bubbleButton("Cambiar horario", { icon: "swap", onClick: () => startReschedule({ echoUser: true }) }),
    bubbleButton(`Cancelar ${V.appt.noun}`, { icon: "x", tone: "danger", onClick: () => showCancelConfirmation({ echoUser: true }) })
  );
  wrap.appendChild(actions);
  addCustomAssistantCard(wrap, "appointment-card-row");
}

function getProfileWebsiteLabel(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return String(value || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function formatProfileWeekdays(days = []) {
  const ordered = [...new Set((days || []).map(Number).filter((d) => d >= 1 && d <= 7))].sort((a,b) => a-b);
  if (ordered.join(",") === "1,2,3,4,5") return "Lunes a viernes";

  const labels = {1:"Lun",2:"Mar",3:"Mié",4:"Jue",5:"Vie",6:"Sáb",7:"Dom"};
  return ordered.map((d) => labels[d]).join(", ") || "Consultar";
}

function applyPublicProfile() {
  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value || "";
  };

  setText("header-profile-name", publicProfile.name);
  setText("business-profile-name", publicProfile.name);
  setText("business-profile-category", publicProfile.category);
  setText("business-category-text", publicProfile.category);
  setText("business-description-text", publicProfile.shortDescription);
  setText("business-status-text", publicProfile.statusText);
  setText("business-address-1", publicProfile.addressLine1);
  setText("business-address-2", publicProfile.addressLine2);
  setText("business-phone-display", publicProfile.phoneDisplay);
  setText("business-email-display", publicProfile.email);
  setText("business-instagram-display", publicProfile.instagramLabel);
  setText("business-facebook-display", publicProfile.facebookLabel);
  setText("business-hours-text", `${String(publicProfile.openHour).padStart(2,"0")}:00 a ${String(publicProfile.closeHour).padStart(2,"0")}:00`);
  setText("business-days-text", formatProfileWeekdays(publicProfile.weekdays));
  setText("business-website-display", getProfileWebsiteLabel(publicProfile.website));

  applyBranding();
  applyWelcomeMessage();

  document.querySelectorAll("[data-profile-badge]").forEach((badge) => {
    badge.hidden = publicProfile.badgeEnabled === false;
  });

  const callHref = publicProfile.phoneE164 ? `tel:${publicProfile.phoneE164}` : "#";
  const emailHref = publicProfile.email ? `mailto:${publicProfile.email}` : "#";
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(publicProfile.mapQuery || publicProfile.addressLine1 || "")}`;

  const hrefs = {
    "business-call-action": callHref,
    "business-phone-link": callHref,
    "business-email-link": emailHref,
    "business-map-link": mapHref,
    "business-website-action": publicProfile.website || "#",
    "business-website-link": publicProfile.website || "#",
    "header-website-link": publicProfile.website || "#",
    "footer-website-link": publicProfile.website || "#",
    "business-instagram-link": publicProfile.instagram || "#",
    "business-facebook-link": publicProfile.facebook || "#"
  };

  Object.entries(hrefs).forEach(([id, href]) => {
    const node = document.getElementById(id);
    if (node) node.href = href;
  });

  const footerWebsite = document.getElementById("footer-website-link");
  if (footerWebsite) footerWebsite.textContent = publicProfile.website ? getProfileWebsiteLabel(publicProfile.website) : "";

  hideMissingProfileData();
  document.title = `${publicProfile.name} | ${V.team}`;
  updateBusinessOpenStatus();
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function initialsLogo(name, color) {
  const letters = String(name || "").replace(/^(colegio|escuela|liceo|instituto)\s+/i, "")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "A";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${color}"/><text x="48" y="50" font-family="-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="38" font-weight="600" fill="#fff" text-anchor="middle" dominant-baseline="central">${letters}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function applyBranding() {
  const root = document.documentElement;
  const brand = HEX_COLOR.test(publicProfile.brandColor || "") ? publicProfile.brandColor : "";
  const second = HEX_COLOR.test(publicProfile.secondaryColor || "") ? publicProfile.secondaryColor : "";
  if (brand) root.style.setProperty("--brand", brand); else root.style.removeProperty("--brand");
  if (second) root.style.setProperty("--brand-2", second); else root.style.removeProperty("--brand-2");

  const logo = publicProfile.logoUrl || initialsLogo(publicProfile.name, brand || "#2747d6");
  document.querySelectorAll("[data-brand-logo]").forEach((img) => { img.src = logo; });
}

function applyWelcomeMessage() {
  const node = document.getElementById("welcome-text");
  if (!node) return;
  const custom = String(publicProfile.welcomeMessage || "").trim();
  node.textContent = custom || (V.welcome || [
    `¡Hola! 👋 Soy el asistente de admisiones de ${publicProfile.name}.`,
    "",
    "Puedo ayudarte con la propuesta educativa, horarios, proceso de inscripción y costos.",
    "",
    "También puedo mostrarte horarios disponibles para coordinar una visita."
  ]).join("\n");
}

// A client may not have every channel. Hide rows and actions without data.
function hideMissingProfileData() {
  const p = publicProfile;
  const toggle = (id, show) => {
    const node = document.getElementById(id);
    if (node) node.hidden = !show;
  };
  const hasAddress = Boolean(p.addressLine1 || p.addressLine2 || p.mapQuery);
  toggle("business-map-link", hasAddress);
  toggle("business-location-action", hasAddress);
  toggle("business-phone-link", Boolean(p.phoneE164 || p.phoneDisplay));
  toggle("business-call-action", Boolean(p.phoneE164));
  toggle("business-email-link", Boolean(p.email));
  toggle("business-website-link", Boolean(p.website));
  toggle("business-website-action", Boolean(p.website));
  toggle("header-website-link", Boolean(p.website));
  toggle("business-instagram-link", Boolean(p.instagram));
  toggle("business-facebook-link", Boolean(p.facebook));

  // Category is already shown under the name in the hero.
  const category = document.getElementById("business-category-text")?.closest(".profile-info-row");
  if (category) category.hidden = true;

  const description = document.getElementById("business-description-text")?.closest(".profile-info-row");
  if (description) description.hidden = !(p.shortDescription || p.statusText);

  document.querySelectorAll(".profile-info-card").forEach((card) => {
    const rows = [...card.querySelectorAll(":scope > .profile-info-row, :scope > a")];
    if (rows.length) card.hidden = rows.every((row) => row.hidden || row.style.display === "none");
  });
}

function applyVocabulary() {
  const header = document.getElementById("booking-header");
  if (header) {
    header.title = V.ctaTitle;
    const label = header.querySelector("span");
    if (label) label.textContent = V.cta;
  }
  const chips = [...document.querySelectorAll(".quick-question")];
  const questionChips = chips.filter((chip) => chip.dataset.action !== "booking");
  (V.quick || []).forEach(([label, question], index) => {
    const chip = questionChips[index];
    if (!chip) return;
    chip.dataset.question = question;
    const span = chip.querySelector("span");
    if (span) span.textContent = label;
  });
  const bookingChip = chips.find((chip) => chip.dataset.action === "booking");
  if (bookingChip?.querySelector("span")) bookingChip.querySelector("span").textContent = V.ctaLong;
  document.querySelector(".chat-app")?.setAttribute("aria-label", `Chat de ${V.team.toLowerCase()}`);
  document.querySelector(".typing-bubble")?.setAttribute("aria-label", `${publicProfile.name || V.team} está escribiendo`);
}

async function loadPublicProfile() {
  try {
    const response = await fetch("/api/profile", {
      cache: "no-store",
      credentials: "same-origin"
    });
    const data = await response.json();
    if (response.ok && data.success && data.profile) {
      publicProfile = { ...publicProfile, ...data.profile };
      if (data.vocab) V = { ...V, ...data.vocab };
      CONTACT_COPY = buildContactCopy();
      applyVocabulary();
    }
  } catch (error) {
    console.error("No se pudo cargar el perfil público:", error);
  } finally {
    applyPublicProfile();
  }
}

function updateBusinessOpenStatus() {
  if (!businessOpenStatus) return;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Montevideo",
    weekday: "short",
    hour: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const weekdayLabel = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const weekdayMap = {Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
  const weekday = weekdayMap[weekdayLabel];
  const allowedDays = Array.isArray(publicProfile.weekdays) ? publicProfile.weekdays.map(Number) : [1,2,3,4,5];
  const isOpen = allowedDays.includes(weekday) &&
    hour >= Number(publicProfile.openHour ?? 8) &&
    hour < Number(publicProfile.closeHour ?? 18);

  businessOpenStatus.textContent = isOpen ? "Abierto ahora" : "Horario de atención";
  businessOpenStatus.classList.toggle("is-closed", !isOpen);
}

async function openBusinessProfile() {
  if (!businessProfile) return;
  await profilePromise;
  messageInput.blur();
  businessProfile.hidden = false;
  businessProfile.setAttribute("aria-hidden", "false");
  updateBusinessOpenStatus();

  requestAnimationFrame(() => {
    businessProfile.classList.add("is-open");
    businessProfileBack?.focus({ preventScroll: true });
  });
}

function closeBusinessProfile() {
  if (!businessProfile || businessProfile.hidden) return;

  businessProfile.classList.remove("is-open");
  businessProfile.setAttribute("aria-hidden", "true");

  setTimeout(() => {
    businessProfile.hidden = true;
    businessProfileTrigger?.focus({ preventScroll: true });
  }, 240);
}

async function shareBusinessProfile() {
  const shareData = {
    title: publicProfile.name,
    text: `${publicProfile.name} · ${V.team} · ${publicProfile.shortDescription || publicProfile.category}`,
    url: publicProfile.website || window.location.origin
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(shareData.url);
    businessShareButton?.classList.add("is-success");
    const original = businessShareButton?.querySelector("span:last-child");
    if (original) original.textContent = "Copiado";

    setTimeout(() => {
      businessShareButton?.classList.remove("is-success");
      if (original) original.textContent = "Compartir";
    }, 1400);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("No se pudo compartir el perfil:", error);
    }
  }
}

businessProfileTrigger?.addEventListener("click", openBusinessProfile);
businessProfileBack?.addEventListener("click", closeBusinessProfile);
businessShareButton?.addEventListener("click", shareBusinessProfile);

businessProfile?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeBusinessProfile();
});

function finishConversationBootstrap({ showWelcome = false } = {}) {
  const loading = document.getElementById("conversation-loading");
  if (loading) loading.remove();

  const welcome = document.querySelector(".welcome-card");
  if (welcome) welcome.hidden = !showWelcome;

  chatApp?.classList.remove("app-booting");
  contactStatus.textContent = "en línea";
  contactStatus.classList.remove("is-typing");
}

async function bootstrapConversation() {
  setLoading(true);

  try {
    const sessionUrl = "/api/chat/session";

    const response = await fetch(sessionUrl, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    });
    const data = await response.json();

    if (response.ok && data.success) {
      const restoredMessages = data.messages || [];
      restoreConversation(restoredMessages);
      currentAppointment = data.appointment || null;
      knownContact = data.contact || null;
      captureCallbackEnabled = data.callbackEnabled !== false;

      finishConversationBootstrap({
        showWelcome: restoredMessages.length === 0
      });

      if (currentAppointment) showAppointmentCard(currentAppointment);

      if (!pendingAction && lastAssistantOffersBooking()) {
        setPendingAction("booking");
      }
      if (pendingAction === "booking" && !currentAppointment) {
        addBookingAction();
      }
    } else {
      finishConversationBootstrap({ showWelcome: true });
    }
  } catch (error) {
    console.error("No se pudo restaurar la conversación:", error);
    finishConversationBootstrap({ showWelcome: true });
  } finally {
    setLoading(false);
    chatApp?.classList.remove("app-booting");
    if (contactStatus.textContent === "Conectando…") {
      contactStatus.textContent = "en línea";
    }
    scrollToBottom("auto");
  }
}

async function getAvailability() {
  const response = await fetch("/api/booking/availability?days=5", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || "No se pudo consultar la agenda.");
  return data.availability || [];
}

function describeDay(day) {
  const date = day.date ? new Date(`${day.date}T12:00:00`) : null;
  if (!date || Number.isNaN(date.getTime())) {
    const parts = String(day.label || "").split(" ");
    return { dow: (parts[0] || "").slice(0, 3), num: parts[1] || "", mon: (parts[3] || "").slice(0, 3), full: capitalize(day.label || "") };
  }
  const fmt = (options) => new Intl.DateTimeFormat("es-UY", options).format(date).replace(".", "");
  return { dow: fmt({ weekday: "short" }), num: String(date.getDate()), mon: fmt({ month: "short" }), full: capitalize(day.label || fmt({ weekday: "long", day: "numeric", month: "long" }).replace(",", "")) };
}

function renderSlots(availability, onSelect) {
  const days = availability.filter((day) => day?.slots?.length);
  const picker = document.createElement("div");
  picker.className = "slot-picker";
  picker.innerHTML = `
    <div class="slot-chips" role="tablist" aria-label="Días disponibles"></div>
    <p class="slot-day-label"></p>
    <div class="slot-times" role="group"></div>
  `;

  const chips = picker.querySelector(".slot-chips");
  const dayLabel = picker.querySelector(".slot-day-label");
  const times = picker.querySelector(".slot-times");

  function selectDay(index) {
    const day = days[index];
    const info = describeDay(day);
    chips.querySelectorAll(".slot-chip").forEach((chip, i) => {
      chip.classList.toggle("is-active", i === index);
      chip.setAttribute("aria-selected", String(i === index));
    });
    dayLabel.textContent = info.full;
    times.setAttribute("aria-label", `Horarios del ${info.full}`);
    times.innerHTML = "";

    day.slots.forEach((slot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-time";
      button.textContent = slot.label;
      button.addEventListener("click", () => {
        if (picker.classList.contains("is-done")) return;
        picker.classList.add("is-done");
        button.classList.add("is-selected");
        picker.querySelectorAll("button").forEach((node) => { node.disabled = true; });
        onSelect(slot, day);
      });
      times.appendChild(button);
    });
  }

  days.forEach((day, index) => {
    const info = describeDay(day);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "slot-chip";
    chip.setAttribute("role", "tab");
    chip.setAttribute("aria-label", info.full);
    chip.innerHTML = `<span class="slot-chip-dow">${escapeHtml(info.dow)}</span><span class="slot-chip-num">${escapeHtml(info.num)}</span>`;
    chip.addEventListener("click", () => {
      if (picker.classList.contains("is-done")) return;
      selectDay(index);
      chip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
    chips.appendChild(chip);
  });

  if (days.length) selectDay(0);
  return picker;
}

async function startBooking({ userMessage = isSchool() ? "Quiero agendar una visita." : `Quiero reservar ${V.appt.a}.`, echoUser = true } = {}) {
  await bootstrapPromise;
  setPendingAction(null);
  removeBookingAction();

  if (currentAppointment) {
    if (echoUser) addMessage(userMessage, "user");
    addMessage(`Ya tenés ${V.appt.a} ${V.appt.scheduled}. Podés cambiar${V.appt.pron} o cancelar${V.appt.pron} desde acá.`, "assistant");
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
      addMessage(`No encontré horarios disponibles en los próximos días. El equipo de ${V.team} puede ayudarte a coordinar otra opción.`, "assistant");
      return;
    }

    addMessage("Tengo estos horarios disponibles. Elegí el que te quede mejor:", "assistant");
    addCustomAssistantCard(renderSlots(availability, (slot, day) => {
      showBookingForm(slot.start, `${day.label} a las ${slot.label}`);
    }));
  } catch (error) {
    setTyping(false);
    addMessage("No pude consultar la agenda en este momento. Probá nuevamente en unos segundos.", "assistant");
    console.error("Agenda:", error);
  } finally {
    setLoading(false);
  }
}

const field = (name, label, attrs = "") => `
      <label class="field">
        <span>${label}</span>
        <input placeholder="${label}" name="${name}" ${attrs}>
      </label>`;

function bookingFieldsHtml() {
  const contact = `
    <div class="field-group">${field("adultName", "Nombre y apellido", 'autocomplete="name" required maxlength="200"')}${field("email", "Correo electrónico", 'type="email" inputmode="email" autocomplete="email" required maxlength="200"')}${field("phone", "Teléfono", 'type="tel" inputmode="tel" autocomplete="tel" required maxlength="80"')}
    </div>`;
  const more = (inner) => `
    <details class="field-group booking-more">
      <summary><span>Más información</span><small>Opcional</small>${uiIcon("chevron", "ui-icon booking-more-chevron")}</summary>${inner}
    </details>`;
  const comments = (label = "Comentarios") => `
      <label class="field">
        <span>${label}</span>
        <textarea placeholder="${label}" name="comments" rows="2" maxlength="1500"></textarea>
      </label>`;

  if (V.form === "health") {
    return `${contact}
    <div class="field-group">${field("reason", "Motivo de la consulta (opcional)", 'maxlength="300"')}
    </div>
    <p class="contact-hint">No hace falta que detalles síntomas: el profesional lo conversa en la consulta.</p>${more(`${field("documentId", "Cédula o documento", 'maxlength="40" inputmode="numeric"')}${field("insurance", "Cobertura o mutualista", 'maxlength="120"')}`)}`;
  }
  if (V.form === "beauty") {
    return `${contact}
    <div class="field-group">${field("service", "Servicio que te interesa (opcional)", 'maxlength="200"')}
    </div>${more(comments())}`;
  }
  if (V.form === "other") {
    return `${contact}
    <div class="field-group">${field("reason", "Motivo o servicio (opcional)", 'maxlength="300"')}
    </div>${more(comments())}`;
  }
  return `
    <div class="field-group">
      <label class="field">
        <span>Nombre y apellido</span>
        <input placeholder="Nombre y apellido" name="adultName" autocomplete="name" required maxlength="200">
      </label>
      <label class="field">
        <span>Correo electrónico</span>
        <input placeholder="Correo electrónico" name="email" type="email" inputmode="email" autocomplete="email" required maxlength="200">
      </label>
      <label class="field">
        <span>Teléfono</span>
        <input placeholder="Teléfono" name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="80">
      </label>
    </div>
    <div class="field-group">
      <label class="field">
        <span>Nombre del estudiante</span>
        <input placeholder="Nombre del estudiante" name="studentName" required maxlength="200">
      </label>
      <label class="field">
        <span>Fecha de nacimiento</span>
        <input name="birthDate" type="date" required>
      </label>
    </div>
    <details class="field-group booking-more">
      <summary><span>Más información</span><small>Opcional</small>${uiIcon("chevron", "ui-icon booking-more-chevron")}</summary>
      <label class="field">
        <span>Institución de la que proviene</span>
        <input placeholder="Institución de la que proviene" name="previousInstitution" maxlength="250">
      </label>
      <label class="field">
        <span>Comentarios</span>
        <textarea placeholder="Comentarios" name="comments" rows="2" maxlength="1500"></textarea>
      </label>
    </details>`;
}

function showBookingForm(startAt, label) {
  addMessage(`Me queda bien el ${label}.`, "user");

  const container = document.createElement("div");
  container.className = "booking-form-card";

  const head = document.createElement("div");
  head.className = "booking-head";
  head.innerHTML = `
    <span class="booking-head-copy">
      <strong>${escapeHtml(capitalize(label))}</strong>
      <small>${escapeHtml(V.bookingIntro)}</small>
    </span>
  `;
  const changeSlot = document.createElement("button");
  changeSlot.type = "button";
  changeSlot.className = "link-button";
  changeSlot.textContent = "Cambiar";
  changeSlot.addEventListener("click", () => {
    container.closest(".message-row")?.remove();
    startBooking({ echoUser: false });
  });
  head.appendChild(changeSlot);
  container.appendChild(head);

  const form = document.createElement("form");
  form.className = "booking-form";
  form.innerHTML = `${bookingFieldsHtml()}
    <label class="consent-row">
      <input name="privacyConsent" type="checkbox" value="true" required>
      <span>${escapeHtml(V.consentBooking)}</span>
    </label>
    <button type="submit" class="chat-btn chat-btn--primary booking-submit"><span>${escapeHtml(V.confirmButton)}</span></button>
  `;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.querySelector("span").textContent = "Confirmando…";
    setTyping(true, `confirmando ${V.appt.noun}…`);

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

      if (!response.ok || !data.success) throw new Error(data.message || `No se pudo confirmar ${V.appt.the}.`);

      currentAppointment = data.appointment;
      container.innerHTML = `
        <div class="booking-success">
          <p class="appt-status">${uiIcon("check")}Reserva enviada</p>
          <p>${escapeHtml(capitalize(label))}</p>
        </div>
      `;

      addMessage(`¡Listo! ${capitalize(V.appt.your)} quedó ${V.appt.scheduled}. Si necesitás cambiar el horario, decímelo acá mismo.`, "assistant");
      showAppointmentCard(currentAppointment);
    } catch (error) {
      setTyping(false);
      submit.disabled = false;
      submit.querySelector("span").textContent = V.confirmButton;
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
    addMessage(`No encontré ${V.appt.a} activ${apptO()} asociad${apptO()} a este chat.`, "assistant");
    return;
  }

  if (echoUser) addMessage(`Quiero cambiar el horario de mi ${V.appt.noun}.`, "user");
  setLoading(true);
  setTyping(true, "buscando otros horarios…");

  try {
    const availability = await getAvailability();
    setTyping(false);

    addMessage(
      `${capitalize(V.appt.your)} actual es ${currentAppointment.display}. Elegí un nuevo horario:`,
      "assistant"
    );

    addCustomAssistantCard(renderSlots(availability, async (slot, day) => {
      await rescheduleAppointment(slot.start, `${day.label} a las ${slot.label}`);
    }));
  } catch (error) {
    setTyping(false);
    addMessage("No pude consultar otros horarios en este momento.", "assistant");
  } finally {
    setLoading(false);
  }
}

async function rescheduleAppointment(startAt, label) {
  setTyping(true, `reprogramando ${V.appt.noun}…`);

  try {
    const response = await fetch("/api/booking/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "reschedule", startAt })
    });
    const data = await response.json();
    setTyping(false);

    if (!response.ok || !data.success) throw new Error(data.message || `No se pudo cambiar ${V.appt.the}.`);

    addMessage(`Me queda bien el ${label}.`, "user");
    currentAppointment = data.appointment;
    addMessage(`Listo, cambié ${V.appt.your}.`, "assistant");
    showAppointmentCard(currentAppointment);
  } catch (error) {
    setTyping(false);
    addMessage(error.message || `No se pudo cambiar ${V.appt.the}.`, "assistant");
  }
}

function showCancelConfirmation({ echoUser = false } = {}) {
  if (!currentAppointment) return;
  if (echoUser) addMessage(`Quiero cancelar mi ${V.appt.noun}.`, "user");

  const wrapper = document.createElement("div");
  wrapper.className = "cancel-confirmation";

  const { date, time } = splitAppointmentDisplay(currentAppointment.display);
  const text = document.createElement("p");
  text.textContent = `¿Cancelar ${V.appt.the} del ${date.toLowerCase()}${time ? ` a las ${time}` : ""}?`;

  const actions = document.createElement("div");
  actions.className = "bubble-actions bubble-actions--split";
  actions.append(
    bubbleButton("Mantener", { onClick: () => wrapper.closest(".message-row")?.remove() }),
    bubbleButton("Sí, cancelar", { tone: "danger-solid", onClick: () => cancelAppointment(wrapper) })
  );

  wrapper.append(text, actions);
  addCustomAssistantCard(wrapper);
}

async function cancelAppointment(confirmation = null) {
  confirmation?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  setTyping(true, `cancelando ${V.appt.noun}…`);

  try {
    const response = await fetch("/api/booking/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "cancel" })
    });
    const data = await response.json();
    setTyping(false);

    if (!response.ok || !data.success) throw new Error(data.message || `No se pudo cancelar ${V.appt.the}.`);

    const { date, time } = splitAppointmentDisplay(currentAppointment?.display || "");
    currentAppointment = null;
    removeAppointmentCard();
    if (confirmation) {
      confirmation.innerHTML = `
        <div class="booking-success">
          <p class="appt-status appt-status--cancelled">${uiIcon("x")}${escapeHtml(V.appt.cancelled)}</p>
          ${date ? `<p>${escapeHtml(date)}${time ? ` · ${escapeHtml(time)}` : ""}</p>` : ""}
        </div>`;
    }
    addMessage(`Listo. ${capitalize(V.appt.the)} quedó ${V.appt.cancelledAdj}. Cuando quieras, podemos coordinar otra fecha o, si preferís, alguien de ${V.team} te llama.`, "assistant");
    addFollowUpActions([
      ["Elegir otra fecha", () => startBooking({ userMessage: "Quiero elegir otra fecha.", echoUser: true })],
      ...(captureCallbackEnabled ? [["Que me llamen", () => showContactCard("callback", { echo: CONTACT_COPY.callback.echo })]] : [])
    ]);
  } catch (error) {
    confirmation?.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    setTyping(false);
    addMessage(error.message || `No se pudo cancelar ${V.appt.the}.`, "assistant");
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
          history: conversationHistory,
          ...attribution
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
    const reason = contactReason(nextAction);
    if (reason && data.openContact) showContactCard(reason);
    else if (reason && (!contactCaptured || reason === "callback")) addContactAction(reason);
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

  const offeredContact = contactReason(pendingAction);
  if (offeredContact && !contactCaptured && isAffirmative(cleanText) && !isBookingIntent(cleanText) && cleanText.split(/\s+/).length <= 5) {
    addMessage(cleanText, "user");
    removeBookingAction();
    showContactCard(offeredContact);
    return;
  }
  if (offeredContact && isNegative(cleanText)) {
    setPendingAction(null);
    removeBookingAction();
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
  if (!usesSoftwareKeyboardViewport) {
    document.documentElement.style.removeProperty("--visual-height");
    document.documentElement.style.removeProperty("--visual-top");
    return;
  }

  const viewport = window.visualViewport;
  const height = viewport ? viewport.height : window.innerHeight;
  const top = viewport ? viewport.offsetTop : 0;

  document.documentElement.style.setProperty("--visual-height", `${Math.round(height)}px`);
  document.documentElement.style.setProperty("--visual-top", `${Math.round(top)}px`);
}

let viewportTrackUntil = 0;
let viewportTrackFrame = 0;

function trackViewport(duration = 700) {
  viewportTrackUntil = Math.max(viewportTrackUntil, performance.now() + duration);
  if (viewportTrackFrame) return;
  const step = () => {
    syncVisualViewport();
    // Keep the layout pinned: the header never scrolls away, only the
    // conversation area shrinks and stays anchored to the latest message.
    if (window.scrollY !== 0) window.scrollTo(0, 0);
    if (performance.now() < viewportTrackUntil) {
      viewportTrackFrame = requestAnimationFrame(step);
    } else {
      viewportTrackFrame = 0;
    }
  };
  viewportTrackFrame = requestAnimationFrame(step);
}

function settleKeyboardViewport() {
  if (!usesSoftwareKeyboardViewport) return;

  const nearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 120;
  trackViewport(800);
  if (nearBottom || document.body.classList.contains("keyboard-open")) {
    [60, 180, 360, 620].forEach((delay) => setTimeout(() => scrollToBottom("auto"), delay));
  }
}

let keepComposerFocused = false;
let sendPointerHandled = false;

sendButton.addEventListener("pointerdown", (event) => {
  if (sendButton.disabled) return;

  keepComposerFocused = true;

  // Prevent iOS/WebKit from moving focus from the textarea to the button.
  if (document.activeElement === messageInput) {
    event.preventDefault();
  }
});

sendButton.addEventListener("pointerup", (event) => {
  if (sendButton.disabled) return;

  event.preventDefault();
  sendPointerHandled = true;
  chatForm.requestSubmit();

  requestAnimationFrame(() => {
    messageInput.focus({ preventScroll: true });
  });

  setTimeout(() => {
    keepComposerFocused = false;
    sendPointerHandled = false;
  }, 350);
});

sendButton.addEventListener("pointercancel", () => {
  keepComposerFocused = false;
  sendPointerHandled = false;
});

sendButton.addEventListener("click", (event) => {
  if (sendPointerHandled) {
    event.preventDefault();
  }
});

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
  if (!usesSoftwareKeyboardViewport) return;
  document.body.classList.add("keyboard-open");
  settleKeyboardViewport();
});

messageInput.addEventListener("blur", () => {
  if (keepComposerFocused) {
    requestAnimationFrame(() => {
      messageInput.focus({ preventScroll: true });
    });
    return;
  }

  if (!usesSoftwareKeyboardViewport) return;
  document.body.classList.remove("keyboard-open");
  setTimeout(syncVisualViewport, 80);
});

if (usesSoftwareKeyboardViewport) {
  window.visualViewport?.addEventListener("resize", settleKeyboardViewport);
  window.visualViewport?.addEventListener("scroll", () => trackViewport(300));

  // iOS lets the user drag the whole page while the keyboard is open, which
  // moves the header out of view. Only real scroll areas may scroll.
  document.addEventListener("touchmove", (event) => {
    if (!document.body.classList.contains("keyboard-open")) return;
    const scroller = event.target.closest?.(".messages, .slot-chips, .chat-form textarea");
    if (!scroller) event.preventDefault();
  }, { passive: false });
  window.addEventListener("resize", syncVisualViewport);
  window.addEventListener("orientationchange", settleKeyboardViewport);
}

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
const profilePromise = loadPublicProfile();
const bootstrapPromise = bootstrapConversation();
