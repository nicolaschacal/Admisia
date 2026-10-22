const PROVIDER_DEFAULTS = {
  gemini: { label: "Google Gemini", baseUrl: "" },
  openai: { label: "OpenAI / ChatGPT", baseUrl: "https://api.openai.com/v1" },
  anthropic: { label: "Anthropic / Claude", baseUrl: "https://api.anthropic.com" },
  custom: { label: "Otro proveedor (OpenAI-compatible)", baseUrl: "" }
};

function providerError(message, status) { const e = new Error(message); e.status = status; return e; }
async function requestJson(url, options, timeoutMs = 8000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal }); const raw = await response.text(); let data = null;
    try { data = JSON.parse(raw); } catch {}
    if (!response.ok) throw providerError(data?.error?.message || data?.error?.type || `HTTP ${response.status}`, response.status);
    return data;
  } catch (error) {
    if (error?.name === "AbortError") { const e = new Error("El proveedor de IA demoró demasiado en responder."); e.code = "TIMEOUT"; throw e; }
    throw error;
  } finally { clearTimeout(timer); }
}
function messagesFrom(contents) { return (contents || []).map((item) => ({ role: item.role === "model" ? "assistant" : item.role, content: (item.parts || []).map((part) => part.text || "").join("") })); }
async function callAI({ provider, apiKey, model, baseUrl, contents, systemInstruction, timeoutMs = 8000 }) {
  if (!provider || !apiKey || !model) throw new Error("Proveedor, API key y modelo son obligatorios.");
  const p = String(provider).toLowerCase();
  if (p === "gemini") {
    const data = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey, "x-admisia-ai-internal": "1" }, body: JSON.stringify({ system_instruction: { parts: [{ text: systemInstruction }] }, contents, generationConfig: { maxOutputTokens: 500, temperature: 0.45 } }) }, timeoutMs);
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").replace(/\*\*/g, "").trim();
    if (!text) throw providerError("El proveedor respondió sin texto utilizable.", 502); return text;
  }
  if (p === "anthropic") {
    const url = `${String(baseUrl || PROVIDER_DEFAULTS.anthropic.baseUrl).replace(/\/$/, "")}/v1/messages`;
    const data = await requestJson(url, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 500, temperature: 0.45, system: systemInstruction, messages: messagesFrom(contents) }) }, timeoutMs);
    const text = data?.content?.filter((part) => part.type === "text").map((part) => part.text || "").join("").trim();
    if (!text) throw providerError("Anthropic respondió sin texto utilizable.", 502); return text;
  }
  const url = `${String(baseUrl || PROVIDER_DEFAULTS.openai.baseUrl).replace(/\/$/, "")}/chat/completions`;
  const data = await requestJson(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [{ role: "system", content: systemInstruction }, ...messagesFrom(contents)], max_tokens: 500, temperature: 0.45 }) }, timeoutMs);
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw providerError("El proveedor respondió sin texto utilizable.", 502); return text;
}
function isTransientModelError(error) { const status = Number(error?.status); return error?.code === "TIMEOUT" || !Number.isFinite(status) || (status >= 400 && status <= 599); }
async function askWithFallback({ primary, secondary, contents, systemInstruction }) {
  if (!primary?.apiKey) throw new Error("No hay un proveedor principal de IA configurado.");
  const secondaryPromise = secondary?.apiKey && secondary?.provider && secondary?.model ? callAI({ ...secondary, contents, systemInstruction, timeoutMs: 7000 }) : null;
  let done = false;
  const primaryPromise = callAI({ ...primary, contents, systemInstruction, timeoutMs: 7000 }).catch((error) => { if (!isTransientModelError(error) || !secondaryPromise) throw error; return secondaryPromise; });
  const hedge = secondaryPromise ? new Promise((resolve, reject) => setTimeout(() => { if (done) return; secondaryPromise.then(resolve).catch(reject); }, 1200)) : new Promise(() => {});
  try { const result = await Promise.any([primaryPromise, hedge]); done = true; return result; } catch (error) { done = true; const errors = Array.isArray(error?.errors) ? error.errors : []; throw errors[errors.length - 1] || error; }
}
async function healthCheck(config, slot = "primary") {
  const started = Date.now();
  if (!config?.apiKey || !config?.provider || !config?.model) return { status: "not_configured", latencyMs: null, message: "Sin configurar" };
  const { recordProviderResult } = require("./ai-health");
  try {
    await callAI({ ...config, contents: [{ role: "user", parts: [{ text: "Respondé solo: OK" }] }], systemInstruction: "Respondé solo: OK", timeoutMs: 8000 });
    const latencyMs = Date.now() - started;
    await recordProviderResult({ slot, provider: config.provider, model: config.model, ok: true, latencyMs }).catch(() => {});
    return { status: "healthy", latencyMs, message: "Operativo" };
  } catch (error) {
    const latencyMs = Date.now() - started;
    await recordProviderResult({ slot, provider: config.provider, model: config.model, ok: false, latencyMs, error }).catch(() => {});
    return { status: "error", latencyMs, message: String(error?.message || "Error").slice(0, 180), httpStatus: error?.status || null };
  }
}

// Compatibility bridge: the existing chat endpoint still calls Gemini's HTTP shape.
// Intercept only those requests and transparently route them to the provider selected in Configuración.
if (!global.__admisiaAIProviderBridge) {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (!target.includes("generativelanguage.googleapis.com") || options?.headers?.["x-admisia-ai-internal"] === "1") return nativeFetch(url, options);
    let slot = "primary";
    let selected = null;
    const started = Date.now();
    try {
      const { getRuntimeConfig } = require("./config");
      const config = await getRuntimeConfig({ fresh: true });
      const body = JSON.parse(options.body || "{}");
      const match = target.match(/\\/models\\/([^/:?]+):generateContent/);
      const requestedModel = match ? decodeURIComponent(match[1]) : "";
      const secondary = config.ai.secondary;
      const requestedSlot = options?.headers?.["x-admisia-ai-slot"];
      slot = requestedSlot === "secondary" || requestedSlot === "primary"
        ? requestedSlot
        : secondary?.apiKey && secondary?.model && requestedModel === secondary.model ? "secondary" : "primary";
      selected = slot === "secondary" ? secondary : config.ai.primary;
      const contents = body.contents || [];
      const systemInstruction = body.system_instruction?.parts?.map((part) => part.text || "").join("") || "";
      const text = await callAI({ ...selected, contents, systemInstruction, timeoutMs: 7000 });
      await require("./ai-health").recordProviderResult({ slot, provider: selected.provider, model: selected.model, ok: true, latencyMs: Date.now() - started }).catch(() => {});
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200, headers: { "content-type": "application/json" } });
    } catch (error) {
      if (selected) await require("./ai-health").recordProviderResult({ slot, provider: selected.provider, model: selected.model, ok: false, latencyMs: Date.now() - started, error }).catch(() => {});
      return new Response(JSON.stringify({ error: { message: String(error?.message || "Proveedor de IA no disponible") } }), { status: Number(error?.status) || 502, headers: { "content-type": "application/json" } });

    }
  };
  global.__admisiaAIProviderBridge = true;
}

module.exports = { PROVIDER_DEFAULTS, callAI, askWithFallback, healthCheck, isTransientModelError };
