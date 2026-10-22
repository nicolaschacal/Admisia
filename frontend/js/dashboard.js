/* AdmisIA — panel de admisiones */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const authScreen = $("#auth-screen");
const loginForm = $("#login-form");
const setupForm = $("#setup-form");
const crmApp = $("#crm-app");
const view = $("#view");
const viewTitle = $("#view-title");
const leadSearch = $("#lead-search");
const searchWrap = $("#search-wrap");
const leadModal = $("#lead-modal");
const leadDetail = $("#lead-detail");
const sidebar = $("#sidebar");
const scrim = $("#sidebar-scrim");
const dialog = $("#dialog");
const dialogBody = $("#dialog-body");

let STAGES = [
  ["new_inquiry", "Nuevos"],
  ["qualified", "Interesados"],
  ["visit_scheduled", "Visita agendada"],
  ["followup", "Seguimiento"],
  ["application_started", "Inscripción"],
  ["waitlist", "Lista de espera"],
  ["enrolled", "Confirmados"],
  ["lost", "No continúa"]
];
let STAGE_LABEL = Object.fromEntries(STAGES);

// Vocabulary of the business type (rubro); defaults are the original school texts.
let V = {
  type: "school",
  team: "Admisiones",
  panelName: "Panel de admisiones",
  client: "familia", clients: "familias", Client: "Familia", Clients: "Familias",
  lead: "candidato", Lead: "Candidato", Leads: "Candidatos",
  person: "estudiante",
  vacancyLabel: "Aviso de vacantes",
  vacancyOption: ["Aviso de vacantes", "Si pregunta por cupos, inscripciones o el año próximo, el asistente ofrece avisarle cuando haya novedades."],
  vacancyTextLabel: "Novedades de inscripción",
  vacancyTextPlaceholder: "Ej. Las inscripciones para 2027 abren el 1 de noviembre. Quedan pocos lugares en Inicial 4.",
  vacancyTextHelp: "Opcional. El asistente lo usa al hablar de vacantes e inscripciones.",
  searchPlaceholder: "Buscar familia, estudiante o correo",
  knowledgeHint: "Agregá precios, horarios, niveles y todo lo que las familias suelen preguntar.",
  appt: { noun: "visita", Noun: "Visita", plural: "visitas", Plural: "Visitas", a: "una visita", the: "la visita", pron: "la", scheduled: "agendada" }
};
let BUSINESS_TYPES = [];
const isSchool = () => V.type === "school";
// "Visitas próximas" / "Turnos próximos": adjectives agree with the noun.
const agree = (base) => `${base}${V.appt.pron === "la" ? "a" : "o"}`;
const agreePl = (base) => `${base}${V.appt.pron === "la" ? "as" : "os"}`;

function applyDashboardVocab() {
  if (V.stages) {
    STAGES = STAGES.map(([key, label]) => [key, V.stages[key] || label]);
    STAGE_LABEL = Object.fromEntries(STAGES);
  }
  VIEW_TITLES.pipeline = V.Leads;
  if (V.appt.pron === "lo") {
    APPT_STATUS = {
      scheduled: ["Agendado", ""],
      confirmed: ["Confirmado", "pill-accent"],
      completed: ["Realizado", "pill-success"],
      no_show: ["No asistió", "pill-warning"],
      cancelled: ["Cancelado", "pill-danger"]
    };
  }
  const navLabel = $('[data-view="pipeline"] span');
  if (navLabel) navLabel.textContent = V.Leads;
  if (leadSearch) leadSearch.placeholder = V.searchPlaceholder;
  CAPTURE_LABEL.vacancy = V.vacancyLabel;
  $$(".brand-copy span, .auth-brand span").forEach((node) => { if (!node.hasAttribute("data-brand-name")) node.textContent = V.panelName; });
}

let APPT_STATUS = {
  scheduled: ["Agendada", ""],
  confirmed: ["Confirmada", "pill-accent"],
  completed: ["Realizada", "pill-success"],
  no_show: ["No asistió", "pill-warning"],
  cancelled: ["Cancelada", "pill-danger"]
};

const CAPTURE_LABEL = {
  info: "Pidió información",
  vacancy: "Aviso de vacantes",
  brochure: "Pidió el folleto",
  callback: "Pidió que lo llamen",
  detected: "Dejó su contacto"
};
const INTEREST_LABEL = { high: "Alto", medium: "Medio", low: "Bajo" };

const ROLES = { admin: "Administrador", manager: "Gestor", viewer: "Solo lectura" };
const WEEKDAYS = [[1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"], [7, "Dom"]];

const VIEW_TITLES = {
  overview: "Resumen",
  pipeline: "Candidatos",
  agenda: "Agenda",
  followups: "Seguimientos",
  inquiries: "Conversaciones",
  knowledge: "Base de conocimiento",
  settings: "Configuración"
};

const ICONS = {
  chevron: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  phone: '<path d="M7.2 3.5 4.8 5.9c-.8.8-.9 2-.4 3 2.4 4.7 6 8.3 10.7 10.7 1 .5 2.2.4 3-.4l2.4-2.4-4-4-2 2c-.4.4-1 .5-1.5.2-1.7-1-3-2.3-4-4-.3-.5-.2-1.1.2-1.5l2-2-4-4Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  whatsapp: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-1-.4-1.9-1.3-2.3-2.3l.8-1-1-2z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  mailOut: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  calendar: '<path d="M7 3v3M17 3v3M3.5 9.5h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
};
const icon = (name, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;

let currentView = "overview";
let currentManager = null;
let settingsTab = "start";
let settingsCache = null;
let brand = { name: "Panel de admisiones", logo: "" };

/* ---------- Utils ---------- */

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function fmtDate(value, options = { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-UY", options).format(d);
}
const fmtTime = (value) => fmtDate(value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmtLongDay = (value) => fmtDate(value, { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
const fmtDay = (value) => fmtDate(value, { day: "numeric", month: "short" });

function relativeDue(value) {
  const d = new Date(value);
  const diffDays = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "mañana";
  if (diffDays === -1) return "ayer";
  if (diffDays < 0) return `hace ${-diffDays} días`;
  return `en ${diffDays} días`;
}
function startOfDay(d) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "·";
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || "No se pudo completar la acción.");
    error.status = response.status;
    throw error;
  }
  return data;
}
const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body || {}) });

function toast(message, { error = false } = {}) {
  const node = document.createElement("div");
  node.className = `toast${error ? " is-error" : ""}`;
  node.textContent = message;
  $("#toasts").appendChild(node);
  setTimeout(() => node.remove(), error ? 5200 : 3200);
}

function openDialog(html, { wide = false } = {}) {
  dialogBody.innerHTML = html;
  $(".dialog", dialog).classList.toggle("dialog-wide", wide);
  dialog.hidden = false;
  setTimeout(() => $("input, textarea, select, button", dialogBody)?.focus(), 30);
  return dialogBody;
}
function closeDialog() { dialog.hidden = true; dialogBody.innerHTML = ""; }
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });

function confirmDialog(message, { title = "¿Confirmás?", confirmLabel = "Confirmar", danger = false } = {}) {
  return new Promise((resolve) => {
    const body = openDialog(`
      <div class="card-head"><h2>${esc(title)}</h2></div>
      <div class="card-body"><p>${esc(message)}</p>
        <div class="form-actions">
          <button class="btn btn-ghost" data-answer="no">Volver</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-answer="yes">${esc(confirmLabel)}</button>
        </div>
      </div>`);
    $$("[data-answer]", body).forEach((btn) => btn.addEventListener("click", () => {
      closeDialog();
      resolve(btn.dataset.answer === "yes");
    }));
  });
}

async function withBusy(button, label, fn) {
  const original = button?.innerHTML;
  if (button) { button.disabled = true; button.textContent = label; }
  try {
    return await fn();
  } finally {
    if (button) { button.disabled = false; button.innerHTML = original; }
  }
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).then(() => toast("Copiado.")).catch(() => {});
}

/* ---------- Brand ---------- */

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const DEFAULT_BRAND = "#2747d6";

function initialsLogo(name, color) {
  const letters = String(name || "").replace(/^(colegio|escuela|liceo|instituto)\s+/i, "")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "A";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${color}"/><text x="48" y="50" font-family="-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="38" font-weight="600" fill="#fff" text-anchor="middle" dominant-baseline="central">${letters}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function loadBrand() {
  try {
    const data = await api(`/api/profile?t=${Date.now()}`);
    const p = data.profile || {};
    if (data.vocab) V = { ...V, ...data.vocab };
    if (data.businessTypes) BUSINESS_TYPES = data.businessTypes;
    applyDashboardVocab();
    const color = HEX_COLOR.test(p.brandColor || "") ? p.brandColor : "";
    if (color) document.documentElement.style.setProperty("--brand", color);
    else document.documentElement.style.removeProperty("--brand");
    brand = { name: p.name || brand.name, logo: p.logoUrl || initialsLogo(p.name, color || DEFAULT_BRAND) };
  } catch { /* keep defaults */ }
  $$("[data-brand-name]").forEach((node) => { node.textContent = brand.name; });
  if (brand.logo) $$(".auth-logo, .brand-logo").forEach((img) => { img.src = brand.logo; });
  document.title = `${V.panelName} · ${brand.name}`;
}

/* ---------- Auth ---------- */

async function init() {
  await loadBrand();
  try {
    const data = await api("/api/crm/me");
    showApp(data.manager);
  } catch {
    await showAuth();
  }
}

async function showAuth() {
  crmApp.hidden = true;
  authScreen.hidden = false;
  let needsSetup = false;
  try {
    needsSetup = (await api("/api/crm/setup")).needsSetup;
  } catch { /* database not ready: show login */ }
  if (needsSetup) {
    // Fresh install: don't show the bundled demo brand.
    $$("[data-brand-name]").forEach((node) => { node.textContent = "AdmisIA"; });
    $$(".auth-logo").forEach((img) => { img.hidden = true; });
  }
  setupForm.hidden = !needsSetup;
  loginForm.hidden = needsSetup;
  $("input", needsSetup ? setupForm : loginForm)?.focus();
}

function showApp(manager) {
  currentManager = manager;
  authScreen.hidden = true;
  crmApp.hidden = false;
  $("#manager-name").textContent = manager.name || manager.email;
  $("#manager-role").textContent = ROLES[manager.role] || manager.role;
  $("#user-avatar").textContent = initials(manager.name || manager.email);
  navigate(currentView);
  refreshBadges();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("#login-error");
  error.hidden = true;
  const button = $("button[type=submit]", loginForm);
  try {
    const data = await withBusy(button, "Ingresando…", () => post("/api/crm/login", Object.fromEntries(new FormData(loginForm))));
    loginForm.reset();
    showApp(data.manager);
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  }
});

setupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("#setup-error");
  error.hidden = true;
  const button = $("button[type=submit]", setupForm);
  try {
    const data = await withBusy(button, "Creando…", () => post("/api/crm/setup", Object.fromEntries(new FormData(setupForm))));
    setupForm.reset();
    $$(".auth-logo").forEach((img) => { img.hidden = false; });
    await loadBrand();
    currentView = "settings";
    settingsTab = "start";
    showApp(data.manager);
    toast("Cuenta creada. Seguí los pasos para dejar todo listo.");
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  }
});

$("#logout-button").addEventListener("click", async () => {
  await post("/api/crm/logout").catch(() => {});
  currentManager = null;
  showAuth();
});

/* ---------- Navigation ---------- */

function setSidebar(open) {
  sidebar.classList.toggle("is-open", open);
  scrim.hidden = !open;
}
$("#menu-button").addEventListener("click", () => setSidebar(true));
scrim.addEventListener("click", () => setSidebar(false));

$$(".nav-item").forEach((button) => button.addEventListener("click", () => {
  setSidebar(false);
  navigate(button.dataset.view);
}));

function navigate(name, options = {}) {
  currentView = name;
  if (options.tab) settingsTab = options.tab;
  $$(".nav-item").forEach((b) => b.classList.toggle("is-active", b.dataset.view === name));
  viewTitle.textContent = VIEW_TITLES[name] || "";
  searchWrap.hidden = name !== "pipeline";
  loadView();
}

$("#refresh-button").addEventListener("click", () => { loadView(); refreshBadges(); });
leadSearch.addEventListener("input", debounce(() => currentView === "pipeline" && loadPipeline(), 300));

function loadView() {
  const loaders = {
    overview: loadOverview,
    pipeline: loadPipeline,
    agenda: loadAgenda,
    followups: loadFollowups,
    inquiries: loadInquiries,
    knowledge: () => loadKnowledge(),
    settings: loadSettings
  };
  return (loaders[currentView] || loadOverview)();
}

function setLoading(text = "Cargando…") {
  view.innerHTML = `<div class="loading">${esc(text)}</div>`;
}

