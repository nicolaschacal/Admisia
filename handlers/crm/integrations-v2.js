const { query } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");
const { DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL, encrypt, readStored, writeStored, getRuntimeConfig } = require("../../lib/config");
const { PROVIDER_DEFAULTS, healthCheck } = require("../../lib/ai");
const { getProviderHealth } = require("../../lib/ai-health");
const legacy = require("./integrations");

const PROVIDERS = ["gemini", "openai", "anthropic", "custom"];
const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const hint = (secret) => !secret ? "" : String(secret).length > 8 ? `••••${String(secret).slice(-4)}` : "••••";

async function view() {
  const config = await getRuntimeConfig({ fresh: true });
  const p = config.ai.primary;
  const s = config.ai.secondary;
  const health = await getProviderHealth();
  return {
    ai: {
      configured: Boolean(p.apiKey && p.provider && p.model),
      source: config.ai.sources.primaryApiKey,
      apiKeyHint: hint(p.apiKey), model: p.model, fallbackModel: s.model,
      primary: { provider: p.provider, model: p.model, baseUrl: p.baseUrl, apiKeyHint: hint(p.apiKey), configured: Boolean(p.apiKey && p.provider && p.model) },
      secondary: { provider: s.provider, model: s.model, baseUrl: s.baseUrl, apiKeyHint: hint(s.apiKey), configured: Boolean(s.apiKey && s.provider && s.model) },
      providers: PROVIDERS.map((id) => ({ id, label: PROVIDER_DEFAULTS[id].label })),
      defaults: { model: DEFAULT_MODEL, fallbackModel: DEFAULT_FALLBACK_MODEL },
      health
    },
    email: {
      configured: Boolean(config.email.host && config.email.user && config.email.password), source: config.email.sources.host,
      host: config.email.host, port: config.email.port, secure: config.email.secure, user: config.email.user,
      passwordHint: config.email.password ? "••••••••" : "", from: config.email.from, notifyTo: config.email.notifyTo
    },
    calendar: {
      configured: Boolean(config.calendar.calendarId && config.calendar.serviceAccountJson), source: config.calendar.sources.calendarId,
      calendarId: config.calendar.calendarId, serviceAccountEmail: (() => { try { return JSON.parse(config.calendar.serviceAccountJson || "{}").client_email || ""; } catch { return ""; } })(),
      hasCredentials: Boolean(config.calendar.serviceAccountJson)
    }
  };
}

function sanitizeAI(values, current) {
  const next = { ...current };
  const provider = (v) => PROVIDERS.includes(String(v || "")) ? String(v) : "";
  const primary = { ...(current.primary || {}) };
  const secondary = { ...(current.secondary || {}) };
  primary.provider = provider(values.primaryProvider) || primary.provider || "";
  secondary.provider = provider(values.secondaryProvider) || secondary.provider || "";
  primary.model = clean(values.primaryModel, 120);
  secondary.model = clean(values.secondaryModel, 120);
  primary.baseUrl = clean(values.primaryBaseUrl, 300).replace(/\/$/, "");
  secondary.baseUrl = clean(values.secondaryBaseUrl, 300).replace(/\/$/, "");
  next.primary = primary; next.secondary = secondary;
  if (values.primaryApiKey) next.primaryApiKey = encrypt(clean(values.primaryApiKey, 400));
  if (values.secondaryApiKey) next.secondaryApiKey = encrypt(clean(values.secondaryApiKey, 400));
  if (values.clearPrimaryApiKey) delete next.primaryApiKey;
  if (values.clearSecondaryApiKey) delete next.secondaryApiKey;
  delete next.apiKey; delete next.model; delete next.fallbackModel;
  return next;
}

