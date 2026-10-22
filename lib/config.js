// Runtime configuration for integrations (AI, email, calendar).
const crypto = require("crypto");
const { query } = require("./db");
require("./ai");

const SETTINGS_KEY = "integrations";
const CACHE_MS = 30 * 1000;
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_PROVIDER = "gemini";

const SECRET_FIELDS = { ai: ["apiKey", "primaryApiKey", "secondaryApiKey"], email: ["password"], calendar: ["serviceAccountJson"] };
let cache = null; let cacheAt = 0;
function encryptionKey() { const base = process.env.SETTINGS_ENCRYPTION_KEY || process.env.CRM_JWT_SECRET; if (!base) throw new Error("Falta SETTINGS_ENCRYPTION_KEY o CRM_JWT_SECRET para cifrar credenciales."); return crypto.createHash("sha256").update(String(base)).digest(); }
function encrypt(plain) { if (!plain) return ""; const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv); const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]); const tag = cipher.getAuthTag(); return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`; }
function decrypt(payload) { if (!payload || typeof payload !== "string" || !payload.startsWith("v1:")) return ""; try { const [, iv, tag, data] = payload.split(":"); const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64")); decipher.setAuthTag(Buffer.from(tag, "base64")); return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8"); } catch { return ""; } }
async function readStored() { try { const result = await query("SELECT value FROM crm_settings WHERE key=$1 LIMIT 1", [SETTINGS_KEY]); const value = result.rows[0]?.value || {}; return { ai: value.ai || {}, email: value.email || {}, calendar: value.calendar || {} }; } catch { return { ai: {}, email: {}, calendar: {} }; } }
async function writeStored(stored) { await query(`INSERT INTO crm_settings(key,value,updated_at) VALUES ($1,$2::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`, [SETTINGS_KEY, JSON.stringify(stored)]); invalidateConfig(); }
function pick(panelValue, envValue, fallback = "") { if (panelValue !== undefined && panelValue !== null && panelValue !== "") return { value: panelValue, source: "panel" }; if (envValue !== undefined && envValue !== null && envValue !== "") return { value: envValue, source: "env" }; return { value: fallback, source: fallback === "" ? "none" : "default" }; }
function bool(value) { if (typeof value === "boolean") return value; return String(value || "").toLowerCase() === "true"; }
async function buildConfig() {
  const stored = await readStored(); const env = process.env;
  const legacyKey = decrypt(stored.ai.apiKey); const primaryKey = decrypt(stored.ai.primaryApiKey) || legacyKey; const secondaryKey = decrypt(stored.ai.secondaryApiKey);
  const primary = stored.ai.primary || {}; const secondary = stored.ai.secondary || {};

  // Preserve the existing Gemini environment configuration when the new
  // multi-provider panel has no provider saved yet. The presence of the
  // environment key is enough to infer Gemini; never require the old panel
  // key to be present just to determine the provider.
  const primaryProvider = primary.provider || ((primaryKey || env.GEMINI_API_KEY) ? DEFAULT_PROVIDER : "");
  const secondaryProvider = secondary.provider || (stored.ai.fallbackModel ? DEFAULT_PROVIDER : "");

  const primaryKeyPick = pick(primaryKey, env.GEMINI_API_KEY); const secondaryKeyPick = pick(secondaryKey, "");
  const primaryModel = primary.model || stored.ai.model || env.GEMINI_MODEL || (primaryProvider === "gemini" ? DEFAULT_MODEL : "");
  const secondaryModel = secondary.model || stored.ai.fallbackModel || env.GEMINI_FALLBACK_MODEL || (secondaryProvider === "gemini" ? DEFAULT_FALLBACK_MODEL : "");
  const primaryBaseUrl = primary.baseUrl || (primaryProvider === "openai" ? "https://api.openai.com/v1" : primaryProvider === "anthropic" ? "https://api.anthropic.com" : "");
  const secondaryBaseUrl = secondary.baseUrl || (secondaryProvider === "openai" ? "https://api.openai.com/v1" : secondaryProvider === "anthropic" ? "https://api.anthropic.com" : "");
  const smtpHost = pick(stored.email.host, env.SMTP_HOST); const smtpPassword = pick(decrypt(stored.email.password), env.SMTP_PASSWORD); const calendarId = pick(stored.calendar.calendarId, env.GOOGLE_CALENDAR_ID); const calendarJson = pick(decrypt(stored.calendar.serviceAccountJson), env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return {
    ai: { primary: { provider: primaryProvider, apiKey: primaryKeyPick.value, model: primaryModel, baseUrl: primaryBaseUrl }, secondary: { provider: secondaryProvider, apiKey: secondaryKeyPick.value, model: secondaryModel, baseUrl: secondaryBaseUrl }, apiKey: primaryKeyPick.value, model: primaryModel, fallbackModel: secondaryModel, sources: { apiKey: primaryKeyPick.source, primaryApiKey: primaryKeyPick.source, secondaryApiKey: secondaryKeyPick.source } },
    email: { host: smtpHost.value, port: Number(stored.email.port || env.SMTP_PORT || 587), secure: stored.email.secure !== undefined ? bool(stored.email.secure) : bool(env.SMTP_SECURE), user: stored.email.user || env.SMTP_USER || "", password: smtpPassword.value, from: stored.email.from || env.SMTP_FROM || stored.email.user || env.SMTP_USER || "", notifyTo: stored.email.notifyTo || env.ADMISSIONS_EMAIL || "", sources: { host: smtpHost.source, password: smtpPassword.source } },
    calendar: { calendarId: calendarId.value, serviceAccountJson: calendarJson.value, sources: { calendarId: calendarId.source, serviceAccountJson: calendarJson.source } }
  };
}
async function getRuntimeConfig({ fresh = false } = {}) { if (!fresh && cache && Date.now() - cacheAt < CACHE_MS) return cache; cache = await buildConfig(); cacheAt = Date.now(); return cache; }
function invalidateConfig() { cache = null; cacheAt = 0; }
module.exports = { SECRET_FIELDS, DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL, DEFAULT_PROVIDER, encrypt, decrypt, readStored, writeStored, getRuntimeConfig, invalidateConfig };