function handleViewError(error) {
  if (error.status === 401) return showAuth();
  view.innerHTML = `<div class="card"><div class="empty"><strong>No se pudo cargar esta sección</strong>${esc(error.message)}</div></div>`;
}

async function refreshBadges() {
  try {
    const summary = (await api("/api/crm/summary")).summary;
    const count = $("#nav-followups-count");
    count.textContent = summary.overdue_followups;
    count.hidden = !Number(summary.overdue_followups);
  } catch { /* ignore */ }
  if (currentManager?.role === "admin") {
    try {
      const { checklist } = await api("/api/crm/integrations");
      $("#nav-setup-dot").hidden = checklist.filter((c) => c.required).every((c) => c.done);
    } catch { /* ignore */ }
  }
}

function wireLeadOpeners(root = view) {
  $$("[data-lead]", root).forEach((el) => el.addEventListener("click", (event) => {
    if (event.target.closest("[data-stop]")) return;
    if (el.dataset.lead) openLead(el.dataset.lead);
  }));
}

/* ---------- Overview ---------- */

async function loadOverview() {
  setLoading();
  try {
    const isAdmin = currentManager?.role === "admin";
    const [summary, followups, appointments, setup] = await Promise.all([
      api("/api/crm/summary"),
      api("/api/crm/followups?status=pending"),
      api("/api/crm/appointments"),
      isAdmin ? api("/api/crm/integrations").catch(() => null) : null
    ]);

    const s = summary.summary;
    const now = new Date();
    const upcoming = appointments.appointments
      .filter((a) => ["scheduled", "confirmed"].includes(a.status) && new Date(a.start_at) >= now)
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
      .slice(0, 6);
    const due = followups.followups.slice(0, 6);

    const required = setup?.checklist?.filter((c) => c.required) || [];
    const doneCount = required.filter((c) => c.done).length;
    const showSetup = isAdmin && required.length && doneCount < required.length;

    view.innerHTML = `
      ${showSetup ? `
        <div class="card setup-banner">
          <div class="setup-banner-copy">
            <strong>Terminá de configurar el panel</strong>
            <span>${doneCount} de ${required.length} pasos listos. Faltan ${required.filter((c) => !c.done).map((c) => c.label.toLowerCase()).join(", ")}.</span>
            <div class="progress"><i style="width:${Math.round((doneCount / required.length) * 100)}%"></i></div>
          </div>
          <button class="btn btn-primary" data-go="settings">Continuar</button>
        </div>` : ""}

      <div class="stats">
        <div class="card stat"><span>${isSchool() ? "Consultas" : "Conversaciones"} (30 días)</span><strong>${s.inquiries_30d}</strong></div>
        <div class="card stat"><span>${esc(V.Leads)} nuevos (30 días)</span><strong>${s.leads_30d}</strong></div>
        <button class="card stat stat-link" data-go-contacts><span>Contactos sin ${esc(V.appt.noun)} (30 días)</span><strong>${s.contacts_no_visit_30d ?? 0}</strong></button>
        <div class="card stat"><span>${esc(V.appt.Plural)} ${agreePl("próxim")}</span><strong>${s.upcoming_appointments}</strong></div>
        <div class="card stat ${Number(s.overdue_followups) ? "is-alert" : ""}"><span>Seguimientos vencidos</span><strong>${s.overdue_followups}</strong></div>
      </div>

      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h2>${esc(cap(agreePl("próxim")))} ${esc(V.appt.plural)}</h2><button class="btn btn-ghost btn-sm" data-go="agenda">Ver agenda</button></div>
          <div class="list">
            ${upcoming.length ? upcoming.map((a) => `
              <button class="list-row" data-lead="${esc(a.lead_id || "")}">
                <span class="time-col">${fmtTime(a.start_at)}</span>
                <span class="list-row-main"><strong>${esc(a.student_name || a.adult_name || "Sin nombre")}</strong><span>${esc(fmtLongDay(a.start_at))} · ${esc(a.adult_name || "")}</span></span>
                ${icon("chevron", "chevron")}
              </button>`).join("") : `<div class="empty">No hay ${esc(V.appt.plural)} ${esc(agreePl("agendad"))}.</div>`}
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Seguimientos pendientes</h2><button class="btn btn-ghost btn-sm" data-go="followups">Ver todos</button></div>
          <div class="list">
            ${due.length ? due.map((f) => {
              const overdue = new Date(f.due_at) < now;
              return `
              <button class="list-row" data-lead="${esc(f.lead_id || "")}">
                <span class="list-row-main"><strong>${esc(f.student_name || f.adult_name || "Sin nombre")}</strong><span>${esc(f.title)}</span></span>
                <span class="list-row-aside"><span class="pill ${overdue ? "pill-danger" : ""}">${esc(relativeDue(f.due_at))}</span></span>
              </button>`;
            }).join("") : '<div class="empty">Sin seguimientos pendientes.</div>'}
          </div>
        </section>
      </div>
    `;

    wireLeadOpeners();
    $$("[data-go]", view).forEach((btn) => btn.addEventListener("click", () => navigate(btn.dataset.go)));
    $("[data-go-contacts]", view)?.addEventListener("click", () => { pipelineMode = "contacts"; navigate("pipeline"); });
  } catch (error) {
    handleViewError(error);
  }
}

/* ---------- Pipeline ---------- */

let pipelineMode = "board";

async function loadPipeline() {
  if (!view.querySelector(".pipeline, .contacts-list")) setLoading(`Cargando ${V.Leads.toLowerCase()}…`);
  try {
    const search = leadSearch.value.trim();
    const qs = (extra) => {
      const p = new URLSearchParams(extra);
      if (search) p.set("search", search);
      const str = p.toString();
      return str ? `?${str}` : "";
    };
    const [data, contacts] = await Promise.all([
      pipelineMode === "board" ? api(`/api/crm/leads${qs({})}`) : null,
      api(`/api/crm/leads${qs({ capture: "no_visit" })}`)
    ]);

    const toolbar = `
      <div class="agenda-toolbar">
        <div class="segmented" role="tablist" aria-label="Vista de ${esc(V.Leads.toLowerCase())}">
          <button role="tab" data-pmode="board" class="${pipelineMode === "board" ? "is-active" : ""}">Embudo</button>
          <button role="tab" data-pmode="contacts" class="${pipelineMode === "contacts" ? "is-active" : ""}">Contactos sin ${esc(V.appt.noun)}${contacts.leads.length ? ` <span class="seg-count">${contacts.leads.length}</span>` : ""}</button>
        </div>
      </div>`;

    if (pipelineMode === "contacts") {
      view.innerHTML = `${toolbar}
        <section class="card contacts-list">
          <div class="card-head"><div><h2>Contactos sin ${esc(V.appt.noun)}</h2><p>${isSchool() ? "Familias que dejaron sus datos en el chat pero todavía no agendaron. Llamalas o escribiles." : `Personas que dejaron sus datos en el chat pero todavía no reservaron. Llamalas o escribiles.`}</p></div></div>
          <div class="list">
            ${contacts.leads.length ? contacts.leads.map((lead) => {
              const wa = String(lead.phone || "").replace(/[^\d]/g, "");
              return `
              <div class="list-row contact-row">
                <button class="list-row-main contact-open" data-lead="${esc(lead.id)}">
                  <strong>${esc(lead.adult_name || lead.phone || lead.email || "Sin nombre")}</strong>
                  <span>${esc(CAPTURE_LABEL[lead.capture_source] || "Contacto")}${lead.capture_detail ? ` · ${esc(lead.capture_detail)}` : ""} · ${esc(relativeDue(lead.created_at))}</span>
                  ${lead.ai_primary_concern ? `<span class="contact-concern">${icon("sparkle")}${esc(lead.ai_primary_concern)}</span>` : ""}
                </button>
                <span class="list-row-aside contact-actions-inline">
                  ${lead.ai_interest_level ? `<span class="pill ${lead.ai_interest_level === "high" ? "pill-success" : lead.ai_interest_level === "medium" ? "pill-warning" : ""}">Interés ${esc(INTEREST_LABEL[lead.ai_interest_level] || lead.ai_interest_level)}</span>` : ""}
                  ${wa ? `<a class="icon-btn" href="https://wa.me/${esc(wa.startsWith("0") ? `598${wa.slice(1)}` : wa)}" target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp">${icon("whatsapp")}</a>` : ""}
                  ${lead.phone ? `<a class="icon-btn" href="tel:${esc(lead.phone)}" title="Llamar" aria-label="Llamar">${icon("phone")}</a>` : ""}
                  ${lead.email ? `<a class="icon-btn" href="mailto:${esc(lead.email)}" title="Correo" aria-label="Correo">${icon("mail")}</a>` : ""}
                </span>
              </div>`;
            }).join("") : '<div class="empty"><strong>Sin contactos pendientes</strong>${isSchool() ? "Cuando una familia deje su teléfono o correo en el chat sin agendar, aparece acá." : "Cuando alguien deje su teléfono o correo en el chat sin reservar, aparece acá."}</div>'}
          </div>
        </section>`;
    } else {
      const grouped = Object.fromEntries(STAGES.map(([key]) => [key, []]));
      data.leads.forEach((lead) => (grouped[lead.status] || grouped.new_inquiry).push(lead));
      view.innerHTML = `${toolbar}
      <div class="pipeline">
        ${STAGES.map(([key, label]) => `
          <section class="stage">
            <div class="stage-head"><span>${label}</span><span class="stage-count">${grouped[key].length}</span></div>
            <div class="stage-body">
              ${grouped[key].map((lead) => `
                <button class="lead-card" data-lead="${esc(lead.id)}">
                  <strong>${esc(lead.student_name || lead.adult_name || lead.phone || lead.email || "Sin nombre")}</strong>
                  ${lead.student_name && lead.adult_name ? `<span>${esc(lead.adult_name)}</span>` : ""}
                  <span>${esc(lead.level_interest || (lead.capture_source && lead.capture_source !== "booking" ? CAPTURE_LABEL[lead.capture_source] || "Contacto" : "Nivel sin definir"))}</span>
                  <span class="lead-meta">
                    ${lead.capture_source && lead.capture_source !== "booking" && !lead.next_appointment ? `<span class="pill pill-warning">Sin ${esc(V.appt.noun)}</span>` : ""}
                    ${lead.next_appointment ? `<span class="pill pill-accent">${esc(V.appt.Noun)} ${esc(fmtDay(lead.next_appointment))}</span>` : ""}
                    ${lead.next_followup ? `<span class="pill ${new Date(lead.next_followup) < new Date() ? "pill-danger" : ""}">Seguimiento ${esc(fmtDay(lead.next_followup))}</span>` : ""}
                    ${lead.ai_interest_level ? `<span class="pill">Interés ${esc(INTEREST_LABEL[lead.ai_interest_level] || lead.ai_interest_level)}</span>` : ""}
                  </span>
                </button>`).join("") || `<div class="stage-empty">Sin ${esc(V.Leads.toLowerCase())}</div>`}
            </div>
          </section>`).join("")}
      </div>`;
    }

    $$("[data-pmode]", view).forEach((btn) => btn.addEventListener("click", () => {
      if (pipelineMode === btn.dataset.pmode) return;
      pipelineMode = btn.dataset.pmode;
      view.innerHTML = "";
      loadPipeline();
    }));
    wireLeadOpeners();
  } catch (error) {
    handleViewError(error);
  }
}

/* ---------- Agenda ---------- */

/* Agenda: list (upcoming), week (time grid) and month views. */
const AGENDA_MODES = [["list", "Lista"], ["week", "Semana"], ["month", "Mes"]];
let agendaMode = (() => { try { return localStorage.getItem("admisia_agenda_mode") || "week"; } catch { return "week"; } })();
let agendaDate = new Date();
const HOUR_PX = 64;

const dayKey = (d) => new Date(d).toLocaleDateString("en-CA");
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function startOfWeek(d) { const c = startOfDay(d); const dow = (c.getDay() + 6) % 7; return addDays(c, -dow); }
function startOfMonth(d) { const c = startOfDay(d); c.setDate(1); return c; }
function cap(text) { return String(text || "").replace(/^./, (c) => c.toUpperCase()); }

function agendaRange() {
  if (agendaMode === "week") {
    const from = startOfWeek(agendaDate);
    return { from, to: addDays(from, 7) };
  }
  if (agendaMode === "month") {
    const first = startOfMonth(agendaDate);
    const from = startOfWeek(first);
    return { from, to: addDays(from, 42), first };
  }
  return null;
}

