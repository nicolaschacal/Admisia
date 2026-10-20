const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const crmApp = document.getElementById("crm-app");
const view = document.getElementById("view");
const viewTitle = document.getElementById("view-title");
const managerName = document.getElementById("manager-name");
const leadSearch = document.getElementById("lead-search");
const leadModal = document.getElementById("lead-modal");
const leadDetail = document.getElementById("lead-detail");

const STAGES = [
  ["new_inquiry","Nuevos"],
  ["qualified","Interesados"],
  ["visit_scheduled","Visita agendada"],
  ["followup","Seguimiento"],
  ["application_started","Inscripción"],
  ["waitlist","Lista de espera"],
  ["enrolled","Confirmados"],
  ["lost","No continúa"]
];

let currentView = "overview";
let currentLeads = [];
let currentManager = null;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function fmtDate(value, withTime = true) {
  if (!value) return "—";
  const d = new Date(value);
  return new Intl.DateTimeFormat("es-UY", withTime
    ? { dateStyle:"short", timeStyle:"short" }
    : { dateStyle:"medium" }
  ).format(d);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type":"application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || "Error de servidor");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function checkSession() {
  try {
    const data = await api("/api/crm/me");
    showApp(data.manager);
    await loadView();
  } catch {
    showLogin();
  }
}

function showLogin() {
  loginScreen.hidden = false;
  crmApp.hidden = true;
}

function showApp(manager) {
  currentManager = manager;
  loginScreen.hidden = true;
  crmApp.hidden = false;
  managerName.textContent = manager.name || manager.email;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const form = Object.fromEntries(new FormData(loginForm).entries());
  try {
    const data = await api("/api/crm/login", { method:"POST", body:JSON.stringify(form) });
    showApp(data.manager);
    loginForm.reset();
    await loadView();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  }
});

document.getElementById("logout-button").addEventListener("click", async () => {
  await api("/api/crm/logout", { method:"POST", body:"{}" }).catch(() => {});
  showLogin();
});

document.getElementById("refresh-button").addEventListener("click", () => loadView());

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", async () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    currentView = button.dataset.view;
    leadSearch.hidden = !["pipeline"].includes(currentView);
    await loadView();
  });
});

leadSearch.addEventListener("input", debounce(() => {
  if (currentView === "pipeline") loadPipeline();
}, 300));

document.getElementById("close-lead").addEventListener("click", () => {
  leadModal.hidden = true;
});
leadModal.addEventListener("click", (event) => {
  if (event.target === leadModal) leadModal.hidden = true;
});

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function loadView() {
  if (currentView === "overview") return loadOverview();
  if (currentView === "pipeline") return loadPipeline();
  if (currentView === "agenda") return loadAgenda();
  if (currentView === "followups") return loadFollowups();
  if (currentView === "inquiries") return loadInquiries();
  if (currentView === "settings") return loadSettings();
}

