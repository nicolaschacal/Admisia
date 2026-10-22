const { query } = require("./db");

let schemaReady;
async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = query(`
      CREATE TABLE IF NOT EXISTS ai_provider_health (
        slot text PRIMARY KEY CHECK (slot IN ('primary','secondary')),
        provider text NOT NULL DEFAULT '',
        model text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown','healthy','error')),
        latency_ms integer,
        last_error text,
        consecutive_failures integer NOT NULL DEFAULT 0,
        failures_window_started_at timestamptz,
        last_success_at timestamptz,
        last_failure_at timestamptz,
        alert_active boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `).catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

async function recordProviderResult({ slot, provider, model, ok, latencyMs = null, error = null }) {
  if (!["primary", "secondary"].includes(slot)) return null;
  await ensureSchema();
  const message = ok ? null : String(error?.message || error || "Error desconocido").slice(0, 240);
  const status = ok ? "healthy" : "error";
  const result = await query(`
    INSERT INTO ai_provider_health (
      slot, provider, model, status, latency_ms, last_error,
      consecutive_failures, failures_window_started_at, last_success_at,
      last_failure_at, alert_active, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      CASE WHEN $7 THEN 0 ELSE 1 END,
      CASE WHEN $7 THEN NULL ELSE now() END,
      CASE WHEN $7 THEN now() ELSE NULL END,
      CASE WHEN $7 THEN NULL ELSE now() END,
      false, now()
    )
    ON CONFLICT (slot) DO UPDATE SET
      provider = EXCLUDED.provider,
      model = EXCLUDED.model,
      status = EXCLUDED.status,
      latency_ms = EXCLUDED.latency_ms,
      last_error = EXCLUDED.last_error,
      consecutive_failures = CASE
        WHEN $7 THEN 0
        WHEN ai_provider_health.last_failure_at >= now() - interval '10 minutes'
          THEN ai_provider_health.consecutive_failures + 1
        ELSE 1
      END,
      failures_window_started_at = CASE
        WHEN $7 THEN NULL
        WHEN ai_provider_health.last_failure_at >= now() - interval '10 minutes'
          THEN COALESCE(ai_provider_health.failures_window_started_at, now())
        ELSE now()
      END,
      last_success_at = CASE WHEN $7 THEN now() ELSE ai_provider_health.last_success_at END,
      last_failure_at = CASE WHEN $7 THEN ai_provider_health.last_failure_at ELSE now() END,
      alert_active = CASE
        WHEN $7 THEN false
        WHEN ai_provider_health.last_failure_at >= now() - interval '10 minutes'
          THEN ai_provider_health.consecutive_failures + 1 >= 3
        ELSE false
      END,
      updated_at = now()
    RETURNING slot, provider, model, status, latency_ms AS "latencyMs",
      last_error AS "lastError", consecutive_failures AS "consecutiveFailures",
      failures_window_started_at AS "failuresWindowStartedAt",
      last_success_at AS "lastSuccessAt", last_failure_at AS "lastFailureAt",
      alert_active AS "alertActive", updated_at AS "updatedAt"
  `, [slot, String(provider || ""), String(model || ""), status, Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : null, message, Boolean(ok)]);
  return result.rows[0] || null;
}

async function getProviderHealth() {
  try {
    await ensureSchema();
    const result = await query(`
      SELECT slot, provider, model, status, latency_ms AS "latencyMs",
        last_error AS "lastError", consecutive_failures AS "consecutiveFailures",
        failures_window_started_at AS "failuresWindowStartedAt",
        last_success_at AS "lastSuccessAt", last_failure_at AS "lastFailureAt",
        alert_active AS "alertActive", updated_at AS "updatedAt"
      FROM ai_provider_health
      ORDER BY CASE slot WHEN 'primary' THEN 0 ELSE 1 END
    `);
    const bySlot = Object.fromEntries(result.rows.map((row) => [row.slot, row]));
    return {
      primary: bySlot.primary || { slot: "primary", status: "unknown", consecutiveFailures: 0, alertActive: false },
      secondary: bySlot.secondary || { slot: "secondary", status: "unknown", consecutiveFailures: 0, alertActive: false }
    };
  } catch (error) {
    console.error("AI health status could not be read:", error?.message || error);
    return {
      primary: { slot: "primary", status: "unknown", consecutiveFailures: 0, alertActive: false },
      secondary: { slot: "secondary", status: "unknown", consecutiveFailures: 0, alertActive: false },
      unavailable: true
    };
  }
}

module.exports = { recordProviderResult, getProviderHealth };