function agendaTitle() {
  const range = agendaRange();
  if (!range) return `${cap(agreePl("próxim"))} ${V.appt.plural}`;
  if (agendaMode === "month") return cap(fmtDate(range.first, { month: "long", year: "numeric" }));
  const end = addDays(range.from, 6);
  const sameMonth = range.from.getMonth() === end.getMonth();
  const left = fmtDate(range.from, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  return `${left} – ${fmtDate(end, { day: "numeric", month: sameMonth ? "long" : "short", year: "numeric" })}`;
}

async function loadAgenda() {
  const range = agendaRange();
  view.innerHTML = `
    <div class="agenda-toolbar">
      <div class="segmented" role="tablist" aria-label="Vista de agenda">
        ${AGENDA_MODES.map(([id, label]) => `<button role="tab" data-mode="${id}" aria-selected="${id === agendaMode}" class="${id === agendaMode ? "is-active" : ""}">${label}</button>`).join("")}
      </div>
      ${range ? `
      <div class="agenda-nav">
        <button class="btn btn-ghost btn-sm" data-nav="today">Hoy</button>
        <button class="icon-btn" data-nav="-1" aria-label="Anterior"><svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg></button>
        <button class="icon-btn" data-nav="1" aria-label="Siguiente"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button>
        <h2 class="agenda-title">${esc(agendaTitle())}</h2>
      </div>` : `<h2 class="agenda-title">${esc(agendaTitle())}</h2>`}
    </div>
    <div id="agenda-body" class="agenda-body"><div class="loading">Cargando agenda…</div></div>`;

  $$("[data-mode]", view).forEach((btn) => btn.addEventListener("click", () => {
    agendaMode = btn.dataset.mode;
    try { localStorage.setItem("admisia_agenda_mode", agendaMode); } catch { /* ignore */ }
    loadAgenda();
  }));
  $$("[data-nav]", view).forEach((btn) => btn.addEventListener("click", () => {
    const step = btn.dataset.nav;
    if (step === "today") agendaDate = new Date();
    else if (agendaMode === "week") agendaDate = addDays(agendaDate, 7 * Number(step));
    else { const d = new Date(agendaDate); d.setDate(1); d.setMonth(d.getMonth() + Number(step)); agendaDate = d; }
    loadAgenda();
  }));

  const body = $("#agenda-body");
  try {
    const query = range ? `?from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}` : "";
    const [data, blocks] = await Promise.all([
      api(`/api/crm/appointments${query}`),
      range ? api("/api/crm/blocked-slots").catch(() => ({ blocks: [] })) : { blocks: [] }
    ]);
    const appointments = data.appointments
      .filter((a) => a.status !== "cancelled")
      .sort((x, y) => new Date(x.start_at) - new Date(y.start_at));

    if (agendaMode === "week") renderAgendaWeek(body, appointments, blocks.blocks || [], range);
    else if (agendaMode === "month") renderAgendaMonth(body, appointments, range);
    else renderAgendaList(body, appointments);
  } catch (error) {
    if (error.status === 401) return showAuth();
    body.innerHTML = `<div class="card"><div class="empty"><strong>No se pudo cargar la agenda</strong>${esc(error.message)}</div></div>`;
  }
}

function apptTone(status) {
  return { confirmed: "is-confirmed", completed: "is-done", no_show: "is-missed" }[status] || "is-scheduled";
}

function renderAgendaList(body, appointments) {
  const canEdit = currentManager?.role !== "viewer";
  const groups = {};
  appointments.forEach((a) => (groups[dayKey(a.start_at)] ||= []).push(a));

  if (!appointments.length) {
    body.innerHTML = `<div class="card"><div class="empty"><strong>No hay ${esc(V.appt.plural)} ${esc(agreePl("próxim"))}</strong>${isSchool() ? "Las visitas que agenden las familias desde el chat aparecen acá." : `Las reservas que se hagan desde el chat aparecen acá.`}</div></div>`;
    return;
  }

  body.innerHTML = Object.entries(groups).map(([date, items]) => `
    <section class="agenda-day">
      <h2>${esc(cap(fmtLongDay(`${date}T12:00:00`)))}</h2>
      <div class="card list">
        ${items.map((a) => {
          const [label, tone] = APPT_STATUS[a.status] || [a.status, ""];
          const open = ["scheduled", "confirmed"].includes(a.status);
          return `
          <div class="list-row appt-row is-link" data-lead="${esc(a.lead_id || "")}">
            <span class="time-col">${fmtTime(a.start_at)}</span>
            <span class="list-row-main"><strong>${esc(a.student_name || (isSchool() ? "Estudiante" : a.adult_name || V.Client))}</strong><span>${esc(a.adult_name || "")}${a.phone ? ` · ${esc(a.phone)}` : ""}</span></span>
            <span class="pill ${tone}">${esc(label)}</span>
            ${canEdit && open ? `<span class="appt-actions" data-stop>${apptActionButtons(a)}</span>` : ""}
          </div>`;
        }).join("")}
      </div>
    </section>`).join("");

  wireLeadOpeners(body);
  wireApptActions(body);
}

function apptActionButtons(a) {
  return `
    ${a.status === "scheduled" ? `<button class="btn btn-secondary btn-sm" data-appointment="${esc(a.id)}" data-status="confirmed">Confirmar</button>` : ""}
    <button class="btn btn-success btn-sm" data-appointment="${esc(a.id)}" data-status="completed">Realizada</button>
    <button class="btn btn-ghost btn-sm" data-appointment="${esc(a.id)}" data-status="no_show">No asistió</button>
    <button class="btn btn-ghost btn-sm" data-appointment="${esc(a.id)}" data-status="cancelled">Cancelar</button>`;
}

function wireApptActions(root, after) {
  $$("[data-appointment]", root).forEach((btn) => btn.addEventListener("click", async () => {
    const status = btn.dataset.status;
    const [label] = APPT_STATUS[status];
    if (status === "cancelled" || status === "no_show") {
      const ok = await confirmDialog(
        status === "cancelled" ? `Se cancela ${V.appt.the} y se libera el horario.` : `${cap(V.appt.the)} queda ${agree("marcad")} como no asistid${V.appt.pron === "la" ? "a" : "o"}.`,
        { title: status === "cancelled" ? `Cancelar ${V.appt.noun}` : "Marcar como no asistió", confirmLabel: status === "cancelled" ? `Cancelar ${V.appt.noun}` : "Marcar", danger: status === "cancelled" }
      );
      if (!ok) return;
    }
    try {
      await post("/api/crm/appointments", { id: btn.dataset.appointment, status });
      after?.();
      toast(`${V.appt.Noun} ${agree("marcad")} como ${label.toLowerCase()}.`);
      loadAgenda();
      refreshBadges();
    } catch (error) { toast(error.message, { error: true }); }
  }));
}

function openAppointmentDialog(a) {
  const canEdit = currentManager?.role !== "viewer";
  const [label, tone] = APPT_STATUS[a.status] || [a.status, ""];
  const open = ["scheduled", "confirmed"].includes(a.status);
  const end = a.end_at ? ` – ${fmtTime(a.end_at)}` : "";
  const body = openDialog(`
    <div class="card-head">
      <div><h2>${esc(a.student_name || (isSchool() ? "Visita" : a.adult_name || V.appt.Noun))}</h2><p>${esc(cap(fmtLongDay(a.start_at)))} · ${fmtTime(a.start_at)}${end}</p></div>
      <span class="pill ${tone}">${esc(label)}</span>
    </div>
    <div class="card-body">
      <dl class="facts">
        <dt>${esc(V.Client)}</dt><dd>${esc(a.adult_name || "—")}</dd>
        <dt>Teléfono</dt><dd>${esc(a.phone || "—")}</dd>
        <dt>Correo</dt><dd>${esc(a.email || "—")}</dd>
        ${a.notes ? `<dt>Detalle</dt><dd style="white-space:pre-line">${esc(a.notes)}</dd>` : ""}
      </dl>
      ${canEdit && open ? `<div class="appt-dialog-actions">${apptActionButtons(a)}</div>` : ""}
      <div class="form-actions">
        <button class="btn btn-ghost" data-close>Cerrar</button>
        ${a.lead_id ? `<button class="btn btn-primary" data-open-lead>Ver ficha</button>` : ""}
      </div>
    </div>`);
  $("[data-close]", body).addEventListener("click", closeDialog);
  $("[data-open-lead]", body)?.addEventListener("click", () => { closeDialog(); openLead(a.lead_id); });
  wireApptActions(body, closeDialog);
}

function renderAgendaWeek(body, appointments, blocks, range) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(range.from, i));
  const todayKey = dayKey(new Date());
  const hoursOf = (d) => new Date(d).getHours() + new Date(d).getMinutes() / 60;
  let first = 8, last = 18;
  appointments.forEach((a) => {
    first = Math.min(first, Math.floor(hoursOf(a.start_at)));
    last = Math.max(last, Math.ceil(hoursOf(a.end_at || a.start_at) + (a.end_at ? 0 : 0.5)));
  });
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const height = hours.length * HOUR_PX;
  const top = (d) => (hoursOf(d) - first) * HOUR_PX;
  const durationPx = (a) => {
    const minutes = a.end_at ? (new Date(a.end_at) - new Date(a.start_at)) / 60000 : 30;
    return Math.max(22, (minutes / 60) * HOUR_PX - 2);
  };
  const byDay = {};
  appointments.forEach((a) => (byDay[dayKey(a.start_at)] ||= []).push(a));

  body.innerHTML = `
    <div class="card cal-week">
      <div class="cal-scroll">
        <div class="cal-grid" style="--hours:${hours.length};--hour:${HOUR_PX}px">
          <div class="cal-corner"></div>
          ${days.map((d) => `
            <div class="cal-dayhead ${dayKey(d) === todayKey ? "is-today" : ""}">
              <span>${esc(fmtDate(d, { weekday: "short" }).replace(".", ""))}</span>
              <strong>${d.getDate()}</strong>
            </div>`).join("")}

          <div class="cal-gutter" style="height:${height}px">
            ${hours.map((h) => `<span style="top:${(h - first) * HOUR_PX}px">${String(h).padStart(2, "0")}:00</span>`).join("")}
          </div>
          ${days.map((d) => {
            const key = dayKey(d);
            const dayStart = startOfDay(d), dayEnd = addDays(dayStart, 1);
            const dayBlocks = blocks.filter((b) => new Date(b.start_at) < dayEnd && new Date(b.end_at) > dayStart);
            const isToday = key === todayKey;
            const now = new Date();
            return `
            <div class="cal-col ${isToday ? "is-today" : ""}" style="height:${height}px">
              ${dayBlocks.map((b) => {
                const s = Math.max(new Date(b.start_at), dayStart), e = Math.min(new Date(b.end_at), dayEnd);
                const t = Math.max(0, top(s)), h = Math.min(height, top(e)) - t;
                return h > 0 ? `<div class="cal-block" style="top:${t}px;height:${h}px" title="${esc(b.reason || "Bloqueado")}"><span>${esc(b.reason || "Bloqueado")}</span></div>` : "";
              }).join("")}
              ${(byDay[key] || []).map((a) => `
                <button class="cal-event ${apptTone(a.status)} ${durationPx(a) < 44 ? "is-short" : ""}" data-appt="${esc(a.id)}" style="top:${top(a.start_at)}px;height:${durationPx(a)}px" title="${esc(`${fmtTime(a.start_at)} · ${a.student_name || ""} · ${a.adult_name || ""}`)}">
                  ${durationPx(a) < 44
                    ? `<span class="cal-event-line"><b>${fmtTime(a.start_at)}</b> ${esc(a.student_name || a.adult_name || V.appt.Noun)}</span>`
                    : `<strong>${esc(a.student_name || a.adult_name || V.appt.Noun)}</strong><span>${fmtTime(a.start_at)}${a.adult_name && a.student_name ? ` · ${esc(a.adult_name)}` : ""}</span>`}
                </button>`).join("")}
              ${isToday && hoursOf(now) >= first && hoursOf(now) <= last ? `<div class="cal-now" style="top:${top(now)}px"></div>` : ""}
            </div>`;
          }).join("")}
        </div>
      </div>
    </div>
    ${appointments.length ? "" : `<p class="muted small" style="padding:0 4px">No hay ${esc(V.appt.plural)} esta semana.</p>`}`;

  const index = Object.fromEntries(appointments.map((a) => [a.id, a]));
  $$("[data-appt]", body).forEach((el) => el.addEventListener("click", () => openAppointmentDialog(index[el.dataset.appt])));

  // Start scrolled near the first event or the current time.
  const scroller = $(".cal-scroll", body);
  const firstEvent = appointments[0] ? top(appointments[0].start_at) : 0;
  scroller.scrollTop = Math.max(0, firstEvent - HOUR_PX);
  const todayIndex = days.findIndex((d) => dayKey(d) === todayKey);
  if (todayIndex > 0 && scroller.scrollWidth > scroller.clientWidth) {
    scroller.scrollLeft = $$(".cal-dayhead", body)[todayIndex].offsetLeft - 56;
  }
}

