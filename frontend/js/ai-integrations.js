(() => {
  const original = window.renderIntegrationsTab;
  const healthPill = (label, item) => {
    if (!item || item.status === "not_configured") return `<span class="pill">${label}: Sin configurar</span>`;
    if (item.status === "unknown") return `<span class="pill">${label}: Sin comprobación reciente</span>`;
    return `<span class="pill ${item.status === "healthy" ? "pill-success" : "pill-danger"}">${label}: ${item.status === "healthy" ? `Operativo · ${item.latencyMs ?? "—"} ms` : `Fallo · ${esc(item.message || item.lastError || "Error")}`}</span>`;
  };
  const providerLabel = { gemini: "Google Gemini", openai: "OpenAI / ChatGPT", anthropic: "Anthropic / Claude", custom: "Otro proveedor (OpenAI-compatible)" };

  function renderHealth(panel, liveHealth, history = {}) {
    const box = $("[data-ai-health]", panel);
    const primary = history.primary || liveHealth?.primary;
    const secondary = history.secondary || liveHealth?.secondary;
    if (box) box.innerHTML = `${healthPill("Principal", primary)} ${healthPill("Secundario", secondary)}`;
    const alert = $("[data-ai-alert]", panel);
    const active = [history.primary, history.secondary].filter((item) => item?.alertActive);
    if (!alert) return;
    if (active.length) {
      alert.hidden = false;
      alert.innerHTML = active.map((item) => {
        const label = item.slot === "primary" ? "modelo principal" : "modelo secundario";
        return `<strong>Alerta: ${label} con fallos consecutivos.</strong> Se registraron ${Number(item.consecutiveFailures || 0)} fallos consecutivos en una ventana de 10 minutos. Último error: ${esc(item.lastError || "Error no especificado")}.`;
      }).join("<br>");
      alert.classList.add("is-error");
      return;
    }
    alert.hidden = true;
    alert.classList.remove("is-error");
    const errors = [history.primary, history.secondary].filter((item) => item?.status === "error");
    if (errors.length) {
      alert.hidden = false;
      alert.textContent = "Se detectó un fallo reciente, pero todavía no alcanza el umbral de 3 fallos consecutivos en 10 minutos. El estado se actualizará con las próximas solicitudes o al volver a comprobar.";
    }
  }

  async function loadHealth(panel) {
    try {
      const data = await api("/api/crm/integrations");
      renderHealth(panel, null, data.integrations.ai.health || {});
    } catch (error) { console.error("AI health status:", error); }
  }

  async function health(panel) {
    try {
      const data = await post("/api/crm/integrations", { action: "health", section: "ai", values: {} });
      renderHealth(panel, data.health, data.history || {});
    } catch (error) { console.error("AI health check:", error); }
  }

  async function renderAI(panel, oldForm) {
    const ai = (await api("/api/crm/integrations")).integrations.ai;
    const editable = currentManager?.role === "admin";
    const dis = editable ? "" : "disabled";
    const form = document.createElement("form"); form.className = "card"; form.dataset.section = "ai";
    form.innerHTML = `
      <div class="card-head"><div class="integration-head"><span class="integration-icon">${icon("sparkle")}</span><div><h2>Inteligencia artificial</h2><p>Elegí el proveedor y la API key que utilizará este chatbot. Los prompts y la base de conocimiento son independientes del proveedor.</p></div></div>${sourceLabel(ai)}</div>
      <div class="card-body">
        <div class="form-grid">
          <label class="field"><span>Proveedor principal</span><select name="primaryProvider" ${dis}>${ai.providers.map((p) => `<option value="${esc(p.id)}" ${p.id === ai.primary.provider ? "selected" : ""}>${esc(p.label || providerLabel[p.id] || p.id)}</option>`).join("")}</select></label>
          <label class="field"><span>Modelo principal</span><input name="primaryModel" class="mono" value="${esc(ai.primary.model)}" placeholder="Nombre exacto del modelo" ${dis}></label>
          <label class="field span-2"><span>API key principal</span><input name="primaryApiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${ai.primary.configured ? `Guardada (${esc(ai.primary.apiKeyHint)}). Escribí una nueva para reemplazarla.` : "Pegá la API key del proveedor"}" ${dis}></label>
          <label class="field span-2"><span>Base URL</span><input name="primaryBaseUrl" class="mono" value="${esc(ai.primary.baseUrl)}" placeholder="Solo para proveedor custom / compatible" ${dis}></label>
        </div>
        <div class="integration-divider"></div>
        <div class="card-head compact-head"><div><h3>Modelo secundario / respaldo</h3><p>Se usa automáticamente si el principal falla o tarda demasiado.</p></div></div>
        <div class="form-grid">
          <label class="field"><span>Proveedor secundario</span><select name="secondaryProvider" ${dis}><option value="">Desactivado</option>${ai.providers.map((p) => `<option value="${esc(p.id)}" ${p.id === ai.secondary.provider ? "selected" : ""}>${esc(p.label || providerLabel[p.id] || p.id)}</option>`).join("")}</select></label>
          <label class="field"><span>Modelo secundario</span><input name="secondaryModel" class="mono" value="${esc(ai.secondary.model)}" placeholder="Nombre exacto del modelo" ${dis}></label>
          <label class="field span-2"><span>API key secundaria</span><input name="secondaryApiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${ai.secondary.configured ? `Guardada (${esc(ai.secondary.apiKeyHint)}). Escribí una nueva para reemplazarla.` : "Pegá la API key del proveedor"}" ${dis}></label>
          <label class="field span-2"><span>Base URL</span><input name="secondaryBaseUrl" class="mono" value="${esc(ai.secondary.baseUrl)}" placeholder="Solo para proveedor custom / compatible" ${dis}></label>
        </div>
        <div class="callout">Las API keys se guardan cifradas en el servidor y nunca se muestran completas en el panel.</div>
        <div class="integration-health" data-ai-health><span class="pill pill-warning">Comprobando estado…</span></div>
        <div class="callout integration-alert" data-ai-alert hidden role="status"></div>
      </div>
      <div class="card-foot form-actions"><span class="inline-result" data-result></span>${editable ? '<button type="button" class="btn btn-ghost" data-health>Comprobar estado</button><button type="button" class="btn btn-ghost" data-test>Probar principal</button><button type="submit" class="btn btn-primary">Guardar</button>' : ""}</div>`;
    oldForm.replaceWith(form);
    const result = $("[data-result]", form); const collect = () => Object.fromEntries(new FormData(form));
    $("[data-health]", form)?.addEventListener("click", () => health(form));
    $("[data-test]", form)?.addEventListener("click", async (event) => { try { const data = await withBusy(event.currentTarget, "Probando…", () => post("/api/crm/integrations", { action: "test", section: "ai", values: collect() })); result.textContent = data.message; result.className = "inline-result is-ok"; } catch (error) { result.textContent = error.message; result.className = "inline-result is-error"; } });
    form.addEventListener("submit", async (event) => { event.preventDefault(); try { await withBusy($("button[type=submit]", form), "Guardando…", () => post("/api/crm/integrations", { action: "save", section: "ai", values: collect() })); toast("Configuración de IA guardada."); await loadHealth(form); refreshBadges(); } catch (error) { result.textContent = error.message; result.className = "inline-result is-error"; } });
    loadHealth(form);
  }

  window.renderIntegrationsTab = async (panel) => { if (typeof original === "function") await original(panel); const oldForm = $('[data-section="ai"]', panel); if (oldForm) await renderAI(panel, oldForm); };
})();
