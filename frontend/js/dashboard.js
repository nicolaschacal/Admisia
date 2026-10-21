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
  if (currentView === "knowledge") return loadKnowledge();
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
    const profile = settingsData.settings.profile || {};
    const isAdmin = currentManager?.role === "admin";
    const weekdayOptions = [[1,"Lun"],[2,"Mar"],[3,"Mié"],[4,"Jue"],[5,"Vie"],[6,"Sáb"],[7,"Dom"]];

    view.innerHTML = `
      <div class="detail-grid settings-grid">
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
            <label>Días habilitados para agenda</label>
            <div class="inline-actions">
              ${weekdayOptions.map(([v,label]) => `
                <label class="badge">
                  <input class="weekday-checkbox" type="checkbox" value="${v}"
                    ${(booking.weekdays || [1,2,3,4,5]).includes(v) ? "checked" : ""}
                    ${isAdmin ? "" : "disabled"}>
                  ${label}
                </label>
              `).join("")}
            </div>
          </div>

          ${isAdmin ? '<button id="save-settings" class="primary">Guardar agenda</button>' : ""}
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

        <section class="section-card profile-settings-card">
          <div class="section-head">
            <div>
              <p class="eyebrow">Perfil público</p>
              <h2>Información del Colegio Nubarian</h2>
              <p class="muted profile-settings-intro">Estos datos alimentan el encabezado y la pantalla “Info. de la empresa” del chat. Los cambios se reflejan sin editar código.</p>
            </div>
            <span class="badge">${isAdmin ? "Editable" : "Solo lectura"}</span>
          </div>

          <div class="profile-settings-columns">
            <div class="profile-settings-group">
              <h3>Identidad</h3>
              <div class="form-row">
                <div class="field">
                  <label>Nombre público</label>
                  <input id="profile-name" value="${esc(profile.name || "Colegio Nubarian")}" ${isAdmin ? "" : "disabled"}>
                </div>
                <div class="field">
                  <label>Categoría</label>
                  <input id="profile-category" value="${esc(profile.category || "Educación")}" ${isAdmin ? "" : "disabled"}>
                </div>
              </div>

              <div class="field">
                <label>Descripción corta</label>
                <input id="profile-description" value="${esc(profile.shortDescription || "Colegio Nubarian · Inicial y Primaria")}" ${isAdmin ? "" : "disabled"}>
              </div>

              <div class="field">
                <label>Estado / mensaje comercial</label>
                <input id="profile-status-text" value="${esc(profile.statusText || "Inscripciones abiertas")}" ${isAdmin ? "" : "disabled"}>
              </div>

              <label class="profile-toggle">
                <input id="profile-badge" type="checkbox" ${profile.badgeEnabled !== false ? "checked" : ""} ${isAdmin ? "" : "disabled"}>
                <span>Mostrar badge azul de perfil institucional</span>
              </label>
            </div>

            <div class="profile-settings-group">
              <h3>Ubicación y contacto</h3>
              <div class="form-row">
                <div class="field">
                  <label>Dirección</label>
                  <input id="profile-address-1" value="${esc(profile.addressLine1 || "Av. Agraciada 2850")}" ${isAdmin ? "" : "disabled"}>
                </div>
                <div class="field">
                  <label>Ciudad / país</label>
                  <input id="profile-address-2" value="${esc(profile.addressLine2 || "11800 Montevideo, Uruguay")}" ${isAdmin ? "" : "disabled"}>
                </div>
              </div>

              <div class="field">
                <label>Texto para abrir en mapas</label>
                <input id="profile-map-query" value="${esc(profile.mapQuery || "Av. Agraciada 2850 Montevideo Uruguay")}" ${isAdmin ? "" : "disabled"}>
              </div>

              <div class="form-row">
                <div class="field">
                  <label>Teléfono visible</label>
                  <input id="profile-phone-display" value="${esc(profile.phoneDisplay || "2208 0628")}" ${isAdmin ? "" : "disabled"}>
                </div>
                <div class="field">
                  <label>Teléfono internacional</label>
                  <input id="profile-phone-e164" value="${esc(profile.phoneE164 || "+59822080628")}" placeholder="+598..." ${isAdmin ? "" : "disabled"}>
                </div>
              </div>

              <div class="field">
                <label>Correo</label>
                <input id="profile-email" type="email" value="${esc(profile.email || "nubarian@nubarian.edu.uy")}" ${isAdmin ? "" : "disabled"}>
              </div>
            </div>

            <div class="profile-settings-group">
              <h3>Web y redes</h3>
              <div class="field">
                <label>Sitio web</label>
                <input id="profile-website" type="url" value="${esc(profile.website || "https://nubarian.edu.uy")}" ${isAdmin ? "" : "disabled"}>
              </div>

              <div class="form-row">
                <div class="field">
                  <label>Instagram URL</label>
                  <input id="profile-instagram" type="url" value="${esc(profile.instagram || "")}" ${isAdmin ? "" : "disabled"}>
                </div>
                <div class="field">
                  <label>Instagram visible</label>
                  <input id="profile-instagram-label" value="${esc(profile.instagramLabel || "@colegionubarian")}" ${isAdmin ? "" : "disabled"}>
                </div>
              </div>

              <div class="form-row">
                <div class="field">
                  <label>Facebook URL</label>
                  <input id="profile-facebook" type="url" value="${esc(profile.facebook || "")}" ${isAdmin ? "" : "disabled"}>
                </div>
                <div class="field">
                  <label>Facebook visible</label>
                  <input id="profile-facebook-label" value="${esc(profile.facebookLabel || "Colegio Nubarian")}" ${isAdmin ? "" : "disabled"}>
                </div>
              </div>
            </div>

            <div class="profile-settings-group">
              <h3>Horario público</h3>
              <div class="form-row">
                <div class="field">
                  <label>Abre</label>
                  <input id="profile-open-hour" type="number" min="0" max="23" value="${profile.openHour ?? 8}" ${isAdmin ? "" : "disabled"}>
                </div>
                <div class="field">
                  <label>Cierra</label>
                  <input id="profile-close-hour" type="number" min="1" max="24" value="${profile.closeHour ?? 18}" ${isAdmin ? "" : "disabled"}>
                </div>
              </div>

              <div class="field">
                <label>Días de atención pública</label>
                <div class="inline-actions">
                  ${weekdayOptions.map(([v,label]) => `
                    <label class="badge">
                      <input class="profile-weekday-checkbox" type="checkbox" value="${v}"
                        ${(profile.weekdays || [1,2,3,4,5]).includes(v) ? "checked" : ""}
                        ${isAdmin ? "" : "disabled"}>
                      ${label}
                    </label>
                  `).join("")}
                </div>
              </div>
            </div>
          </div>

          ${isAdmin ? '<div class="profile-settings-actions"><button id="save-profile-settings" class="primary">Guardar perfil público</button><span id="profile-save-status" class="muted"></span></div>' : ""}
        </section>
      </div>
    `;

    if (isAdmin) {
      const collectPayload = () => ({
        booking:{
          openHour:Number(document.getElementById("setting-open").value),
          closeHour:Number(document.getElementById("setting-close").value),
          slotMinutes:Number(document.getElementById("setting-slot").value),
          minDaysAhead:Number(document.getElementById("setting-min-days").value),
          maxDaysAhead:Number(document.getElementById("setting-max-days").value),
          weekdays:[...document.querySelectorAll(".weekday-checkbox:checked")].map(el => Number(el.value))
        },
        followup:{
          daysAfterInterview:Number(document.getElementById("setting-followup-days").value)
        },
        profile:{
          name:document.getElementById("profile-name").value,
          category:document.getElementById("profile-category").value,
          shortDescription:document.getElementById("profile-description").value,
          statusText:document.getElementById("profile-status-text").value,
          badgeEnabled:document.getElementById("profile-badge").checked,
          addressLine1:document.getElementById("profile-address-1").value,
          addressLine2:document.getElementById("profile-address-2").value,
          mapQuery:document.getElementById("profile-map-query").value,
          phoneDisplay:document.getElementById("profile-phone-display").value,
          phoneE164:document.getElementById("profile-phone-e164").value,
          email:document.getElementById("profile-email").value,
          website:document.getElementById("profile-website").value,
          instagram:document.getElementById("profile-instagram").value,
          instagramLabel:document.getElementById("profile-instagram-label").value,
          facebook:document.getElementById("profile-facebook").value,
          facebookLabel:document.getElementById("profile-facebook-label").value,
          openHour:Number(document.getElementById("profile-open-hour").value),
          closeHour:Number(document.getElementById("profile-close-hour").value),
          weekdays:[...document.querySelectorAll(".profile-weekday-checkbox:checked")].map(el => Number(el.value))
        }
      });

      const saveAllSettings = async (sourceButton, successMessage) => {
        const button = sourceButton;
        const original = button?.textContent;
        if (button) {
          button.disabled = true;
          button.textContent = "Guardando…";
        }

        try {
          await api("/api/crm/settings", {
            method:"POST",
            body:JSON.stringify(collectPayload())
          });
          const status = document.getElementById("profile-save-status");
          if (status) status.textContent = successMessage;
          if (!status) alert(successMessage);
          if (button) button.textContent = "Guardado ✓";
          setTimeout(() => {
            if (button) {
              button.disabled = false;
              button.textContent = original;
            }
          }, 1000);
        } catch (error) {
          if (button) {
            button.disabled = false;
            button.textContent = original;
          }
          alert(error.message);
        }
      };

      document.getElementById("save-settings")?.addEventListener("click", (event) => {
        saveAllSettings(event.currentTarget, "Configuración de agenda guardada.");
      });

      document.getElementById("save-profile-settings")?.addEventListener("click", (event) => {
        saveAllSettings(event.currentTarget, "Perfil público actualizado.");
      });

      document.getElementById("create-block")?.addEventListener("click", async () => {
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
        } catch (error) {
          alert(error.message);
        }
      });

      view.querySelectorAll("[data-block-delete]").forEach(btn => btn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar este bloqueo?")) return;
        try {
          await api("/api/crm/blocked-slots", {
            method:"POST",
            body:JSON.stringify({ action:"delete", id:btn.dataset.blockDelete })
          });
          await loadSettings();
        } catch (error) {
          alert(error.message);
        }
      }));
    }
  } catch (error) {
    handleViewError(error);
  }
}