function renderAgendaMonth(body, appointments, range) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(range.from, i));
  const todayKey = dayKey(new Date());
  const month = range.first.getMonth();
  const byDay = {};
  appointments.forEach((a) => (byDay[dayKey(a.start_at)] ||= []).push(a));
  const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  body.innerHTML = `
    <div class="card cal-month">
      <div class="cal-month-head">${weekdays.map((w) => `<span>${w}</span>`).join("")}</div>
      <div class="cal-month-grid">
        ${days.map((d) => {
          const key = dayKey(d);
          const items = byDay[key] || [];
          return `
          <div class="cal-cell ${d.getMonth() !== month ? "is-outside" : ""} ${key === todayKey ? "is-today" : ""}" data-day="${key}">
            <span class="cal-cell-num">${d.getDate()}</span>
            <div class="cal-cell-events">
              ${items.slice(0, 3).map((a) => `
                <button class="cal-chip ${apptTone(a.status)}" data-appt="${esc(a.id)}"><b>${fmtTime(a.start_at)}</b> ${esc(a.student_name || a.adult_name || V.appt.Noun)}</button>`).join("")}
              ${items.length > 3 ? `<button class="cal-more" data-day-more="${key}">+${items.length - 3} más</button>` : ""}
            </div>
            ${items.length ? `<span class="cal-dot-count">${items.length}</span>` : ""}
          </div>`;
        }).join("")}
      </div>
    </div>`;

  const index = Object.fromEntries(appointments.map((a) => [a.id, a]));
  $$("[data-appt]", body).forEach((el) => el.addEventListener("click", (event) => {
    event.stopPropagation();
    openAppointmentDialog(index[el.dataset.appt]);
  }));
  $$("[data-day]", body).forEach((cell) => cell.addEventListener("click", () => {
    agendaDate = new Date(`${cell.dataset.day}T12:00:00`);
    agendaMode = "week";
    loadAgenda();
  }));
}

/* ---------- Follow-ups ---------- */

async function loadFollowups() {
  setLoading("Cargando seguimientos…");
  try {
    const data = await api("/api/crm/followups?status=pending");
    const now = new Date();
    view.innerHTML = `
      <section class="card">
        <div class="list">
          ${data.followups.length ? data.followups.map((f) => {
            const overdue = new Date(f.due_at) < now;
            return `
            <div class="list-row is-link" data-lead="${esc(f.lead_id || "")}">
              <span class="list-row-main"><strong>${esc(f.title)}</strong><span>${esc(f.student_name || f.adult_name || "")}${f.phone ? ` · ${esc(f.phone)}` : ""}</span></span>
              <span class="list-row-aside">
                <span class="pill ${overdue ? "pill-danger" : ""}">${overdue ? "Vencido " : "Vence "}${esc(relativeDue(f.due_at))}</span>
                <button class="btn btn-success btn-sm" data-stop data-followup="${esc(f.id)}">${icon("check")}Hecho</button>
              </span>
            </div>`;
          }).join("") : '<div class="empty"><strong>Estás al día</strong>No hay seguimientos pendientes.</div>'}
        </div>
      </section>`;

    wireLeadOpeners();
    $$("[data-followup]", view).forEach((btn) => btn.addEventListener("click", async () => {
      try {
        await post("/api/crm/followups", { action: "complete", id: btn.dataset.followup });
        toast("Seguimiento completado.");
        loadFollowups();
        refreshBadges();
      } catch (error) { toast(error.message, { error: true }); }
    }));
  } catch (error) {
    handleViewError(error);
  }
}

/* ---------- Conversations ---------- */

async function loadInquiries() {
  setLoading("Cargando conversaciones…");
  try {
    const data = await api("/api/crm/inquiries");
    view.innerHTML = `
      <section class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Última actividad</th><th>Contacto</th><th>Último mensaje</th><th class="num">Mensajes</th></tr></thead>
            <tbody>
              ${data.inquiries.map((i) => `
                <tr ${i.lead_id ? `class="is-link" data-lead="${esc(i.lead_id)}"` : ""}>
                  <td>${esc(fmtDate(i.last_message_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }))}</td>
                  <td>${esc(i.adult_name || "Anónimo")}</td>
                  <td class="clip">${esc(i.last_user_message || "—")}</td>
                  <td class="num">${esc(i.message_count)}</td>
                </tr>`).join("") || '<tr><td colspan="4"><div class="empty">Todavía no hay conversaciones.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </section>`;
    wireLeadOpeners();
  } catch (error) {
    handleViewError(error);
  }
}

/* ---------- Knowledge ---------- */

async function loadKnowledge(editId = null) {
  setLoading("Cargando información…");
  try {
    const data = await api("/api/crm/knowledge");
    const categories = data.categories || [];
    const items = data.items || [];
    const canEdit = currentManager?.role === "admin";
    const statusLabel = { active: ["Activo", "pill-success"], draft: ["Borrador", "pill-warning"], archived: ["Archivado", ""] };

    view.innerHTML = `
      <div class="kb-layout">
        <section class="card">
          <div class="card-head">
            <div><h2>Información para el asistente</h2><p>El chat responde usando solo el contenido activo de esta lista.</p></div>
            ${canEdit ? `<button id="new-knowledge-item" class="btn btn-primary">${icon("plus")}Agregar</button>` : ""}
          </div>
          <div class="toolbar">
            <input id="knowledge-search" type="search" placeholder="Buscar">
            <select id="knowledge-category-filter"><option value="">Todas las categorías</option>${categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.item_count)})</option>`).join("")}</select>
            <select id="knowledge-status-filter"><option value="">Todos los estados</option><option value="active">Activo</option><option value="draft">Borrador</option><option value="archived">Archivado</option></select>
          </div>
          <div id="knowledge-list">
            ${items.map((item) => {
              const [label, tone] = statusLabel[item.status] || [item.status, ""];
              return `
              <article class="kb-item" data-kb-item="${esc(item.id)}" data-category="${esc(item.category_id || "")}" data-status="${esc(item.status)}"
                data-search="${esc([item.title, item.summary, item.content, item.category_name, (item.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase())}">
                <div class="kb-item-head">
                  <div><small>${esc(item.category_name || "Sin categoría")}</small><h3>${esc(item.title)}</h3></div>
                  <span class="pill ${tone}">${label}</span>
                </div>
                <p>${esc(item.summary || String(item.content || "").slice(0, 240))}</p>
                ${item.tags?.length ? `<div class="tags">${item.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
                <div class="kb-item-foot">
                  <span>Actualizado ${esc(fmtDate(item.updated_at, { dateStyle: "medium" }))}</span>
                  ${canEdit ? `<span class="form-actions">
                    <button class="btn btn-ghost btn-sm" data-kb-edit="${esc(item.id)}">Editar</button>
                    <button class="btn btn-ghost btn-sm" data-kb-toggle="${esc(item.id)}" data-kb-status="${esc(item.status)}">${item.status === "archived" ? "Restaurar" : "Archivar"}</button>
                  </span>` : ""}
                </div>
              </article>`;
            }).join("") || `<div class="empty"><strong>Todavía no hay información</strong>${esc(V.knowledgeHint)}</div>`}
          </div>
        </section>

        <aside style="display:grid;gap:20px">
          <section class="card">
            <div class="card-head"><h2>Cómo funciona</h2></div>
            <div class="card-body">
              <ol class="steps">
                <li>Cargás información clara y actualizada.</li>
                <li>Ante cada consulta, el asistente busca los fragmentos relacionados.</li>
                <li>La IA responde solo con esos datos, en tono natural.</li>
                <li>Si archivás o editás algo, cambia en las próximas respuestas.</li>
              </ol>
            </div>
          </section>
          ${canEdit ? `
          <section class="card">
            <div class="card-head"><h2>Categorías</h2></div>
            <div class="card-body">
              <div class="tags">${categories.map((c) => `<span class="tag">${esc(c.name)} · ${esc(c.item_count)}</span>`).join("") || '<span class="muted small">Sin categorías</span>'}</div>
              <form id="category-form" style="display:grid;gap:10px">
                <label class="field"><span>Nueva categoría</span><input name="name" required maxlength="160" placeholder="Ej. Becas y beneficios"></label>
                <label class="field"><span>Descripción</span><input name="description" maxlength="400"></label>
                <button class="btn btn-secondary" type="submit">Agregar categoría</button>
              </form>
            </div>
          </section>` : ""}
        </aside>
      </div>`;

    const filter = () => {
      const q = ($("#knowledge-search").value || "").trim().toLowerCase();
      const cat = $("#knowledge-category-filter").value;
      const st = $("#knowledge-status-filter").value;
      $$("[data-kb-item]", view).forEach((card) => {
        card.hidden = !((!q || card.dataset.search.includes(q)) && (!cat || card.dataset.category === cat) && (!st || card.dataset.status === st));
      });
    };
    $("#knowledge-search").addEventListener("input", filter);
    $("#knowledge-category-filter").addEventListener("change", filter);
    $("#knowledge-status-filter").addEventListener("change", filter);

    if (!canEdit) return;

    $("#new-knowledge-item").addEventListener("click", () => openKnowledgeEditor(null, categories));
    $$("[data-kb-edit]", view).forEach((btn) => btn.addEventListener("click", () => {
      openKnowledgeEditor(items.find((i) => i.id === btn.dataset.kbEdit), categories);
    }));
    $$("[data-kb-toggle]", view).forEach((btn) => btn.addEventListener("click", async () => {
      const archived = btn.dataset.kbStatus === "archived";
      try {
        await post("/api/crm/knowledge", { action: archived ? "restore-item" : "archive-item", id: btn.dataset.kbToggle });
        toast(archived ? "Información restaurada." : "Información archivada.");
        loadKnowledge();
      } catch (error) { toast(error.message, { error: true }); }
    }));
    $("#category-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await post("/api/crm/knowledge", { action: "save-category", ...Object.fromEntries(new FormData(event.currentTarget)) });
        toast("Categoría agregada.");
        loadKnowledge();
      } catch (error) { toast(error.message, { error: true }); }
    });

    if (editId) openKnowledgeEditor(items.find((i) => i.id === editId), categories);
  } catch (error) {
    handleViewError(error);
  }
}

