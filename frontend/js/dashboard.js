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

const STAGES = [
  ["new_inquiry", "Nuevos"],
  ["qualified", "Interesados"],
  ["visit_scheduled", "Visita agendada"],
  ["followup", "Seguimiento"],
  ["application_started", "Inscripción"],
  ["waitlist", "Lista de espera"],
  ["enrolled", "Confirmados"],
  ["lost", "No continúa"]
];
const STAGE_LABEL = Object.fromEntries(STAGES);

const APPT_STATUS = {
  scheduled: ["Agendada", ""],
  confirmed: ["Confirmada", "pill-accent"],
  completed: ["Realizada", "pill-success"],
  no_show: ["No asistió", "pill-warning"],
  cancelled: ["Cancelada", "pill-danger"]
};

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
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
};
const icon = (name, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;

let currentView = "overview";
let currentManager = null;
let settingsTab = "start";
let settingsCache = null;
let brand = { name: "Panel de admisiones", logo: "/assets/nubarian-shield.svg" };

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

async function loadBrand() {
  try {
    const data = await api("/api/profile");
    brand = { name: data.profile?.name || brand.name, logo: data.profile?.logoUrl || brand.logo };
  } catch { /* keep defaults */ }
  $$("[data-brand-name]").forEach((node) => { node.textContent = brand.name; });
  $$(".auth-logo, .brand-logo").forEach((img) => { img.src = brand.logo; });
  document.title = `Panel de admisiones · ${brand.name}`;
}

/* ---------- Auth ---------- */

async function init() {
  loadBrand();
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
        <div class="card stat"><span>Consultas (30 días)</span><strong>${s.inquiries_30d}</strong></div>
        <div class="card stat"><span>Candidatos nuevos (30 días)</span><strong>${s.leads_30d}</strong></div>
        <div class="card stat"><span>Visitas próximas</span><strong>${s.upcoming_appointments}</strong></div>
        <div class="card stat ${Number(s.overdue_followups) ? "is-alert" : ""}"><span>Seguimientos vencidos</span><strong>${s.overdue_followups}</strong></div>
      </div>

      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h2>Próximas visitas</h2><button class="btn btn-ghost btn-sm" data-go="agenda">Ver agenda</button></div>
          <div class="list">
            ${upcoming.length ? upcoming.map((a) => `
              <button class="list-row" data-lead="${esc(a.lead_id || "")}">
                <span class="time-col">${fmtTime(a.start_at)}</span>
                <span class="list-row-main"><strong>${esc(a.student_name || a.adult_name || "Sin nombre")}</strong><span>${esc(fmtLongDay(a.start_at))} · ${esc(a.adult_name || "")}</span></span>
                ${icon("chevron", "chevron")}
              </button>`).join("") : '<div class="empty">No hay visitas agendadas.</div>'}
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
  } catch (error) {
    handleViewError(error);
  }
}

/* ---------- Pipeline ---------- */

async function loadPipeline() {
  if (!view.querySelector(".pipeline")) setLoading("Cargando candidatos…");
  try {
    const search = leadSearch.value.trim();
    const data = await api(`/api/crm/leads${search ? `?search=${encodeURIComponent(search)}` : ""}`);
    const grouped = Object.fromEntries(STAGES.map(([key]) => [key, []]));
    data.leads.forEach((lead) => (grouped[lead.status] || grouped.new_inquiry).push(lead));

    view.innerHTML = `
      <div class="pipeline">
        ${STAGES.map(([key, label]) => `
          <section class="stage">
            <div class="stage-head"><span>${label}</span><span class="stage-count">${grouped[key].length}</span></div>
            <div class="stage-body">
              ${grouped[key].map((lead) => `
                <button class="lead-card" data-lead="${esc(lead.id)}">
                  <strong>${esc(lead.student_name || lead.adult_name || "Sin nombre")}</strong>
                  ${lead.student_name && lead.adult_name ? `<span>${esc(lead.adult_name)}</span>` : ""}
                  <span>${esc(lead.level_interest || "Nivel sin definir")}</span>
                  <span class="lead-meta">
                    ${lead.next_appointment ? `<span class="pill pill-accent">Visita ${esc(fmtDay(lead.next_appointment))}</span>` : ""}
                    ${lead.next_followup ? `<span class="pill ${new Date(lead.next_followup) < new Date() ? "pill-danger" : ""}">Seguimiento ${esc(fmtDay(lead.next_followup))}</span>` : ""}
                    ${lead.ai_interest_level ? `<span class="pill">Interés ${esc(lead.ai_interest_level)}</span>` : ""}
                  </span>
                </button>`).join("") || '<div class="stage-empty">Sin candidatos</div>'}
            </div>
          </section>`).join("")}
      </div>`;
    wireLeadOpeners();
  } catch (error) {
    handleViewError(error);
  }
}

/* ---------- Agenda ---------- */