async function loadKnowledge(editId = null) {
  viewTitle.textContent = "Base de conocimiento";
  leadSearch.hidden = true;
  view.innerHTML = '<div class="empty">Cargando información institucional…</div>';

  try {
    const data = await api("/api/crm/knowledge");
    const categories = data.categories || [];
    const items = data.items || [];
    const selected = editId ? items.find((item) => item.id === editId) : null;
    const canEdit = currentManager?.role === "admin";

    view.innerHTML = `
      <div class="knowledge-layout">
        <section class="section-card knowledge-main">
          <div class="section-head">
            <div>
              <p class="eyebrow">Contenido que usa el asistente</p>
              <h2>Base de conocimiento</h2>
              <p class="muted knowledge-intro">El chat recupera únicamente la información relevante para cada consulta y se la entrega al modelo como contexto.</p>
            </div>
            ${canEdit ? '<button id="new-knowledge-item" class="primary">+ Nueva información</button>' : ""}
          </div>

          <div class="knowledge-toolbar">
            <input id="knowledge-search" class="search knowledge-search" placeholder="Buscar contenido, etiqueta o categoría…">
            <select id="knowledge-category-filter" class="knowledge-select">
              <option value="">Todas las categorías</option>
              ${categories.map(cat => `<option value="${cat.id}">${esc(cat.name)} (${cat.item_count})</option>`).join("")}
            </select>
            <select id="knowledge-status-filter" class="knowledge-select">
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="draft">Borrador</option>
              <option value="archived">Archivado</option>
            </select>
          </div>

          <div id="knowledge-list" class="knowledge-list">
            ${items.map(item => `
              <article class="knowledge-card"
                data-kb-item="${item.id}"
                data-category="${item.category_id || ""}"
                data-status="${item.status}"
                data-search="${esc([item.title,item.summary,item.content,item.category_name,(item.tags||[]).join(" ")].filter(Boolean).join(" ").toLowerCase())}">
                <div class="knowledge-card-head">
                  <div>
                    <span class="knowledge-category">${esc(item.category_name || "Sin categoría")}</span>
                    <h3>${esc(item.title)}</h3>
                  </div>
                  <span class="knowledge-status knowledge-status--${item.status}">${item.status === "active" ? "Activo" : item.status === "draft" ? "Borrador" : "Archivado"}</span>
                </div>
                <p>${esc(item.summary || item.content.slice(0,220))}</p>
                ${item.tags?.length ? `<div class="knowledge-tags">${item.tags.map(tag => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}
                <div class="knowledge-card-foot">
                  <span>Actualizado ${fmtDate(item.updated_at)}</span>
                  ${canEdit ? `
                    <div class="inline-actions">
                      <button class="mini-btn" data-kb-edit="${item.id}">Editar</button>
                      <button class="mini-btn ${item.status === "archived" ? "success" : "danger"}" data-kb-toggle="${item.id}" data-kb-status="${item.status}">
                        ${item.status === "archived" ? "Restaurar" : "Archivar"}
                      </button>
                    </div>
                  ` : ""}
                </div>
              </article>
            `).join("") || '<div class="empty">Todavía no hay información cargada.</div>'}
          </div>
        </section>

        <aside class="knowledge-side">
          ${canEdit ? `
            <section class="section-card">
              <div class="section-head">
                <h2>Categorías</h2>
              </div>
              <div class="category-cloud">
                ${categories.map(cat => `
                  <span class="category-chip">
                    ${esc(cat.name)}
                    <small>${cat.item_count}</small>
                  </span>
                `).join("")}
              </div>
              <form id="category-form" class="knowledge-form compact">
                <div class="field">
                  <label>Nueva categoría</label>
                  <input name="name" placeholder="Ej.: Becas y beneficios" required maxlength="160">
                </div>
                <div class="field">
                  <label>Descripción</label>
                  <input name="description" placeholder="Qué tipo de información contiene">
                </div>
                <button type="submit" class="secondary">Agregar categoría</button>
              </form>
            </section>
          ` : ""}

          <section class="section-card knowledge-help">
            <h2>Cómo funciona</h2>
            <p>1. Cargás información clara y actualizada.</p>
            <p>2. AdmisIA busca los fragmentos relacionados con cada consulta.</p>
            <p>3. El LLM recibe solo esos fragmentos y redacta una respuesta natural.</p>
            <p>4. Si archivás o actualizás un dato, el cambio impacta en las respuestas futuras.</p>
          </section>
        </aside>
      </div>

      ${canEdit ? `
        <div id="knowledge-editor-backdrop" class="modal-backdrop" ${selected ? "" : "hidden"}>
          <section class="lead-modal knowledge-editor">
            <button id="close-knowledge-editor" class="modal-close" aria-label="Cerrar">×</button>
            <p class="eyebrow">Base de conocimiento</p>
            <h2>${selected ? "Editar información" : "Nueva información"}</h2>
            <p class="muted">Escribí la información como fuente institucional. El modelo se encargará de redactarla de forma natural para cada familia.</p>

            <form id="knowledge-item-form" class="knowledge-form">
              <input type="hidden" name="id" value="${selected?.id || ""}">
              <div class="form-row">
                <div class="field">
                  <label>Título</label>
                  <input name="title" required maxlength="260" value="${esc(selected?.title || "")}" placeholder="Ej.: Becas para hermanos">
                </div>
                <div class="field">
                  <label>Categoría</label>
                  <select name="categoryId">
                    <option value="">Sin categoría</option>
                    ${categories.map(cat => `<option value="${cat.id}" ${selected?.category_id===cat.id?"selected":""}>${esc(cat.name)}</option>`).join("")}
                  </select>
                </div>
              </div>

              <div class="field">
                <label>Resumen interno</label>
                <input name="summary" maxlength="1200" value="${esc(selected?.summary || "")}" placeholder="Una línea para identificar rápidamente este contenido">
              </div>

              <div class="field">
                <label>Información completa</label>
                <textarea name="content" rows="11" required maxlength="20000" placeholder="Escribí aquí toda la información que el asistente puede utilizar…">${esc(selected?.content || "")}</textarea>
              </div>

              <div class="field">
                <label>Etiquetas <span class="muted">(separadas por coma)</span></label>
                <input name="tags" value="${esc((selected?.tags || []).join(", "))}" placeholder="inicial, nivel 5, inglés, horarios">
              </div>

              <div class="form-row">
                <div class="field">
                  <label>Estado</label>
                  <select name="status">
                    <option value="active" ${!selected || selected.status==="active"?"selected":""}>Activo</option>
                    <option value="draft" ${selected?.status==="draft"?"selected":""}>Borrador</option>
                    <option value="archived" ${selected?.status==="archived"?"selected":""}>Archivado</option>
                  </select>
                </div>
                <div class="field">
                  <label>Prioridad</label>
                  <input name="priority" type="number" min="0" max="1000" value="${selected?.priority ?? 0}">
                </div>
              </div>

              <div class="form-row">
                <div class="field">
                  <label>Válido desde <span class="muted">(opcional)</span></label>
                  <input name="validFrom" type="date" value="${selected?.valid_from ? String(selected.valid_from).slice(0,10) : ""}">
                </div>
                <div class="field">
                  <label>Válido hasta <span class="muted">(opcional)</span></label>
                  <input name="validUntil" type="date" value="${selected?.valid_until ? String(selected.valid_until).slice(0,10) : ""}">
                </div>
              </div>

              <button type="submit" class="primary">Guardar información</button>
            </form>
          </section>
        </div>
      ` : ""}
    `;

    const filterKnowledge = () => {
      const q = (document.getElementById("knowledge-search")?.value || "").trim().toLowerCase();
      const category = document.getElementById("knowledge-category-filter")?.value || "";
      const status = document.getElementById("knowledge-status-filter")?.value || "";

      view.querySelectorAll("[data-kb-item]").forEach(card => {
        const matchesText = !q || card.dataset.search.includes(q);
        const matchesCategory = !category || card.dataset.category === category;
        const matchesStatus = !status || card.dataset.status === status;
        card.hidden = !(matchesText && matchesCategory && matchesStatus);
      });
    };

    document.getElementById("knowledge-search")?.addEventListener("input", filterKnowledge);
    document.getElementById("knowledge-category-filter")?.addEventListener("change", filterKnowledge);
    document.getElementById("knowledge-status-filter")?.addEventListener("change", filterKnowledge);

    if (!canEdit) return;

    const openEditor = (id = null) => loadKnowledge(id);

    document.getElementById("new-knowledge-item")?.addEventListener("click", () => {
      const backdrop = document.getElementById("knowledge-editor-backdrop");
      backdrop.hidden = false;
    });

    document.getElementById("close-knowledge-editor")?.addEventListener("click", () => {
      document.getElementById("knowledge-editor-backdrop").hidden = true;
    });

    document.getElementById("knowledge-editor-backdrop")?.addEventListener("click", (event) => {
      if (event.target.id === "knowledge-editor-backdrop") event.currentTarget.hidden = true;
    });

    view.querySelectorAll("[data-kb-edit]").forEach(btn => {
      btn.addEventListener("click", () => openEditor(btn.dataset.kbEdit));
    });

    view.querySelectorAll("[data-kb-toggle]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const archived = btn.dataset.kbStatus === "archived";
        try {
          await api("/api/crm/knowledge", {
            method:"POST",
            body:JSON.stringify({
              action: archived ? "restore-item" : "archive-item",
              id: btn.dataset.kbToggle
            })
          });
          await loadKnowledge();
        } catch (error) {
          alert(error.message);
        }
      });
    });

    document.getElementById("category-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        await api("/api/crm/knowledge", {
          method:"POST",
          body:JSON.stringify({ action:"save-category", ...payload })
        });
        await loadKnowledge();
      } catch (error) {
        alert(error.message);
      }
    });

    document.getElementById("knowledge-item-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = "Guardando…";

      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        await api("/api/crm/knowledge", {
          method:"POST",
          body:JSON.stringify({
            action:"save-item",
            ...payload,
            priority:Number(payload.priority || 0)
          })
        });
        await loadKnowledge();
      } catch (error) {
        submit.disabled = false;
        submit.textContent = "Guardar información";
        alert(error.message);
      }
    });
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
