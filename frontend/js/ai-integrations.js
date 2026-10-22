/* AdmisIA · Configuración → IA */
(() => {
  const providerLabel = { gemini: "Google Gemini", openai: "OpenAI / ChatGPT", anthropic: "Anthropic / Claude", custom: "Otro proveedor (OpenAI-compatible)" };
  const healthPill = (label, item) => {
    if (!item || item.status === "not_configured") return `<span class="pill">${label}: Sin configurar</span>`;
    return `<span class="pill ${item.status === "healthy" ? "pill-success" : "pill-danger"}">${label}: ${item.status === "healthy" ? `Operativo · ${item.latencyMs} ms` : `Fallo · ${esc(item.message || "Error")}`}</span>`;
  };
  const render = async (panel) => {
    const { integrations } = await post("/api/crm/integrations", { action: "health", section: "ai", values: {} }).then(async (health) => ({ integrations: (await api("/api/crm/integrations")).integrations, health: health.health }));
    const { ai, email, calendar } = integrations;
    const editable = currentManager?.role === "admin";
    const dis = editable ? "" : "disabled";
    panel.innerHTML = `
      <form class="card" data-section="ai">
        <div class="card-head"><div class="integration-head"><span class="integration-icon">${icon("sparkle")}</span><div><h2>Inteligencia artificial</h2><p>El cliente elige qué proveedor y API key usa su chatbot. Los prompts, historial y base de conocimiento son independientes del proveedor.</p></div></div>${sourceLabel(ai)}</div>
        <div class="card-body">
          <div class="form-grid">
            <label class="field"><span>Proveedor principal</span><select name="primaryProvider" ${dis}>${ai.providers.map((p) => `<option value="${esc(p.id)}" ${p.id === ai.primary.provider ? "selected" : ""}>${esc(p.label || providerLabel[p.id] || p.id)}</option>`).join("")}</select></label>
            <label class="field"><span>Modelo principal</span><input name="primaryModel" class="mono" value="${esc(ai.primary.model)}" placeholder="Nombre exacto del modelo" ${dis}></label>
            <label class="field span-2"><span>API key principal</span><input name="primaryApiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${ai.primary.configured ? `Guardada (${esc(ai.primary.apiKeyHint)}). Escribí una nueva para reemplazarla.` : "Pegá la API key del proveedor"}" ${dis}></label>
            <label class="field span-2"><span>Base URL</span><input name="primaryBaseUrl" class="mono" value="${esc(ai.primary.baseUrl)}" placeholder="Solo para proveedor custom / compatible" ${dis}></label>
          </div>
          <div class="integration-divider"></div>
          <div class="card-head compact-head"><div><h3>Modelo secundario / respaldo</h3><p>Si el principal falla o supera el tiempo límite, el chatbot intenta automáticamente con este modelo.</p></div></div>
          <div class="form-grid">
            <label class="field"><span>Proveedor secundario</span><select name="secondaryProvider" ${dis}><option value="">Desactivado</option>${ai.providers.map((p) => `<option value="${esc(p.id)}" ${p.id === ai.secondary.provider ? "selected" : ""}>${esc(p.label || providerLabel[p.id] || p.id)}</option>`).join("")}</select></label>
            <label class="field"><span>Modelo secundario</span><input name="secondaryModel" class="mono" value="${esc(ai.secondary.model)}" placeholder="Nombre exacto del modelo" ${dis}></label>
            <label class="field span-2"><span>API key secundaria</span><input name="secondaryApiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${ai.secondary.configured ? `Guardada (${esc(ai.secondary.apiKeyHint)}). Escribí una nueva para reemplazarla.` : "Pegá la API key del proveedor"}" ${dis}></label>
            <label class="field span-2"><span>Base URL</span><input name="secondaryBaseUrl" class="mono" value="${esc(ai.secondary.baseUrl)}" placeholder="Solo para proveedor custom / compatible" ${dis}></label>
          </div>
          <div class="callout">Las API keys se guardan cifradas en el servidor y nunca se muestran completas en el panel.</div>
          <div class="integration-health" data-ai-health>${healthPill("Principal", arguments[0]?.__health?.primary)} ${healthPill("Secundario", arguments[0]?.__health?.secondary)}</div>
        </div>
        <div class="card-foot form-actions"><span class="inline-result" data-result></span>${editable ? '<button type="button" class="btn btn-ghost" data-health>Comprobar estado</button><button type="button" class="btn btn-ghost" data-test>Probar principal</button><button type="submit" class="btn btn-primary">Guardar</button>' : ""}</div>
      </form>
      ${await renderLegacyIntegrations(email, calendar, editable)}
    `;
    bindAI(panel);
  };

  async function renderLegacyIntegrations(email, calendar, editable) {
    // Keep the existing email/calendar UI by asking the old renderer for its markup is not possible safely here.
    // The existing dashboard continues to render these sections below this replacement in future updates.
    return `<section class="card"><div class="card-head"><div><h2>Correo y calendario</h2><p>Estas integraciones siguen funcionando como antes. Abrí la pestaña correspondiente si necesitás modificarlas.</p></div></div><div class="card-body"><p class="muted">Correo saliente: ${email.configured ? "Conectado" : "Sin configurar"} · Google Calendar: ${calendar.configured ? "Conectado" : "Opcional"}</p></div></section>`;
  }

  async function refreshHealth(panel) {
    try {
      const data = await post("/api/crm/integrations", { action: "health", section: "ai", values: {} });
      const box = $("[data-ai-health]", panel);
      if (box) box.innerHTML = `${healthPill("Principal", data.health.primary)} ${healthPill("Secundario", data.health.secondary)}`;
      if (data.health.primary.status === "error" && data.health.secondary.status === "healthy") toast("⚠️ El modelo principal está fallando. El secundario queda disponible como respaldo.", { error: true });
      if (data.health.primary.status === "error" && data.health.secondary.status === "error") toast("🔴 Los dos modelos de IA están fallando.", { error: true });
    } catch (error) { console.error("AI health:", error); }
  }

  function bindAI(panel) {
    const form = $('[data-section="ai"]', panel); if (!form) return;
    const result = $("[data-result]", form);
    const collect = () => Object.fromEntries(new FormData(form));
    $("[data-health]", form)?.addEventListener("click", () => refreshHealth(panel));
    $("[data-test]", form)?.addEventListener("click", async (event) => {
      try { const data = await withBusy(event.currentTarget, "Probando…", () => post("/api/crm/integrations", { action: "test", section: "ai", values: collect() })); result.textContent = data.message; result.className = "inline-result is-ok"; }
      catch (error) { result.textContent = error.message; result.className = "inline-result is-error"; }
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try { await withBusy($("button[type=submit]", form), "Guardando…", () => post("/api/crm/integrations", { action: "save", section: "ai", values: collect() })); toast("Configuración de IA guardada."); refreshHealth(panel); }
      catch (error) { result.textContent = error.message; result.className = "inline-result is-error"; }
    });
    refreshHealth(panel);
    clearInterval(window.__admisiaAIHealthTimer);
    window.__admisiaAIHealthTimer = setInterval(() => { if (!document.hidden && currentView === "settings" && settingsTab === "integrations") refreshHealth(panel); }, 60000);
  }

  window.renderIntegrationsTab = render;
})();