async function loadOverview() {
  viewTitle.textContent = "Resumen";
  view.innerHTML = '<div class="empty">Cargando…</div>';
  try {
    const [summary, followups, appointments] = await Promise.all([
      api("/api/crm/summary"),
      api("/api/crm/followups?status=pending"),
      api("/api/crm/appointments")
    ]);

    const s = summary.summary;
    const upcoming = appointments.appointments.filter((a) => ["scheduled","confirmed"].includes(a.status) && new Date(a.start_at) >= new Date()).slice(0,8);
    const due = followups.followups.slice(0,8);

    view.innerHTML = `
      <div class="stats">
        <div class="stat"><span>Consultas últimos 30 días</span><strong>${s.inquiries_30d}</strong></div>
        <div class="stat"><span>Nuevos candidatos</span><strong>${s.leads_30d}</strong></div>
        <div class="stat"><span>Próximas entrevistas</span><strong>${s.upcoming_appointments}</strong></div>
        <div class="stat danger"><span>Seguimientos vencidos</span><strong>${s.overdue_followups}</strong></div>
      </div>
      <div class="detail-grid">
        <section class="section-card">
          <div class="section-head"><h2>Próximas entrevistas</h2><button class="secondary" data-go="agenda">Ver agenda</button></div>
          ${upcoming.length ? upcoming.map(a => `
            <div class="lead-card" data-lead="${a.lead_id}">
              <strong>${esc(a.student_name || a.adult_name)}</strong>
              <small>${fmtDate(a.start_at)} · ${esc(a.adult_name)}</small>
            </div>`).join("") : '<div class="empty">No hay entrevistas próximas.</div>'}
        </section>
        <section class="section-card">
          <div class="section-head"><h2>Seguimientos prioritarios</h2><button class="secondary" data-go="followups">Ver todos</button></div>
          ${due.length ? due.map(f => `
            <div class="lead-card" data-lead="${f.lead_id}">
              <strong>${esc(f.student_name || f.adult_name)}</strong>
              <small>${esc(f.title)} · ${fmtDate(f.due_at)}</small>
            </div>`).join("") : '<div class="empty">No hay seguimientos pendientes.</div>'}
        </section>
      </div>
    `;

    wireLeadOpeners();
    view.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", () => {
      currentView = btn.dataset.go;
      document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === currentView));
      loadView();
    }));
  } catch (error) {
    handleViewError(error);
  }
}

async function loadPipeline() {
  viewTitle.textContent = "Pipeline de admisiones";
  view.innerHTML = '<div class="empty">Cargando candidatos…</div>';
  try {
    const search = leadSearch.value.trim();
    const data = await api(`/api/crm/leads${search ? "?search="+encodeURIComponent(search) : ""}`);
    currentLeads = data.leads;
    const grouped = Object.fromEntries(STAGES.map(([key]) => [key, []]));
    data.leads.forEach((lead) => (grouped[lead.status] || grouped.new_inquiry).push(lead));

    view.innerHTML = `
      <div class="pipeline">
        ${STAGES.map(([key,label]) => `
          <section class="stage">
            <div class="stage-head"><span>${label}</span><span class="stage-count">${grouped[key].length}</span></div>
            ${grouped[key].map(lead => `
              <div class="lead-card" data-lead="${lead.id}">
                <strong>${esc(lead.student_name || lead.adult_name || "Sin nombre")}</strong>
                <small>${esc(lead.adult_name || "")}</small>
                <small>${esc(lead.level_interest || "nivel sin definir")}</small>
                ${lead.ai_interest_level ? `<small>IA: ${esc(lead.ai_interest_level)}</small>` : ""}
                ${lead.next_appointment ? `<small>Visita: ${fmtDate(lead.next_appointment)}</small>` : ""}
                ${lead.next_followup ? `<small>Seguimiento: ${fmtDate(lead.next_followup)}</small>` : ""}
              </div>
            `).join("") || '<div class="empty">Sin candidatos</div>'}
          </section>
        `).join("")}
      </div>
    `;
    wireLeadOpeners();
  } catch (error) {
    handleViewError(error);
  }
}