function openKnowledgeEditor(item, categories) {
  const body = openDialog(`
    <div class="card-head"><h2>${item ? "Editar información" : "Nueva información"}</h2><button class="icon-btn" data-close aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <form id="knowledge-item-form" class="card-body">
      <input type="hidden" name="id" value="${esc(item?.id || "")}">
      <div class="form-grid">
        <label class="field"><span>Título</span><input name="title" required maxlength="260" value="${esc(item?.title || "")}" placeholder="Ej. Becas para hermanos"></label>
        <label class="field"><span>Categoría</span><select name="categoryId"><option value="">Sin categoría</option>${categories.map((c) => `<option value="${esc(c.id)}" ${item?.category_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
        <label class="field span-2"><span>Resumen interno</span><input name="summary" maxlength="1200" value="${esc(item?.summary || "")}" placeholder="Una línea para reconocerlo en la lista"></label>
        <label class="field span-2"><span>Información completa</span><textarea name="content" rows="9" required maxlength="20000" placeholder="Escribila como fuente oficial. El asistente la redacta para cada familia.">${esc(item?.content || "")}</textarea></label>
        <label class="field span-2"><span>Etiquetas</span><input name="tags" value="${esc((item?.tags || []).join(", "))}" placeholder="inicial, horarios, inglés"><small>Separadas por coma. Ayudan a encontrar el contenido.</small></label>
        <label class="field"><span>Estado</span><select name="status">
          <option value="active" ${!item || item.status === "active" ? "selected" : ""}>Activo</option>
          <option value="draft" ${item?.status === "draft" ? "selected" : ""}>Borrador</option>
          <option value="archived" ${item?.status === "archived" ? "selected" : ""}>Archivado</option>
        </select></label>
        <label class="field"><span>Prioridad</span><input name="priority" type="number" min="0" max="1000" value="${esc(item?.priority ?? 0)}"><small>Mayor número, más peso en las respuestas.</small></label>
        <label class="field"><span>Válido desde</span><input name="validFrom" type="date" value="${item?.valid_from ? esc(String(item.valid_from).slice(0, 10)) : ""}"></label>
        <label class="field"><span>Válido hasta</span><input name="validUntil" type="date" value="${item?.valid_until ? esc(String(item.valid_until).slice(0, 10)) : ""}"></label>
      </div>
      <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
    </form>`, { wide: true });

  $$("[data-close]", body).forEach((b) => b.addEventListener("click", closeDialog));
  $("#knowledge-item-form", body).addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await withBusy($("button[type=submit]", body), "Guardando…", () =>
        post("/api/crm/knowledge", { action: "save-item", ...payload, priority: Number(payload.priority || 0) }));
      closeDialog();
      toast("Información guardada.");
      loadKnowledge();
    } catch (error) { toast(error.message, { error: true }); }
  });
}

/* ---------- Lead drawer ---------- */

$("#close-lead").addEventListener("click", () => { leadModal.hidden = true; });
leadModal.addEventListener("click", (event) => { if (event.target === leadModal) leadModal.hidden = true; });
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!dialog.hidden) closeDialog();
  else if (!leadModal.hidden) leadModal.hidden = true;
  else setSidebar(false);
});

async function openLead(id) {
  leadModal.hidden = false;
  leadDetail.innerHTML = '<div class="loading">Cargando ficha…</div>';
  try {
    const data = await api(`/api/crm/lead?id=${encodeURIComponent(id)}`);
    const l = data.lead;
    const student = data.students[0] || {};
    const messages = data.conversations.flatMap((c) => c.messages || []);
    const canEdit = currentManager?.role !== "viewer";
    const name = student.full_name || l.adult_name || "Sin nombre";
    const wa = String(l.phone || "").replace(/[^\d]/g, "");
    $("#drawer-title").textContent = STAGE_LABEL[l.status] || V.Lead;

    leadDetail.innerHTML = `
      <section class="card card-body">
        <div class="lead-hero">
          <span class="avatar-initials">${esc(initials(name))}</span>
          <div><h3>${esc(name)}</h3><p>${esc([student.full_name ? l.adult_name : "", l.level_interest, l.capture_source && l.capture_source !== "booking" ? CAPTURE_LABEL[l.capture_source] : ""].filter(Boolean).join(" · "))}</p></div>
        </div>
        <div class="contact-actions">
          ${l.phone ? `<a class="btn btn-secondary btn-sm" href="tel:${esc(l.phone)}">${icon("phone")}Llamar</a>` : ""}
          ${wa ? `<a class="btn btn-secondary btn-sm" href="https://wa.me/${esc(wa)}" target="_blank" rel="noreferrer">${icon("whatsapp")}WhatsApp</a>` : ""}
          ${l.email ? `<a class="btn btn-secondary btn-sm" href="mailto:${esc(l.email)}">${icon("mail")}Correo</a>` : ""}
        </div>
      </section>

      ${canEdit ? `
      <section class="card">
        <div class="card-head"><h2>Gestión</h2></div>
        <div class="card-body">
          <div class="form-grid">
            <label class="field"><span>Etapa</span><select id="lead-status">${STAGES.map(([k, label]) => `<option value="${k}" ${k === l.status ? "selected" : ""}>${label}</option>`).join("")}</select></label>
            <label class="field"><span>Próxima acción</span><input id="lead-next-action" type="datetime-local" value="${esc(toLocalInput(l.next_action_at))}"></label>
            <label class="field span-2"><span>Notas internas</span><textarea id="lead-notes" rows="3">${esc(l.notes || "")}</textarea></label>
          </div>
          <div class="form-actions"><button id="save-lead" class="btn btn-primary">Guardar cambios</button></div>
        </div>
      </section>` : ""}

      <section class="card">
        <div class="card-head"><h2>Datos</h2></div>
        <div class="card-body">
          <dl class="facts">
            <dt>Correo</dt><dd>${esc(l.email || "—")}</dd>
            <dt>Teléfono</dt><dd>${esc(l.phone || "—")}</dd>
            ${isSchool() ? `
            <dt>Fecha de nacimiento</dt><dd>${esc(student.birth_date ? fmtDate(`${String(student.birth_date).slice(0, 10)}T12:00:00`, { dateStyle: "long" }) : "—")}</dd>
            <dt>Institución anterior</dt><dd>${esc(student.previous_institution || "—")}</dd>
            <dt>Comentarios</dt><dd>${esc(student.comments || "—")}</dd>` : (data.appointments.find((a) => a.notes) ? `
            <dt>Detalle de la reserva</dt><dd style="white-space:pre-line">${esc(data.appointments.find((a) => a.notes).notes)}</dd>` : "")}
            <dt>Cómo llegó</dt><dd>${esc(l.capture_source && l.capture_source !== "booking" ? `${CAPTURE_LABEL[l.capture_source] || "Contacto"}${l.capture_detail ? ` · ${l.capture_detail}` : ""}` : isSchool() ? "Agendó una visita" : `Reservó ${V.appt.a}`)}</dd>
            <dt>Origen</dt><dd>${esc([l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ") || (CAPTURE_LABEL[l.source] ? "chat" : l.source) || "—")}</dd>
          </dl>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Lectura de la IA</h2><p>Ayuda interna. No se muestra ${isSchool() ? "a la familia" : `al ${V.client}`}.</p></div>${canEdit ? `<button id="analyze-lead" class="btn btn-secondary btn-sm">${icon("sparkle")}${l.ai_analyzed_at ? "Actualizar" : "Analizar"}</button>` : ""}</div>
        <div class="card-body">
          ${l.ai_summary ? `
          <dl class="facts">
            <dt>Interés</dt><dd>${esc(INTEREST_LABEL[l.ai_interest_level] || l.ai_interest_level || "—")}</dd>
            <dt>Resumen</dt><dd>${esc(l.ai_summary)}</dd>
            <dt>Principal inquietud</dt><dd>${esc(l.ai_primary_concern || "—")}</dd>
            <dt>Siguiente paso sugerido</dt><dd>${esc(l.ai_next_action || "—")}</dd>
          </dl>` : '<p class="muted">Todavía no hay análisis. Usá “Analizar” para obtener un resumen de la conversación.</p>'}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>${esc(V.appt.Plural)} y seguimientos</h2></div>
        <div class="card-body">
          <div class="timeline">
            ${data.appointments.map((a) => `<div class="timeline-item"><time>${esc(fmtDate(a.start_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }))}</time><span>${esc(V.appt.Noun)} · ${esc((APPT_STATUS[a.status] || [a.status])[0])}</span></div>`).join("")}
            ${data.followups.map((f) => `<div class="timeline-item"><time>${esc(fmtDate(f.due_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }))}</time><span>${esc(f.title)} · ${f.status === "pending" ? "pendiente" : "hecho"}</span></div>`).join("")}
            ${!data.appointments.length && !data.followups.length ? `<p class="muted">Sin ${esc(V.appt.plural)} ni seguimientos.</p>` : ""}
          </div>
          ${canEdit ? `
          <div class="form-grid">
            <label class="field"><span>Nuevo seguimiento</span><input id="followup-title" placeholder="Ej. Llamar para conocer la decisión"></label>
            <label class="field"><span>Fecha</span><input id="followup-date" type="datetime-local"></label>
          </div>
          <div class="form-actions"><button id="create-followup" class="btn btn-secondary">Agregar seguimiento</button></div>` : ""}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Conversación</h2></div>
        <div class="card-body">
          ${messages.length ? `<div class="chat-log">${messages.map((m) => `<div class="chat-bubble ${m.role === "user" ? "is-user" : "is-bot"}">${esc(m.content)}</div>`).join("")}</div>` : '<p class="muted">No hay mensajes vinculados.</p>'}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Actividad</h2></div>
        <div class="card-body">
          <div class="timeline">
            ${data.activities.map((a) => `<div class="timeline-item"><time>${esc(fmtDate(a.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }))}</time><span>${esc(a.description)}</span></div>`).join("") || '<p class="muted">Sin actividad registrada.</p>'}
          </div>
        </div>
      </section>`;

    const log = $(".chat-log", leadDetail);
    if (log) log.scrollTop = log.scrollHeight;

    $("#analyze-lead")?.addEventListener("click", async (event) => {
      try {
        await withBusy(event.currentTarget, "Analizando…", () => post("/api/crm/analyze-lead", { id: l.id }));
        openLead(l.id);
      } catch (error) { toast(error.message, { error: true }); }
    });

    $("#save-lead")?.addEventListener("click", async (event) => {
      const next = $("#lead-next-action").value;
      try {
        await withBusy(event.currentTarget, "Guardando…", () => post("/api/crm/lead-update", {
          id: l.id,
          status: $("#lead-status").value,
          notes: $("#lead-notes").value,
          nextActionAt: next ? new Date(next).toISOString() : null
        }));
        toast("Cambios guardados.");
        leadModal.hidden = true;
        loadView();
      } catch (error) { toast(error.message, { error: true }); }
    });

    $("#create-followup")?.addEventListener("click", async () => {
      const title = $("#followup-title").value.trim();
      const due = $("#followup-date").value;
      if (!title || !due) return toast("Completá el seguimiento y la fecha.", { error: true });
      try {
        await post("/api/crm/followups", { action: "create", leadId: l.id, title, dueAt: new Date(due).toISOString() });
        toast("Seguimiento agregado.");
        openLead(l.id);
        refreshBadges();
      } catch (error) { toast(error.message, { error: true }); }
    });
  } catch (error) {
    leadDetail.innerHTML = `<div class="card"><div class="empty">${esc(error.message)}</div></div>`;
  }
}

/* ---------- Settings ---------- */

const SETTINGS_TABS = [
  ["start", "Primeros pasos"],
  ["business", "Negocio"],
  ["booking", "Agenda"],
  ["capture", "Captación"],
  ["integrations", "Integraciones"],
  ["team", "Equipo"],
  ["account", "Mi cuenta"]
];

async function loadSettings() {
  const isAdmin = currentManager?.role === "admin";
  const tabs = SETTINGS_TABS.filter(([id]) => isAdmin || ["account", "business", "booking"].includes(id));
  if (!tabs.some(([id]) => id === settingsTab)) settingsTab = tabs[0][0];

  view.innerHTML = `
    <div class="settings">
      <nav class="settings-nav" aria-label="Secciones de configuración">
        ${tabs.map(([id, label]) => `<button data-tab="${id}" class="${id === settingsTab ? "is-active" : ""}">${label}${id === "start" ? '<span class="nav-dot" id="start-dot" hidden></span>' : ""}</button>`).join("")}
      </nav>
      <div id="settings-panel" class="settings-panel"><div class="loading">Cargando…</div></div>
    </div>`;

  $$(".settings-nav button", view).forEach((btn) => btn.addEventListener("click", () => {
    settingsTab = btn.dataset.tab;
    $$(".settings-nav button", view).forEach((b) => b.classList.toggle("is-active", b === btn));
    renderSettingsTab();
  }));

  renderSettingsTab();
}

async function renderSettingsTab() {
  const panel = $("#settings-panel");
  if (!panel) return;
  panel.innerHTML = '<div class="loading">Cargando…</div>';
  try {
    const renderers = {
      start: renderStartTab,
      business: renderBusinessTab,
      booking: renderBookingTab,
      capture: renderCaptureTab,
      integrations: renderIntegrationsTab,
      team: renderTeamTab,
      account: renderAccountTab
    };
    await renderers[settingsTab](panel);
  } catch (error) {
    if (error.status === 401) return showAuth();
    panel.innerHTML = `<div class="card"><div class="empty"><strong>No se pudo cargar</strong>${esc(error.message)}</div></div>`;
  }
}

async function getSettings(force = false) {
  if (!settingsCache || force) settingsCache = (await api("/api/crm/settings")).settings;
  return settingsCache;
}

async function saveSettings(patch) {
  const current = await getSettings(true);
  const payload = {
    booking: { ...(current.booking || {}), ...(patch.booking || {}) },
    followup: { ...(current.followup || {}), ...(patch.followup || {}) },
    profile: { ...(current.profile || {}), ...(patch.profile || {}) }
  };
  payload.booking.slotMinutes ??= 30; payload.booking.openHour ??= 9; payload.booking.closeHour ??= 16;
  payload.booking.minDaysAhead ??= 1; payload.booking.maxDaysAhead ??= 30;
  payload.followup.daysAfterInterview ??= 2;
  await post("/api/crm/settings", payload);
  settingsCache = null;
}

/* Primeros pasos */
async function renderStartTab(panel) {
  const { checklist } = await api("/api/crm/integrations");
  const required = checklist.filter((c) => c.required);
  const done = required.filter((c) => c.done).length;
  const allDone = done === required.length;
  $("#start-dot") && ($("#start-dot").hidden = allDone);

  panel.innerHTML = `
    <section class="card">
      <div class="card-head">
        <div><h2>${allDone ? "Todo listo" : "Dejá el panel funcionando"}</h2>
        <p>${allDone ? `El asistente está respondiendo y agendando ${V.appt.plural}.` : `${done} de ${required.length} pasos obligatorios completos.`}</p></div>
      </div>
      <div class="checklist">
        ${checklist.map((c) => `
          <div class="check-item ${c.done ? "is-done" : ""}">
            <span class="check-icon">${icon("check")}</span>
            <span class="list-row-main"><strong>${esc(c.label)}</strong>${c.required ? "" : "<span>Opcional</span>"}</span>
            ${!c.done && c.target ? `<button class="btn ${c.required ? "btn-secondary" : "btn-ghost"} btn-sm" data-target="${c.target}">Configurar</button>` : ""}
          </div>`).join("")}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Enlaces para compartir</h2></div>
      <div class="card-body">
        <div class="field"><span class="field-label">Chat público para ${isSchool() ? "las familias" : `tus ${V.clients}`}</span>
          <div class="form-actions" style="justify-content:flex-start">
            <span class="copy-value">${esc(location.origin)}/</span>
            <button class="btn btn-ghost btn-sm" data-copy="${esc(location.origin)}/">${icon("copy")}Copiar</button>
          </div>
          <small>Ponelo en tu sitio web, Instagram o en la respuesta automática de WhatsApp.</small>
        </div>
      </div>
    </section>`;

  $$("[data-target]", panel).forEach((btn) => btn.addEventListener("click", () => {
    if (btn.dataset.target === "knowledge") return navigate("knowledge");
    settingsTab = btn.dataset.target;
    loadSettings();
  }));
  $$("[data-copy]", panel).forEach((btn) => btn.addEventListener("click", () => copyToClipboard(btn.dataset.copy)));
}

/* Negocio */
async function renderBusinessTab(panel) {
  const settings = await getSettings(true);
  const p = settings.profile || {};
  const editable = currentManager?.role === "admin";
  const dis = editable ? "" : "disabled";
  const days = p.weekdays || [1, 2, 3, 4, 5];

  panel.innerHTML = `
    <form id="business-form" style="display:grid;gap:20px">
      <section class="card">
        <div class="card-head"><div><h2>Identidad</h2><p>Se muestra en el encabezado del chat y en la ficha del negocio.</p></div></div>
        <div class="card-body form-grid">
          <label class="field span-2"><span>Tipo de negocio</span>
            <select name="businessType" ${dis}>${(BUSINESS_TYPES.length ? BUSINESS_TYPES : [{ key: "school", label: "Colegio o institución educativa" }]).map((t) => `<option value="${esc(t.key)}" ${t.key === (p.businessType || "school") ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</select>
            <small>Adapta el chat, el formulario de reserva, las etapas del panel y cómo se comporta el asistente.</small>
          </label>
          <label class="field"><span>Nombre</span><input name="name" value="${esc(p.name || "")}" required maxlength="160" ${dis}></label>
          <label class="field"><span>Categoría</span><input name="category" value="${esc(p.category || "")}" maxlength="120" placeholder="Educación" ${dis}></label>
          <label class="field span-2"><span>Descripción corta</span><input name="shortDescription" value="${esc(p.shortDescription || "")}" maxlength="260" placeholder="${isSchool() ? "Ej. Inicial y Primaria" : "Ej. Turnos online de lunes a sábado"}" ${dis}></label>
          <label class="field span-2"><span>Mensaje destacado</span><input name="statusText" value="${esc(p.statusText || "")}" maxlength="160" placeholder="${isSchool() ? "Ej. Inscripciones abiertas 2027" : "Ej. Agenda abierta para diciembre"}" ${dis}></label>
          <label class="check-row span-2"><input type="checkbox" name="badgeEnabled" ${p.badgeEnabled !== false ? "checked" : ""} ${dis}>Mostrar sello de perfil verificado</label>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Marca</h2><p>Logo y colores que ${isSchool() ? "ven las familias" : `ven tus ${V.clients}`} en el chat.</p></div></div>
        <div class="card-body">
          <div class="logo-field">
            <img id="logo-preview" class="logo-preview" alt="Logo actual" src="${esc(p.logoUrl || initialsLogo(p.name, p.brandColor || DEFAULT_BRAND))}">
            <div class="logo-field-copy">
              <strong>Logo</strong>
              <span class="muted small">Imagen cuadrada en PNG, JPG o SVG. Se ajusta automáticamente. Sin logo, se muestran las iniciales.</span>
              ${editable ? `<div class="form-actions" style="justify-content:flex-start">
                <label class="btn btn-secondary btn-sm">Subir logo<input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label>
                <button type="button" id="logo-remove" class="btn btn-ghost btn-sm" ${p.logoUrl ? "" : "hidden"}>Quitar</button>
              </div>` : ""}
            </div>
            <input type="hidden" name="logoUrl" value="${esc(p.logoUrl || "")}">
          </div>
          <div class="form-grid">
            <label class="field"><span>Color principal</span>
              <span class="color-input"><input type="color" data-color-for="brandColor" value="${esc(p.brandColor || DEFAULT_BRAND)}" ${dis}><input name="brandColor" class="mono" value="${esc(p.brandColor || "")}" placeholder="${DEFAULT_BRAND}" maxlength="7" ${dis}></span>
              <small>Botones, selección y los mensajes de la familia.</small></label>
            <label class="field"><span>Color secundario</span>
              <span class="color-input"><input type="color" data-color-for="secondaryColor" value="${esc(p.secondaryColor || p.brandColor || DEFAULT_BRAND)}" ${dis}><input name="secondaryColor" class="mono" value="${esc(p.secondaryColor || "")}" placeholder="Igual al principal" maxlength="7" ${dis}></span>
              <small>Botón de enviar y opción destacada para agendar.</small></label>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Asistente</h2><p>Cómo se presenta y reglas propias de tu institución.</p></div></div>
        <div class="card-body form-grid">
          <label class="field span-2"><span>Mensaje de bienvenida</span><textarea name="welcomeMessage" rows="4" maxlength="700" placeholder="¡Hola! 👋 Soy el asistente de admisiones de ${esc(p.name || "tu institución")}. Puedo ayudarte con la propuesta educativa, horarios, proceso de inscripción y costos." ${dis}>${esc(p.welcomeMessage || "")}</textarea><small>Si lo dejás vacío se usa el mensaje de la sugerencia.</small></label>
          <label class="field span-2"><span>Indicaciones para el asistente</span><textarea name="assistantNotes" rows="4" maxlength="2000" placeholder="Ej. Solo ofrecemos Inicial y Primaria. No informar costos definitivos por chat." ${dis}>${esc(p.assistantNotes || "")}</textarea><small>Reglas que la IA respeta en todas las respuestas. Los datos (precios, horarios) van en la Base de conocimiento.</small></label>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Contacto y ubicación</h2></div>
        <div class="card-body form-grid">
          <label class="field"><span>Dirección</span><input name="addressLine1" value="${esc(p.addressLine1 || "")}" maxlength="240" ${dis}></label>
          <label class="field"><span>Ciudad y país</span><input name="addressLine2" value="${esc(p.addressLine2 || "")}" maxlength="240" ${dis}></label>
          <label class="field span-2"><span>Búsqueda en mapas</span><input name="mapQuery" value="${esc(p.mapQuery || "")}" maxlength="400" placeholder="Dirección completa como la buscarías en Google Maps" ${dis}></label>
          <label class="field"><span>Teléfono visible</span><input name="phoneDisplay" value="${esc(p.phoneDisplay || "")}" maxlength="80" ${dis}></label>
          <label class="field"><span>Teléfono para llamar</span><input name="phoneE164" value="${esc(p.phoneE164 || "")}" maxlength="40" placeholder="+598…" ${dis}><small>Con código de país, sin espacios.</small></label>
          <label class="field span-2"><span>Correo público</span><input name="email" type="email" value="${esc(p.email || "")}" maxlength="240" ${dis}></label>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Web y redes</h2></div>
        <div class="card-body form-grid">
          <label class="field span-2"><span>Sitio web</span><input name="website" type="url" value="${esc(p.website || "")}" placeholder="https://" ${dis}></label>
          <label class="field"><span>Instagram (enlace)</span><input name="instagram" type="url" value="${esc(p.instagram || "")}" placeholder="https://instagram.com/…" ${dis}></label>
          <label class="field"><span>Instagram (texto visible)</span><input name="instagramLabel" value="${esc(p.instagramLabel || "")}" placeholder="@usuario" ${dis}></label>
          <label class="field"><span>Facebook (enlace)</span><input name="facebook" type="url" value="${esc(p.facebook || "")}" placeholder="https://facebook.com/…" ${dis}></label>
          <label class="field"><span>Facebook (texto visible)</span><input name="facebookLabel" value="${esc(p.facebookLabel || "")}" ${dis}></label>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Horario de atención</h2><p>Define cuándo la ficha muestra “Abierto ahora”.</p></div></div>
        <div class="card-body">
          <div class="form-grid">
            <label class="field"><span>Abre</span><select name="openHour" ${dis}>${hourOptions(p.openHour ?? 8, 0, 23)}</select></label>
            <label class="field"><span>Cierra</span><select name="closeHour" ${dis}>${hourOptions(p.closeHour ?? 18, 1, 24)}</select></label>
          </div>
          <div class="field"><span class="field-label">Días</span>${weekdayChips("profileDays", days, dis)}</div>
        </div>
        ${editable ? '<div class="card-foot form-actions"><button type="submit" class="btn btn-primary">Guardar cambios</button></div>' : ""}
      </section>
    </form>`;

  if (!editable) return;

  const form = $("#business-form");
  const logoInput = form.logoUrl;
  const preview = $("#logo-preview");
  const fallbackLogo = () => initialsLogo(form.elements.namedItem("name").value, HEX_COLOR.test(form.brandColor.value) ? form.brandColor.value : DEFAULT_BRAND);

  $("#logo-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await prepareLogo(file);
      logoInput.value = dataUrl;
      preview.src = dataUrl;
      $("#logo-remove").hidden = false;
    } catch (error) { toast(error.message, { error: true }); }
    event.target.value = "";
  });
  $("#logo-remove").addEventListener("click", () => {
    logoInput.value = "";
    preview.src = fallbackLogo();
    $("#logo-remove").hidden = true;
  });

  $$("[data-color-for]", form).forEach((picker) => {
    const text = form[picker.dataset.colorFor];
    picker.addEventListener("input", () => { text.value = picker.value; if (!logoInput.value) preview.src = fallbackLogo(); });
    text.addEventListener("input", () => { if (HEX_COLOR.test(text.value)) picker.value = text.value; });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const profile = Object.fromEntries([...fd.entries()].filter(([k]) => k !== "profileDays"));
    profile.badgeEnabled = form.badgeEnabled.checked;
    profile.openHour = Number(profile.openHour);
    profile.closeHour = Number(profile.closeHour);
    profile.weekdays = fd.getAll("profileDays").map(Number);
    for (const key of ["brandColor", "secondaryColor"]) {
      if (profile[key] && !HEX_COLOR.test(profile[key])) return toast("Los colores van en formato #RRGGBB.", { error: true });
    }
    try {
      await withBusy($("button[type=submit]", form), "Guardando…", () => saveSettings({ profile }));
      const typeChanged = profile.businessType && profile.businessType !== (p.businessType || "school");
      toast("Datos del negocio guardados.");
      await loadBrand();
      if (typeChanged) location.reload();
    } catch (error) { toast(error.message, { error: true }); }
  });
}

// Logos are stored inside the profile, so keep them small: SVG as-is (if
// light), bitmaps resized to 256px PNG.
async function prepareLogo(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error("La imagen es demasiado grande (máximo 5 MB).");
  const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(blob);
  });
  if (file.type === "image/svg+xml" && file.size <= 200 * 1024) return readAsDataUrl(file);

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      image.src = url;
    });
    const size = 256;
    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight, 1);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    canvas.getContext("2d").drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hourOptions(selected, from, to) {
  let html = "";
  for (let h = from; h <= to; h += 1) html += `<option value="${h}" ${Number(selected) === h ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`;
  return html;
}

function weekdayChips(name, selected, dis) {
  return `<div class="chip-group">${WEEKDAYS.map(([v, label]) => `
    <label class="chip-toggle"><input type="checkbox" name="${name}" value="${v}" ${selected.includes(v) ? "checked" : ""} ${dis}><span>${label}</span></label>`).join("")}</div>`;
}

/* Agenda */
async function renderBookingTab(panel) {
  const [settings, blocksData] = await Promise.all([getSettings(true), api("/api/crm/blocked-slots")]);
  const b = settings.booking || {};
  const f = settings.followup || {};
  const editable = currentManager?.role === "admin";
  const dis = editable ? "" : "disabled";

  panel.innerHTML = `
    <form id="booking-form" class="card">
      <div class="card-head"><div><h2>Horarios para ${esc(V.appt.plural)}</h2><p>Lo que el chat ofrece a ${isSchool() ? "las familias" : `tus ${V.clients}`}.</p></div></div>
      <div class="card-body">
        <div class="form-grid">
          <label class="field"><span>Primer horario</span><select name="openHour" ${dis}>${hourOptions(b.openHour ?? 9, 0, 23)}</select></label>
          <label class="field"><span>Último horario</span><select name="closeHour" ${dis}>${hourOptions(b.closeHour ?? 16, 0, 23)}</select></label>
          <label class="field"><span>Duración de cada ${esc(V.appt.noun)}</span><select name="slotMinutes" ${dis}>${[15, 20, 30, 45, 60].map((v) => `<option value="${v}" ${Number(b.slotMinutes || 30) === v ? "selected" : ""}>${v} minutos</option>`).join("")}</select></label>
          <label class="field"><span>Anticipación mínima</span><select name="minDaysAhead" ${dis}>${[0, 1, 2, 3, 5, 7].map((v) => `<option value="${v}" ${Number(b.minDaysAhead ?? 1) === v ? "selected" : ""}>${v === 0 ? "Mismo día" : v === 1 ? "1 día" : `${v} días`}</option>`).join("")}</select></label>
          <label class="field"><span>Mostrar hasta</span><input name="maxDaysAhead" type="number" min="1" max="180" value="${esc(b.maxDaysAhead ?? 30)}" ${dis}><small>Días hacia adelante.</small></label>
          <label class="field"><span>Seguimiento después ${isSchool() ? "de la visita" : esc(V.appt.of || `de ${V.appt.the}`)}</span><input name="daysAfterInterview" type="number" min="0" max="60" value="${esc(f.daysAfterInterview ?? 2)}" ${dis}><small>Días hasta crear la tarea de seguimiento.</small></label>
        </div>
        <div class="field"><span class="field-label">Días con ${esc(V.appt.plural)}</span>${weekdayChips("bookingDays", b.weekdays || [1, 2, 3, 4, 5], dis)}</div>
      </div>
      ${editable ? '<div class="card-foot form-actions"><button type="submit" class="btn btn-primary">Guardar cambios</button></div>' : ""}
    </form>

    <section class="card">
      <div class="card-head"><div><h2>Bloqueos</h2><p>Feriados, jornadas internas o cualquier franja que no se deba ofrecer.</p></div>${editable ? `<button id="new-block" class="btn btn-secondary btn-sm">${icon("plus")}Bloquear horario</button>` : ""}</div>
      <div class="list">
        ${blocksData.blocks.length ? blocksData.blocks.map((block) => `
          <div class="list-row">
            <span class="list-row-main"><strong>${esc(block.reason || "Bloqueo")}</strong><span>${esc(fmtDate(block.start_at))} → ${esc(fmtDate(block.end_at))}</span></span>
            ${editable ? `<button class="btn btn-ghost btn-sm" data-block-delete="${esc(block.id)}">Quitar</button>` : ""}
          </div>`).join("") : '<div class="empty">Sin bloqueos próximos.</div>'}
      </div>
    </section>`;

  if (!editable) return;

  $("#booking-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const booking = {
      openHour: Number(fd.get("openHour")),
      closeHour: Number(fd.get("closeHour")),
      slotMinutes: Number(fd.get("slotMinutes")),
      minDaysAhead: Number(fd.get("minDaysAhead")),
      maxDaysAhead: Number(fd.get("maxDaysAhead")),
      weekdays: fd.getAll("bookingDays").map(Number)
    };
    try {
      await withBusy($("button[type=submit]", event.currentTarget), "Guardando…", () =>
        saveSettings({ booking, followup: { daysAfterInterview: Number(fd.get("daysAfterInterview")) } }));
      toast("Agenda actualizada.");
    } catch (error) { toast(error.message, { error: true }); }
  });

  $("#new-block").addEventListener("click", () => {
    const body = openDialog(`
      <div class="card-head"><h2>Bloquear horario</h2></div>
      <form id="block-form" class="card-body">
        <div class="form-grid">
          <label class="field"><span>Desde</span><input name="start" type="datetime-local" required></label>
          <label class="field"><span>Hasta</span><input name="end" type="datetime-local" required></label>
          <label class="field span-2"><span>Motivo</span><input name="reason" maxlength="240" placeholder="Ej. Jornada docente"></label>
        </div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Bloquear</button></div>
      </form>`);
    $("[data-close]", body).addEventListener("click", closeDialog);
    $("#block-form", body).addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      try {
        await post("/api/crm/blocked-slots", {
          action: "create",
          startAt: new Date(fd.get("start")).toISOString(),
          endAt: new Date(fd.get("end")).toISOString(),
          reason: fd.get("reason")
        });
        closeDialog();
        toast("Horario bloqueado.");
        renderSettingsTab();
      } catch (error) { toast(error.message, { error: true }); }
    });
  });

  $$("[data-block-delete]", panel).forEach((btn) => btn.addEventListener("click", async () => {
    try {
      await post("/api/crm/blocked-slots", { action: "delete", id: btn.dataset.blockDelete });
      toast("Bloqueo quitado.");
      renderSettingsTab();
    } catch (error) { toast(error.message, { error: true }); }
  }));
}