async function testAI(values) {
  const config = await getRuntimeConfig({ fresh: true });
  const primary = {
    provider: clean(values.primaryProvider, 40) || config.ai.primary.provider,
    apiKey: clean(values.primaryApiKey, 400) || config.ai.primary.apiKey,
    model: clean(values.primaryModel, 120) || config.ai.primary.model,
    baseUrl: clean(values.primaryBaseUrl, 300) || config.ai.primary.baseUrl
  };
  if (!primary.apiKey || !primary.provider || !primary.model) throw new Error("Completá proveedor, API key y modelo principal.");
  const result = await healthCheck(primary);
  if (result.status !== "healthy") throw new Error(`No se pudo conectar con ${primary.provider}: ${result.message}`);
  return `Conexión correcta con ${primary.provider} · ${primary.model} (${result.latencyMs} ms).`;
}

module.exports = async (req, res) => {
  const manager = requireManager(req, res);
  if (!manager) return;
  const action = clean(req.body?.action || req.query?.action, 20);
  const section = clean(req.body?.section, 20);
  if (req.method !== "GET" && section && section !== "ai") return legacy(req, res);
  if (req.method === "GET") {
    try {
      const integrations = await view();
      const safeCount = async (sql) => { try { const r = await query(sql); return Number(r.rows[0]?.count || 0); } catch { return null; } };
      const [managers, knowledge, profileRow] = await Promise.all([
        safeCount("SELECT count(*) FROM managers WHERE active"), safeCount("SELECT count(*) FROM knowledge_items WHERE status='active'"),
        query("SELECT value FROM crm_settings WHERE key='profile'").then((r) => r.rows[0]?.value || null).catch(() => null)
      ]);
      const profileCustomized = Boolean(profileRow && profileRow.name && (profileRow.addressLine1 || profileRow.phoneDisplay) && profileRow.email);
      const checklist = [
        { id: "database", label: "Base de datos conectada", done: managers !== null, required: true, target: null },
        { id: "profile", label: "Datos del negocio completos", done: profileCustomized, required: true, target: "business" },
        { id: "ai", label: "Clave de IA configurada", done: integrations.ai.configured, required: true, target: "integrations" },
        { id: "email", label: "Correo saliente configurado", done: integrations.email.configured, required: true, target: "integrations" },
        { id: "knowledge", label: "Información cargada para el asistente", done: (knowledge || 0) > 0, required: true, target: "knowledge" },
        { id: "team", label: "Equipo con acceso al panel", done: (managers || 0) > 1, required: false, target: "team" },
        { id: "calendar", label: "Google Calendar conectado", done: integrations.calendar.configured, required: false, target: "integrations" }
      ];
      return res.status(200).json({ success: true, integrations, checklist, isAdmin: manager.role === "admin" });
    } catch { return res.status(500).json({ success: false, message: "No se pudo cargar la configuración de integraciones." }); }
  }
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Método no permitido." });
  if (manager.role !== "admin") return res.status(403).json({ success: false, message: "Solo un administrador puede cambiar las integraciones." });
  try {
    if (action === "health") {
      const config = await getRuntimeConfig({ fresh: true });
      const [primary, secondary] = await Promise.all([healthCheck(config.ai.primary, "primary"), healthCheck(config.ai.secondary, "secondary")]);
      const history = await getProviderHealth();
      return res.status(200).json({ success: true, health: { primary, secondary }, history, checkedAt: new Date().toISOString() });
    }
    if (section !== "ai") return res.status(400).json({ success: false, message: "Sección desconocida." });
    if (action === "test") return res.status(200).json({ success: true, message: await testAI(req.body?.values || {}) });
    if (action === "save") {
      const stored = await readStored(); stored.ai = sanitizeAI(req.body?.values || {}, stored.ai || {}); await writeStored(stored);
      return res.status(200).json({ success: true, integrations: await view(), message: "Configuración de IA guardada." });
    }
    return res.status(400).json({ success: false, message: "Acción desconocida." });
  } catch (error) {
    console.error("AI integrations error:", error);
    return res.status(400).json({ success: false, message: String(error?.message || "No se pudo completar la acción.").slice(0, 300) });
  }
};