async function loadAgenda() {
  viewTitle.textContent = "Agenda";
  view.innerHTML = '<div class="empty">Cargando agenda…</div>';
  try {
    const data = await api("/api/crm/appointments");
    const active = data.appointments.filter(a => a.status !== "cancelled");
    const groups = {};
    active.forEach((a) => {
      const date = new Date(a.start_at).toISOString().slice(0,10);
      (groups[date] ||= []).push(a);
    });

    view.innerHTML = Object.keys(groups).length ? Object.entries(groups).map(([date,items]) => `
      <section class="agenda-day">
        <h3>${new Intl.DateTimeFormat("es-UY",{weekday:"long",day:"numeric",month:"long"}).format(new Date(date+"T12:00:00"))}</h3>
        ${items.map(a => `
          <div class="appointment">
            <div class="appointment-time">${new Intl.DateTimeFormat("es-UY",{hour:"2-digit",minute:"2-digit"}).format(new Date(a.start_at))}</div>
            <div data-lead="${a.lead_id}" class="clickable-lead">
              <strong>${esc(a.student_name || "Estudiante")}</strong>
              <div class="muted">${esc(a.adult_name)} · ${esc(a.phone || "")}</div>
              <span class="badge">${esc(a.status)}</span>
            </div>
            <div class="appointment-actions">
              <button class="mini-btn" data-appointment="${a.id}" data-status="confirmed">Confirmar</button>
              <button class="mini-btn success" data-appointment="${a.id}" data-status="completed">Realizada</button>
              <button class="mini-btn warning" data-appointment="${a.id}" data-status="no_show">No asistió</button>
              <button class="mini-btn danger" data-appointment="${a.id}" data-status="cancelled">Cancelar</button>
            </div>
          </div>
        `).join("")}
      </section>
    `).join("") : '<div class="empty">No hay entrevistas en el período.</div>';

    view.querySelectorAll("[data-appointment]").forEach(btn => btn.addEventListener("click", async () => {
      if (!confirm(`Cambiar entrevista a "${btn.dataset.status}"?`)) return;
      try {
        await api("/api/crm/appointments", {
          method:"POST",
          body: JSON.stringify({ id:btn.dataset.appointment, status:btn.dataset.status })
        });
        await loadAgenda();
      } catch (error) { alert(error.message); }
    }));
    view.querySelectorAll(".clickable-lead").forEach(el => el.addEventListener("click", () => openLead(el.dataset.lead)));
  } catch (error) {
    handleViewError(error);
  }
}

async function loadFollowups() {
  viewTitle.textContent = "Seguimientos";
  view.innerHTML = '<div class="empty">Cargando seguimientos…</div>';
  try {
    const data = await api("/api/crm/followups?status=pending");
    const now = new Date();
    view.innerHTML = data.followups.length ? data.followups.map(f => `
      <div class="followup-card ${new Date(f.due_at) < now ? "overdue" : ""}">
        <div>
          <strong>${esc(f.title)}</strong>
          <div class="followup-meta">${esc(f.student_name || f.adult_name)} · ${esc(f.phone || "")} · vence ${fmtDate(f.due_at)}</div>
        </div>
        <div class="inline-actions">
          <button class="mini-btn" data-lead="${f.lead_id}">Abrir ficha</button>
          <button class="mini-btn success" data-followup="${f.id}">Completar</button>
        </div>
      </div>
    `).join("") : '<div class="empty">No hay seguimientos pendientes.</div>';

    wireLeadOpeners();
    view.querySelectorAll("[data-followup]").forEach(btn => btn.addEventListener("click", async () => {
      try {
        await api("/api/crm/followups", { method:"POST", body:JSON.stringify({action:"complete",id:btn.dataset.followup}) });
        await loadFollowups();
      } catch (error) { alert(error.message); }
    }));
  } catch (error) {
    handleViewError(error);
  }
}