/* Captación */
const captureOptions = () => [
  ["contactOffer", "Ofrecer enviar información", isSchool()
    ? "Cuando la familia muestra interés pero no agenda, el asistente ofrece que Admisiones le escriba por WhatsApp o correo."
    : `Cuando alguien muestra interés pero no reserva, el asistente ofrece que ${V.team} le escriba por WhatsApp o correo.`],
  ["vacancyAlerts", V.vacancyOption[0], V.vacancyOption[1]],
  ["brochure", "Folleto", "Si pide más detalle, el asistente ofrece el folleto: se descarga en el chat y se envía por correo."],
  ["callback", "Que lo llamen", "Si prefiere hablar con una persona, deja su teléfono y el mejor horario para llamarlo."],
  ["autoDetect", "Detectar teléfonos y correos", isSchool()
    ? "Si la familia escribe su teléfono o correo en la conversación, se registra como candidato automáticamente."
    : `Si escribe su teléfono o correo en la conversación, se registra como ${V.lead} automáticamente.`]
];

function fmtBytes(bytes) {
  const n = Number(bytes) || 0;
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

async function renderCaptureTab(panel) {
  const { capture, brochure } = await api("/api/crm/capture");
  const editable = currentManager?.role === "admin";
  const dis = editable ? "" : "disabled";

  panel.innerHTML = `
    <form id="capture-form" class="card">
      <div class="card-head"><div><h2>Captación de contactos</h2><p>${isSchool() ? "Formas de quedarte con el contacto de las familias que todavía no agendan una visita." : `Formas de quedarte con el contacto de quienes todavía no reservan ${V.appt.a}.`} Aparecen en ${esc(V.Leads)} → Contactos sin ${esc(V.appt.noun)}, con una tarea de seguimiento.</p></div></div>
      <div class="list">
        ${captureOptions().map(([key, label, help]) => `
          <label class="list-row capture-option">
            <span class="list-row-main"><strong>${label}</strong><span>${help}</span></span>
            <span class="switch"><input type="checkbox" name="${key}" ${capture[key] !== false ? "checked" : ""} ${dis}><span class="track"></span></span>
          </label>`).join("")}
      </div>
      <div class="card-body">
        <label class="field"><span>${esc(V.vacancyTextLabel)}</span>
          <textarea name="vacancyText" rows="2" maxlength="400" placeholder="${esc(V.vacancyTextPlaceholder)}" ${dis}>${esc(capture.vacancyText || "")}</textarea>
          <small>${esc(V.vacancyTextHelp)}</small>
        </label>
      </div>
      ${editable ? '<div class="card-foot form-actions"><button type="submit" class="btn btn-primary">Guardar cambios</button></div>' : ""}
    </form>

    <section class="card">
      <div class="card-head"><div><h2>Folleto</h2><p>PDF de hasta 3 MB con la propuesta, niveles o lo que quieras compartir.</p></div></div>
      <div class="card-body">
        ${brochure ? `
          <div class="file-row">
            <span class="file-icon">PDF</span>
            <span class="list-row-main"><strong>${esc(brochure.name)}</strong><span>${esc(fmtBytes(brochure.size))} · subido ${esc(fmtDate(brochure.updated_at, { dateStyle: "medium" }))}</span></span>
            <a class="btn btn-ghost btn-sm" href="/api/profile?file=brochure" target="_blank" rel="noreferrer">${icon("download")}Ver</a>
            ${editable ? `<button class="btn btn-ghost btn-sm" id="delete-brochure">${icon("trash")}Quitar</button>` : ""}
          </div>` : '<p class="muted">Todavía no subiste un folleto.</p>'}
        ${editable ? `
          <div class="form-actions" style="justify-content:flex-start">
            <label class="btn btn-secondary btn-sm">${brochure ? "Reemplazar PDF" : "Subir PDF"}<input id="brochure-file" type="file" accept="application/pdf,.pdf" hidden></label>
          </div>
          <label class="field"><span>O un enlace al folleto</span>
            <input form="capture-form" name="brochureUrl" type="url" placeholder="https://…" value="${esc(capture.brochureUrl || "")}">
            <small>Se usa si no subiste un PDF. Guardalo con “Guardar cambios”.</small>
          </label>` : ""}
      </div>
    </section>`;

  if (!editable) return;

  $("#capture-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(captureOptions().map(([key]) => [key, form.elements[key].checked]));
    values.vacancyText = form.elements.vacancyText.value;
    values.brochureUrl = $("[name=brochureUrl]")?.value || "";
    try {
      await withBusy($("button[type=submit]", form), "Guardando…", () => post("/api/crm/capture", { action: "save", capture: values }));
      toast("Captación actualizada.");
    } catch (error) { toast(error.message, { error: true }); }
  });

  $("#brochure-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast("El folleto puede pesar hasta 3 MB.", { error: true });
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
        reader.readAsDataURL(file);
      });
      toast("Subiendo folleto…");
      await post("/api/crm/capture", { action: "upload-brochure", name: file.name, data });
      toast("Folleto subido.");
      renderSettingsTab();
    } catch (error) { toast(error.message, { error: true }); }
  });

  $("#delete-brochure")?.addEventListener("click", async () => {
    if (!(await confirmDialog("El asistente va a dejar de ofrecer el folleto (salvo que cargues un enlace).", { title: "¿Quitar el folleto?", confirmLabel: "Quitar", danger: true }))) return;
    try {
      await post("/api/crm/capture", { action: "delete-brochure" });
      toast("Folleto quitado.");
      renderSettingsTab();
    } catch (error) { toast(error.message, { error: true }); }
  });
}