async function loadAgenda() {
  setLoading("Cargando agenda…");
  try {
    const data = await api("/api/crm/appointments");
    const canEdit = currentManager?.role !== "viewer";
    const active = data.appointments
      .filter((a) => a.status !== "cancelled")
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    const groups = {};
    active.forEach((a) => {
      const key = new Date(a.start_at).toLocaleDateString("en-CA");
      (groups[key] ||= []).push(a);
    });

    if (!active.length) {
      view.innerHTML = '<div class="card"><div class="empty"><strong>No hay visitas en el período</strong>Las visitas que agenden las familias desde el chat aparecen acá.</div></div>';
      return;
    }

    view.innerHTML = Object.entries(groups).map(([date, items]) => `
      <section class="agenda-day">
        <h2>${esc(fmtLongDay(`${date}T12:00:00`).replace(/^./, (c) => c.toUpperCase()))}</h2>
        <div class="card list">
          ${items.map((a) => {
            const [label, tone] = APPT_STATUS[a.status] || [a.status, ""];
            const open = ["scheduled", "confirmed"].includes(a.status);
            return `
            <div class="list-row appt-row is-link" data-lead="${esc(a.lead_id || "")}">
              <span class="time-col">${fmtTime(a.start_at)}</span>
              <span class="list-row-main"><strong>${esc(a.student_name || "Estudiante")}</strong><span>${esc(a.adult_name || "")}${a.phone ? ` · ${esc(a.phone)}` : ""}</span></span>
              <span class="pill ${tone}">${esc(label)}</span>
              ${canEdit && open ? `
                <span class="appt-actions" data-stop>
                  ${a.status === "scheduled" ? `<button class="btn btn-secondary btn-sm" data-appointment="${esc(a.id)}" data-status="confirmed">Confirmar</button>` : ""}
                  <button class="btn btn-success btn-sm" data-appointment="${esc(a.id)}" data-status="completed">Realizada</button>
                  <button class="btn btn-ghost btn-sm" data-appointment="${esc(a.id)}" data-status="no_show">No asistió</button>
                  <button class="btn btn-ghost btn-sm" data-appointment="${esc(a.id)}" data-status="cancelled">Cancelar</button>
                </span>` : ""}
            </div>`;
          }).join("")}
        </div>
      </section>`).join("");

    wireLeadOpeners();
    $$("[data-appointment]", view).forEach((btn) => btn.addEventListener("click", async () => {
      const status = btn.dataset.status;
      const [label] = APPT_STATUS[status];
      if (status === "cancelled" || status === "no_show") {
        const ok = await confirmDialog(
          status === "cancelled" ? "Se cancela la visita y se libera el horario." : "La visita queda marcada como no asistida.",
          { title: status === "cancelled" ? "Cancelar visita" : "Marcar como no asistió", confirmLabel: status === "cancelled" ? "Cancelar visita" : "Marcar", danger: status === "cancelled" }
        );
        if (!ok) return;
      }
      try {
        await post("/api/crm/appointments", { id: btn.dataset.appointment, status });
        toast(`Visita marcada como ${label.toLowerCase()}.`);
        loadAgenda();
        refreshBadges();
      } catch (error) { toast(error.message, { error: true }); }
    }));
  } catch (error) {
    handleViewError(error);
  }
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
            }).join("") || '<div class="empty"><strong>Todavía no hay información</strong>Agregá precios, horarios, niveles y todo lo que las familias suelen preguntar.</div>'}
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
    $("#drawer-title").textContent = STAGE_LABEL[l.status] || "Candidato";

    leadDetail.innerHTML = `
      <section class="card card-body">
        <div class="lead-hero">
          <span class="avatar-initials">${esc(initials(name))}</span>
          <div><h3>${esc(name)}</h3><p>${esc(l.adult_name || "")}${l.level_interest ? ` · ${esc(l.level_interest)}` : ""}</p></div>
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
            <dt>Fecha de nacimiento</dt><dd>${esc(student.birth_date ? fmtDate(`${String(student.birth_date).slice(0, 10)}T12:00:00`, { dateStyle: "long" }) : "—")}</dd>
            <dt>Institución anterior</dt><dd>${esc(student.previous_institution || "—")}</dd>
            <dt>Comentarios</dt><dd>${esc(student.comments || "—")}</dd>
            <dt>Origen</dt><dd>${esc([l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ") || l.source || "—")}</dd>
          </dl>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Lectura de la IA</h2><p>Ayuda interna. No se muestra a la familia.</p></div>${canEdit ? `<button id="analyze-lead" class="btn btn-secondary btn-sm">${icon("sparkle")}${l.ai_analyzed_at ? "Actualizar" : "Analizar"}</button>` : ""}</div>
        <div class="card-body">
          ${l.ai_summary ? `
          <dl class="facts">
            <dt>Interés</dt><dd>${esc(l.ai_interest_level || "—")}</dd>
            <dt>Resumen</dt><dd>${esc(l.ai_summary)}</dd>
            <dt>Principal inquietud</dt><dd>${esc(l.ai_primary_concern || "—")}</dd>
            <dt>Siguiente paso sugerido</dt><dd>${esc(l.ai_next_action || "—")}</dd>
          </dl>` : '<p class="muted">Todavía no hay análisis. Usá “Analizar” para obtener un resumen de la conversación.</p>'}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Visitas y seguimientos</h2></div>
        <div class="card-body">
          <div class="timeline">
            ${data.appointments.map((a) => `<div class="timeline-item"><time>${esc(fmtDate(a.start_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }))}</time><span>Visita · ${esc((APPT_STATUS[a.status] || [a.status])[0])}</span></div>`).join("")}
            ${data.followups.map((f) => `<div class="timeline-item"><time>${esc(fmtDate(f.due_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }))}</time><span>${esc(f.title)} · ${f.status === "pending" ? "pendiente" : "hecho"}</span></div>`).join("")}
            ${!data.appointments.length && !data.followups.length ? '<p class="muted">Sin visitas ni seguimientos.</p>' : ""}
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
        <p>${allDone ? "El asistente está respondiendo y agendando visitas." : `${done} de ${required.length} pasos obligatorios completos.`}</p></div>
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
        <div class="field"><span class="field-label">Chat público para las familias</span>
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
          <label class="field"><span>Nombre</span><input name="name" value="${esc(p.name || "")}" required maxlength="160" ${dis}></label>
          <label class="field"><span>Categoría</span><input name="category" value="${esc(p.category || "")}" maxlength="120" placeholder="Educación" ${dis}></label>
          <label class="field span-2"><span>Descripción corta</span><input name="shortDescription" value="${esc(p.shortDescription || "")}" maxlength="260" placeholder="Ej. Inicial y Primaria" ${dis}></label>
          <label class="field span-2"><span>Mensaje destacado</span><input name="statusText" value="${esc(p.statusText || "")}" maxlength="160" placeholder="Ej. Inscripciones abiertas 2027" ${dis}></label>
          <label class="field span-2"><span>Logo</span><input name="logoUrl" type="url" value="${esc(p.logoUrl || "")}" placeholder="https://…/logo.png" ${dis}><small>Dirección de una imagen cuadrada (PNG o SVG). Si lo dejás vacío se usa el logo incluido.</small></label>
          <label class="check-row span-2"><input type="checkbox" name="badgeEnabled" ${p.badgeEnabled !== false ? "checked" : ""} ${dis}>Mostrar sello de perfil verificado</label>
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
  $("#business-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const profile = Object.fromEntries([...fd.entries()].filter(([k]) => k !== "profileDays"));
    profile.badgeEnabled = form.badgeEnabled.checked;
    profile.openHour = Number(profile.openHour);
    profile.closeHour = Number(profile.closeHour);
    profile.weekdays = fd.getAll("profileDays").map(Number);
    try {
      await withBusy($("button[type=submit]", form), "Guardando…", () => saveSettings({ profile }));
      toast("Datos del negocio guardados.");
      loadBrand();
    } catch (error) { toast(error.message, { error: true }); }
  });
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
      <div class="card-head"><div><h2>Horarios para visitas</h2><p>Lo que el chat ofrece a las familias.</p></div></div>
      <div class="card-body">
        <div class="form-grid">
          <label class="field"><span>Primer horario</span><select name="openHour" ${dis}>${hourOptions(b.openHour ?? 9, 0, 23)}</select></label>
          <label class="field"><span>Último horario</span><select name="closeHour" ${dis}>${hourOptions(b.closeHour ?? 16, 0, 23)}</select></label>
          <label class="field"><span>Duración de cada visita</span><select name="slotMinutes" ${dis}>${[15, 20, 30, 45, 60].map((v) => `<option value="${v}" ${Number(b.slotMinutes || 30) === v ? "selected" : ""}>${v} minutos</option>`).join("")}</select></label>
          <label class="field"><span>Anticipación mínima</span><select name="minDaysAhead" ${dis}>${[0, 1, 2, 3, 5, 7].map((v) => `<option value="${v}" ${Number(b.minDaysAhead ?? 1) === v ? "selected" : ""}>${v === 0 ? "Mismo día" : v === 1 ? "1 día" : `${v} días`}</option>`).join("")}</select></label>
          <label class="field"><span>Mostrar hasta</span><input name="maxDaysAhead" type="number" min="1" max="180" value="${esc(b.maxDaysAhead ?? 30)}" ${dis}><small>Días hacia adelante.</small></label>
          <label class="field"><span>Seguimiento después de la visita</span><input name="daysAfterInterview" type="number" min="0" max="60" value="${esc(f.daysAfterInterview ?? 2)}" ${dis}><small>Días hasta crear la tarea de seguimiento.</small></label>
        </div>
        <div class="field"><span class="field-label">Días con visitas</span>${weekdayChips("bookingDays", b.weekdays || [1, 2, 3, 4, 5], dis)}</div>
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