async function loadSettings() {
  viewTitle.textContent = "Configuración";
  view.innerHTML = '<div class="empty">Cargando configuración…</div>';

  try {
    const [settingsData, blocksData] = await Promise.all([
      api("/api/crm/settings"),
      api("/api/crm/blocked-slots")
    ]);

    const booking = settingsData.settings.booking || {};
    const followup = settingsData.settings.followup || {};
    const isAdmin = currentManager?.role === "admin";

    view.innerHTML = `
      <div class="detail-grid">
        <section class="section-card">
          <div class="section-head">
            <h2>Agenda de entrevistas</h2>
            <span class="badge">${isAdmin ? "Administrador" : "Solo lectura"}</span>
          </div>

          <div class="form-row">
            <div class="field">
              <label>Hora inicial</label>
              <input id="setting-open" type="number" min="0" max="23" value="${booking.openHour ?? 9}" ${isAdmin ? "" : "disabled"}>
            </div>
            <div class="field">
              <label>Última hora ofrecida</label>
              <input id="setting-close" type="number" min="0" max="23" value="${booking.closeHour ?? 16}" ${isAdmin ? "" : "disabled"}>
            </div>
          </div>

          <div class="form-row">
            <div class="field">
              <label>Duración / intervalo</label>
              <select id="setting-slot" ${isAdmin ? "" : "disabled"}>
                ${[15,20,30,45,60].map(v => `<option value="${v}" ${Number(booking.slotMinutes||30)===v?"selected":""}>${v} minutos</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label>Días mínimos de anticipación</label>
              <input id="setting-min-days" type="number" min="0" max="30" value="${booking.minDaysAhead ?? 1}" ${isAdmin ? "" : "disabled"}>
            </div>
          </div>

          <div class="form-row">
            <div class="field">
              <label>Máximo de días visibles</label>
              <input id="setting-max-days" type="number" min="1" max="180" value="${booking.maxDaysAhead ?? 30}" ${isAdmin ? "" : "disabled"}>
            </div>
            <div class="field">
              <label>Seguimiento luego de entrevista</label>
              <input id="setting-followup-days" type="number" min="0" max="60" value="${followup.daysAfterInterview ?? 2}" ${isAdmin ? "" : "disabled"}>
            </div>
          </div>

          <div class="field">
            <label>Días habilitados</label>
            <div class="inline-actions">
              ${[
                [1,"Lun"],[2,"Mar"],[3,"Mié"],[4,"Jue"],[5,"Vie"],[6,"Sáb"],[7,"Dom"]
              ].map(([v,label]) => `
                <label class="badge">
                  <input class="weekday-checkbox" type="checkbox" value="${v}"
                    ${(booking.weekdays || [1,2,3,4,5]).includes(v) ? "checked" : ""}
                    ${isAdmin ? "" : "disabled"}>
                  ${label}
                </label>
              `).join("")}
            </div>
          </div>

          ${isAdmin ? '<button id="save-settings" class="primary">Guardar configuración</button>' : ""}
        </section>

        <section class="section-card">
          <div class="section-head"><h2>Bloqueos de agenda</h2></div>
          <p class="muted">Usalos para feriados, reuniones internas o cualquier franja que no deba ofrecerse.</p>

          ${isAdmin ? `
            <div class="form-row">
              <div class="field"><label>Desde</label><input id="block-start" type="datetime-local"></div>
              <div class="field"><label>Hasta</label><input id="block-end" type="datetime-local"></div>
            </div>
            <div class="field"><label>Motivo</label><input id="block-reason" placeholder="Ej.: Jornada docente"></div>
            <button id="create-block" class="secondary">Bloquear horario</button>
          ` : ""}

          <div id="block-list" style="margin-top:16px">
            ${blocksData.blocks.length ? blocksData.blocks.map(b => `
              <div class="followup-card">
                <div>
                  <strong>${fmtDate(b.start_at)} → ${fmtDate(b.end_at)}</strong>
                  <div class="followup-meta">${esc(b.reason || "Bloqueo manual")}</div>
                </div>
                ${isAdmin ? `<button class="mini-btn danger" data-block-delete="${b.id}">Eliminar</button>` : ""}
              </div>
            `).join("") : '<div class="empty">No hay bloqueos próximos.</div>'}
          </div>
        </section>
      </div>
    `;

    if (isAdmin) {
      document.getElementById("save-settings").addEventListener("click", async () => {
        const weekdays = [...document.querySelectorAll(".weekday-checkbox:checked")].map(el => Number(el.value));
        try {
          await api("/api/crm/settings", {
            method:"POST",
            body:JSON.stringify({
              booking:{
                openHour:Number(document.getElementById("setting-open").value),
                closeHour:Number(document.getElementById("setting-close").value),
                slotMinutes:Number(document.getElementById("setting-slot").value),
                minDaysAhead:Number(document.getElementById("setting-min-days").value),
                maxDaysAhead:Number(document.getElementById("setting-max-days").value),
                weekdays
              },
              followup:{
                daysAfterInterview:Number(document.getElementById("setting-followup-days").value)
              }
            })
          });
          alert("Configuración guardada.");
          await loadSettings();
        } catch (error) { alert(error.message); }
      });

      document.getElementById("create-block").addEventListener("click", async () => {
        const start = document.getElementById("block-start").value;
        const end = document.getElementById("block-end").value;
        const reason = document.getElementById("block-reason").value;
        if (!start || !end) return alert("Elegí fecha y hora de inicio y fin.");
        try {
          await api("/api/crm/blocked-slots", {
            method:"POST",
            body:JSON.stringify({
              action:"create",
              startAt:new Date(start).toISOString(),
              endAt:new Date(end).toISOString(),
              reason
            })
          });
          await loadSettings();
        } catch (error) { alert(error.message); }
      });

      view.querySelectorAll("[data-block-delete]").forEach(btn => btn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar este bloqueo?")) return;
        try {
          await api("/api/crm/blocked-slots", {
            method:"POST",
            body:JSON.stringify({ action:"delete", id:btn.dataset.blockDelete })
          });
          await loadSettings();
        } catch (error) { alert(error.message); }
      }));
    }
  } catch (error) {
    handleViewError(error);
  }
}

async function loadInquiries() {
  viewTitle.textContent = "Consultas del chat";
  view.innerHTML = '<div class="empty">Cargando conversaciones…</div>';
  try {
    const data = await api("/api/crm/inquiries");
    view.innerHTML = `
      <section class="section-card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Última actividad</th><th>Identificación</th><th>Último mensaje</th><th>Mensajes</th></tr></thead>
            <tbody>
              ${data.inquiries.map(i => `
                <tr ${i.lead_id ? `class="clickable" data-lead="${i.lead_id}"` : ""}>
                  <td>${fmtDate(i.last_message_at)}</td>
                  <td>${esc(i.adult_name || "Consulta anónima")}</td>
                  <td>${esc(i.last_user_message || "—")}</td>
                  <td>${i.message_count}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
    wireLeadOpeners();
  } catch (error) {
    handleViewError(error);
  }
}

function wireLeadOpeners() {
  view.querySelectorAll("[data-lead]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (event.target.closest("[data-followup]")) return;
      openLead(el.dataset.lead);
    });
  });
}

async function openLead(id) {
  try {
    leadModal.hidden = false;
    leadDetail.innerHTML = '<div class="empty">Cargando ficha…</div>';
    const data = await api(`/api/crm/lead?id=${encodeURIComponent(id)}`);
    const l = data.lead;
    const student = data.students[0] || {};
    const conversations = data.conversations.flatMap(c => c.messages || []);

    leadDetail.innerHTML = `
      <p class="eyebrow">Candidato</p>
      <h2>${esc(student.full_name || l.adult_name || "Sin nombre")}</h2>
      <p class="muted">${esc(l.adult_name || "")} · ${esc(l.email || "")} · ${esc(l.phone || "")}</p>

      <div class="detail-grid">
        <div class="detail-box">
          <h3>Datos</h3>
          <p><strong>Nivel:</strong> ${esc(l.level_interest || "Sin definir")}</p>
          <p><strong>Nacimiento:</strong> ${esc(student.birth_date || "—")}</p>
          <p><strong>Institución anterior:</strong> ${esc(student.previous_institution || "—")}</p>
          <p><strong>Comentarios:</strong> ${esc(student.comments || "—")}</p>
          <p><strong>Origen:</strong> ${esc([l.utm_source,l.utm_medium,l.utm_campaign].filter(Boolean).join(" / ") || l.source || "—")}</p>
        </div>

        <div class="detail-box">
          <h3>Lectura IA</h3>
          <p><strong>Interés:</strong> ${esc(l.ai_interest_level || "Sin analizar")}</p>
          <p><strong>Resumen:</strong> ${esc(l.ai_summary || "Todavía no hay análisis interno.")}</p>
          <p><strong>Principal foco:</strong> ${esc(l.ai_primary_concern || "—")}</p>
          <p><strong>Siguiente acción sugerida:</strong> ${esc(l.ai_next_action || "—")}</p>
          <button id="analyze-lead" class="secondary">Analizar con IA</button>
        </div>

        <div class="detail-box">
          <h3>Gestión</h3>
          <div class="field"><label>Estado</label>
            <select id="lead-status">
              ${STAGES.map(([key,label]) => `<option value="${key}" ${key===l.status?"selected":""}>${label}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Próxima acción</label><input id="lead-next-action" type="datetime-local"></div>
          <div class="field"><label>Notas internas</label><textarea id="lead-notes" rows="4">${esc(l.notes || "")}</textarea></div>
          <button id="save-lead" class="primary">Guardar cambios</button>
        </div>

        <div class="detail-box">
          <h3>Entrevistas</h3>
          ${data.appointments.length ? data.appointments.map(a => `<div class="timeline-item">${fmtDate(a.start_at)} · ${esc(a.status)}</div>`).join("") : '<p class="muted">Sin entrevistas.</p>'}
        </div>

        <div class="detail-box">
          <h3>Seguimientos</h3>
          ${data.followups.length ? data.followups.map(f => `<div class="timeline-item">${esc(f.title)} · ${fmtDate(f.due_at)} · ${esc(f.status)}</div>`).join("") : '<p class="muted">Sin seguimientos.</p>'}
          <div class="field"><label>Nuevo seguimiento</label><input id="followup-title" placeholder="Ej.: Llamar para conocer decisión"></div>
          <div class="field"><label>Fecha</label><input id="followup-date" type="datetime-local"></div>
          <button id="create-followup" class="secondary">Agregar seguimiento</button>
        </div>

        <div class="detail-box" style="grid-column:1/-1">
          <h3>Historial de conversación</h3>
          <div class="chat-log">
            ${conversations.length ? conversations.map(m => `
              <div class="chat-line"><strong>${m.role==="user"?"Familia":"Asistente"}:</strong> ${esc(m.content)}</div>
            `).join("") : '<p class="muted">No hay mensajes vinculados.</p>'}
          </div>
        </div>

        <div class="detail-box" style="grid-column:1/-1">
          <h3>Actividad</h3>
          <div class="timeline">
            ${data.activities.length ? data.activities.map(a => `<div class="timeline-item"><strong>${fmtDate(a.created_at)}</strong> · ${esc(a.description)}</div>`).join("") : '<p class="muted">Sin actividad registrada.</p>'}
          </div>
        </div>
      </div>
    `;

    if (l.next_action_at) {
      const d = new Date(l.next_action_at);
      document.getElementById("lead-next-action").value = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
    }

    document.getElementById("analyze-lead").addEventListener("click", async () => {
      const button = document.getElementById("analyze-lead");
      button.disabled = true;
      button.textContent = "Analizando…";
      try {
        await api("/api/crm/analyze-lead", {
          method:"POST",
          body:JSON.stringify({ id:l.id })
        });
        await openLead(l.id);
      } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = "Analizar con IA";
      }
    });

    document.getElementById("save-lead").addEventListener("click", async () => {
      try {
        const next = document.getElementById("lead-next-action").value;
        await api("/api/crm/lead-update", {
          method:"POST",
          body:JSON.stringify({
            id:l.id,
            status:document.getElementById("lead-status").value,
            notes:document.getElementById("lead-notes").value,
            nextActionAt:next ? new Date(next).toISOString() : null
          })
        });
        await loadView();
        leadModal.hidden = true;
      } catch (error) { alert(error.message); }
    });

    document.getElementById("create-followup").addEventListener("click", async () => {
      const title = document.getElementById("followup-title").value.trim();
      const due = document.getElementById("followup-date").value;
      if (!title || !due) return alert("Completá título y fecha.");
      try {
        await api("/api/crm/followups", {
          method:"POST",
          body:JSON.stringify({ action:"create", leadId:l.id, title, dueAt:new Date(due).toISOString() })
        });
        await openLead(l.id);
      } catch (error) { alert(error.message); }
    });
  } catch (error) {
    leadDetail.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  }
}

function handleViewError(error) {
  if (error.status === 401) {
    showLogin();
    return;
  }
  view.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
}

leadSearch.hidden = true;
checkSession();