/* Integraciones */
const EMAIL_PRESETS = {
  gmail: { label: "Gmail o Google Workspace", host: "smtp.gmail.com", port: 587, secure: false, hint: "Usá una contraseña de aplicación (Cuenta de Google → Seguridad → Contraseñas de aplicaciones), no tu contraseña normal." },
  outlook: { label: "Microsoft 365 u Outlook", host: "smtp.office365.com", port: 587, secure: false, hint: "La cuenta debe tener habilitado SMTP autenticado." },
  zoho: { label: "Zoho Mail", host: "smtp.zoho.com", port: 465, secure: true, hint: "" },
  custom: { label: "Otro proveedor", host: "", port: 587, secure: false, hint: "Pedile a tu proveedor el servidor SMTP, el puerto y si usa SSL." }
};

function sourceLabel(item) {
  if (!item.configured) return '<span class="pill pill-warning">Sin configurar</span>';
  if (item.source === "env") return '<span class="pill pill-success">Conectado · variables del servidor</span>';
  return '<span class="pill pill-success">Conectado</span>';
}

async function renderIntegrationsTab(panel) {
  const { integrations } = await api("/api/crm/integrations");
  const { ai, email, calendar } = integrations;
  const presetKey = Object.entries(EMAIL_PRESETS).find(([, p]) => p.host && p.host === email.host)?.[0] || (email.host ? "custom" : "gmail");

  panel.innerHTML = `
    <form class="card" data-section="ai">
      <div class="card-head">
        <div class="integration-head">
          <span class="integration-icon">${icon("sparkle")}</span>
          <div><h2>Inteligencia artificial</h2><p>Google Gemini responde las consultas del chat.</p></div>
        </div>
        ${sourceLabel(ai)}
      </div>
      <div class="card-body">
        <div class="callout">Creá una clave gratis en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a> → “Create API key”, y pegala acá.</div>
        <div class="form-grid">
          <label class="field span-2"><span>Clave de API</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${ai.configured ? `Guardada (${esc(ai.apiKeyHint)}). Escribí una nueva para reemplazarla.` : "AIza…"}"></label>
          <label class="field"><span>Modelo principal</span><input name="model" class="mono" value="${esc(ai.model)}" placeholder="${esc(ai.defaults.model)}"></label>
          <label class="field"><span>Modelo de respaldo</span><input name="fallbackModel" class="mono" value="${esc(ai.fallbackModel)}" placeholder="${esc(ai.defaults.fallbackModel)}"><small>Se usa si el principal tarda o falla.</small></label>
        </div>
      </div>
      <div class="card-foot form-actions">
        <span class="inline-result" data-result></span>
        <button type="button" class="btn btn-ghost" data-test>Probar conexión</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>

    <form class="card" data-section="email">
      <div class="card-head">
        <div class="integration-head">
          <span class="integration-icon">${icon("mailOut")}</span>
          <div><h2>Correo saliente</h2><p>Confirmaciones a las familias y avisos al equipo.</p></div>
        </div>
        ${sourceLabel(email)}
      </div>
      <div class="card-body">
        <div class="form-grid">
          <label class="field span-2"><span>Proveedor</span><select name="preset">${Object.entries(EMAIL_PRESETS).map(([k, p]) => `<option value="${k}" ${k === presetKey ? "selected" : ""}>${p.label}</option>`).join("")}</select></label>
          <div class="callout span-2" data-preset-hint ${EMAIL_PRESETS[presetKey].hint ? "" : "hidden"}>${esc(EMAIL_PRESETS[presetKey].hint)}</div>
          <label class="field"><span>Servidor SMTP</span><input name="host" class="mono" value="${esc(email.host)}" placeholder="smtp.ejemplo.com"></label>
          <label class="field"><span>Puerto</span><input name="port" type="number" min="1" max="65535" value="${esc(email.port || 587)}"></label>
          <label class="field"><span>Usuario</span><input name="user" value="${esc(email.user)}" autocomplete="off" placeholder="admisiones@tucolegio.edu"></label>
          <label class="field"><span>Contraseña</span><input name="password" type="password" autocomplete="new-password" placeholder="${email.passwordHint ? "Guardada. Escribí una nueva para reemplazarla." : ""}"></label>
          <label class="field"><span>Remitente</span><input name="from" value="${esc(email.from)}" placeholder='Admisiones <admisiones@tucolegio.edu>'></label>
          <label class="field"><span>Avisos internos a</span><input name="notifyTo" type="email" value="${esc(email.notifyTo)}" placeholder="admisiones@tucolegio.edu"><small>Recibe cada visita nueva y los recordatorios.</small></label>
          <label class="switch span-2"><input type="checkbox" name="secure" ${email.secure ? "checked" : ""}><span class="track"></span>Conexión SSL directa (puerto 465)</label>
        </div>
      </div>
      <div class="card-foot form-actions">
        <span class="inline-result" data-result></span>
        <button type="button" class="btn btn-ghost" data-test>Enviarme un correo de prueba</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>

    <form class="card" data-section="calendar">
      <div class="card-head">
        <div class="integration-head">
          <span class="integration-icon">${icon("calendar")}</span>
          <div><h2>Google Calendar</h2><p>Opcional. Agrega cada visita a tu calendario y evita horarios ocupados.</p></div>
        </div>
        ${calendar.configured ? sourceLabel(calendar) : '<span class="pill">Opcional</span>'}
      </div>
      <div class="card-body">
        <ol class="steps">
          <li>En Google Cloud, creá una cuenta de servicio y descargá su clave en formato JSON.</li>
          <li>Pegá el contenido del JSON abajo (o subí el archivo).</li>
          <li>En Google Calendar, compartí tu calendario con el correo de la cuenta de servicio, con permiso “Hacer cambios en eventos”.</li>
        </ol>
        ${calendar.serviceAccountEmail ? `<div class="callout">Compartí el calendario con <code>${esc(calendar.serviceAccountEmail)}</code> <button type="button" class="btn btn-ghost btn-sm" data-copy="${esc(calendar.serviceAccountEmail)}">${icon("copy")}Copiar</button></div>` : ""}
        <div class="form-grid">
          <label class="field span-2"><span>ID del calendario</span><input name="calendarId" class="mono" value="${esc(calendar.calendarId)}" placeholder="tucorreo@gmail.com o …@group.calendar.google.com"><small>Google Calendar → Configuración del calendario → Integrar el calendario.</small></label>
          <label class="field span-2"><span>Credenciales de la cuenta de servicio</span><textarea name="serviceAccountJson" rows="4" class="mono" spellcheck="false" placeholder='${calendar.hasCredentials ? "Guardadas. Pegá un JSON nuevo para reemplazarlas." : '{"type": "service_account", …}'}'></textarea></label>
          <label class="field span-2"><span>O subí el archivo</span><input type="file" accept="application/json,.json" data-json-file></label>
        </div>
      </div>
      <div class="card-foot form-actions">
        <span class="inline-result" data-result></span>
        <button type="button" class="btn btn-ghost" data-test>Probar conexión</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>`;

  const emailForm = $('[data-section="email"]', panel);
  emailForm.preset.addEventListener("change", () => {
    const preset = EMAIL_PRESETS[emailForm.preset.value];
    if (preset.host) emailForm.host.value = preset.host;
    emailForm.port.value = preset.port;
    emailForm.secure.checked = preset.secure;
    const hint = $("[data-preset-hint]", emailForm);
    hint.textContent = preset.hint;
    hint.hidden = !preset.hint;
  });

  $("[data-json-file]", panel).addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    $('[data-section="calendar"] textarea', panel).value = await file.text();
  });
  $$("[data-copy]", panel).forEach((btn) => btn.addEventListener("click", () => copyToClipboard(btn.dataset.copy)));

  const collect = (form) => {
    const fd = new FormData(form);
    const values = Object.fromEntries([...fd.entries()].filter(([k, v]) => k !== "preset" && !(v instanceof File)));
    if (form.dataset.section === "email") values.secure = form.secure.checked;
    return values;
  };

  $$("form[data-section]", panel).forEach((form) => {
    const result = $("[data-result]", form);
    const show = (text, ok) => { result.textContent = text; result.className = `inline-result ${ok ? "is-ok" : "is-error"}`; };

    $("[data-test]", form).addEventListener("click", async (event) => {
      result.textContent = "";
      try {
        const data = await withBusy(event.currentTarget, "Probando…", () =>
          post("/api/crm/integrations", { action: "test", section: form.dataset.section, values: collect(form) }));
        show(data.message, true);
      } catch (error) { show(error.message, false); }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      result.textContent = "";
      try {
        await withBusy($("button[type=submit]", form), "Guardando…", () =>
          post("/api/crm/integrations", { action: "save", section: form.dataset.section, values: collect(form) }));
        toast("Integración guardada.");
        refreshBadges();
        renderSettingsTab();
      } catch (error) { show(error.message, false); }
    });
  });
}

/* Equipo */
async function renderTeamTab(panel) {
  const data = await api("/api/crm/team");
  panel.innerHTML = `
    <section class="card">
      <div class="card-head"><div><h2>Equipo</h2><p>Quiénes pueden entrar al panel.</p></div><button id="add-member" class="btn btn-primary btn-sm">${icon("plus")}Agregar persona</button></div>
      <div class="list">
        ${data.members.map((m) => `
          <div class="list-row member-row">
            <span class="avatar-initials">${esc(initials(m.full_name))}</span>
            <span class="list-row-main"><strong>${esc(m.full_name)}${m.id === data.me ? " (vos)" : ""}</strong><span>${esc(m.email)}</span></span>
            <span class="list-row-aside">
              ${m.active ? "" : '<span class="pill">Desactivado</span>'}
              <select data-role="${esc(m.id)}" aria-label="Rol de ${esc(m.full_name)}">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === m.role ? "selected" : ""}>${v}</option>`).join("")}</select>
              ${m.id !== data.me ? `
                <button class="btn btn-ghost btn-sm" data-reset="${esc(m.id)}" data-name="${esc(m.full_name)}">Nueva contraseña</button>
                <button class="btn btn-ghost btn-sm" data-active="${esc(m.id)}" data-value="${m.active ? "false" : "true"}">${m.active ? "Desactivar" : "Activar"}</button>` : ""}
            </span>
          </div>`).join("")}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Qué puede hacer cada rol</h2></div>
      <div class="card-body">
        <dl class="facts">
          <dt>Administrador</dt><dd>Todo, incluida la configuración, las integraciones y el equipo.</dd>
          <dt>Gestor</dt><dd>Gestiona candidatos, visitas y seguimientos. No cambia la configuración.</dd>
          <dt>Solo lectura</dt><dd>Ve la información sin poder modificarla.</dd>
        </dl>
      </div>
    </section>`;

  const showPassword = (name, email, password) => {
    const body = openDialog(`
      <div class="card-head"><h2>Contraseña temporal</h2></div>
      <div class="card-body">
        <p>Compartila con ${esc(name)} por un canal seguro. Podrá cambiarla desde Configuración → Mi cuenta.</p>
        <div class="callout"><strong>Usuario:</strong> <code>${esc(email || "")}</code><br><strong>Contraseña:</strong> <code>${esc(password)}</code></div>
        <p class="muted small">Por seguridad no se vuelve a mostrar.</p>
        <div class="form-actions"><button class="btn btn-ghost" data-copy>${icon("copy")}Copiar</button><button class="btn btn-primary" data-close>Listo</button></div>
      </div>`);
    $("[data-copy]", body).addEventListener("click", () => copyToClipboard(`Panel: ${location.origin}/dashboard\nUsuario: ${email || ""}\nContraseña: ${password}`));
    $("[data-close]", body).addEventListener("click", closeDialog);
  };

  $("#add-member").addEventListener("click", () => {
    const body = openDialog(`
      <div class="card-head"><h2>Agregar persona</h2></div>
      <form id="member-form" class="card-body">
        <div class="form-grid">
          <label class="field"><span>Nombre</span><input name="name" required maxlength="160"></label>
          <label class="field"><span>Correo</span><input name="email" type="email" required></label>
          <label class="field span-2"><span>Rol</span><select name="role">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === "manager" ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        </div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button type="submit" class="btn btn-primary">Agregar</button></div>
      </form>`);
    $("[data-close]", body).addEventListener("click", closeDialog);
    $("#member-form", body).addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try {
        const res = await post("/api/crm/team", { action: "create", ...values });
        renderSettingsTab();
        showPassword(res.member.full_name, res.member.email, res.temporaryPassword);
      } catch (error) { toast(error.message, { error: true }); }
    });
  });

  $$("[data-role]", panel).forEach((select) => select.addEventListener("change", async () => {
    try {
      await post("/api/crm/team", { action: "update", id: select.dataset.role, role: select.value });
      toast("Rol actualizado.");
    } catch (error) { toast(error.message, { error: true }); renderSettingsTab(); }
  }));
  $$("[data-active]", panel).forEach((btn) => btn.addEventListener("click", async () => {
    try {
      await post("/api/crm/team", { action: "update", id: btn.dataset.active, active: btn.dataset.value === "true" });
      renderSettingsTab();
    } catch (error) { toast(error.message, { error: true }); }
  }));
  $$("[data-reset]", panel).forEach((btn) => btn.addEventListener("click", async () => {
    const ok = await confirmDialog(`Se genera una contraseña nueva para ${btn.dataset.name} y la actual deja de funcionar.`, { title: "Nueva contraseña", confirmLabel: "Generar" });
    if (!ok) return;
    try {
      const res = await post("/api/crm/team", { action: "reset-password", id: btn.dataset.reset });
      const member = data.members.find((m) => m.id === btn.dataset.reset);
      showPassword(btn.dataset.name, member?.email, res.temporaryPassword);
    } catch (error) { toast(error.message, { error: true }); }
  }));
}

/* Mi cuenta */
async function renderAccountTab(panel) {
  panel.innerHTML = `
    <section class="card">
      <div class="card-head"><h2>Tu cuenta</h2></div>
      <div class="card-body">
        <dl class="facts">
          <dt>Nombre</dt><dd>${esc(currentManager?.name || "")}</dd>
          <dt>Correo</dt><dd>${esc(currentManager?.email || "")}</dd>
          <dt>Rol</dt><dd>${esc(ROLES[currentManager?.role] || "")}</dd>
        </dl>
      </div>
    </section>
    <form id="password-form" class="card">
      <div class="card-head"><h2>Cambiar contraseña</h2></div>
      <div class="card-body form-grid">
        <label class="field span-2"><span>Contraseña actual</span><input name="currentPassword" type="password" autocomplete="current-password" required></label>
        <label class="field"><span>Nueva contraseña</span><input name="newPassword" type="password" autocomplete="new-password" minlength="10" required><small>Mínimo 10 caracteres.</small></label>
        <label class="field"><span>Repetir nueva contraseña</span><input name="confirmPassword" type="password" autocomplete="new-password" minlength="10" required></label>
      </div>
      <div class="card-foot form-actions"><button type="submit" class="btn btn-primary">Cambiar contraseña</button></div>
    </form>`;

  $("#password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (values.newPassword !== values.confirmPassword) return toast("Las contraseñas nuevas no coinciden.", { error: true });
    try {
      await withBusy($("button[type=submit]", form), "Guardando…", () =>
        post("/api/crm/team", { action: "change-password", currentPassword: values.currentPassword, newPassword: values.newPassword }));
      form.reset();
      toast("Contraseña actualizada.");
    } catch (error) { toast(error.message, { error: true }); }
  });
}

init();
