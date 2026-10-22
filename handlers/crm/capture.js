const { query } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");
const { DEFAULT_CAPTURE, getCaptureSettings, getBrochureMeta, ensureCaptureSchema } = require("../../lib/capture");

const MAX_PDF_BYTES = 3 * 1024 * 1024;

function cleanUrl(value) {
  const raw = String(value ?? "").trim().slice(0, 1200);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

async function upsert(key, value) {
  await query(
    `INSERT INTO crm_settings(key,value,updated_at) VALUES ($1,$2::jsonb,now())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
    [key, JSON.stringify(value)]
  );
}

module.exports = async (req, res) => {
  const manager = requireManager(req, res);
  if (!manager) return;

  try {
    await ensureCaptureSchema();

    if (req.method === "GET") {
      const [capture, brochure] = await Promise.all([getCaptureSettings(), getBrochureMeta()]);
      return res.status(200).json({ success: true, capture, brochure });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Método no permitido." });
    }
    if (manager.role !== "admin") {
      return res.status(403).json({ success: false, message: "Solo un administrador puede cambiar esta configuración." });
    }

    const action = String(req.body?.action || "save");

    if (action === "upload-brochure") {
      const name = String(req.body?.name || "folleto.pdf").trim().slice(0, 160) || "folleto.pdf";
      const raw = String(req.body?.data || "").replace(/^data:application\/pdf;base64,/, "");
      if (!/^[A-Za-z0-9+/=]+$/.test(raw)) {
        return res.status(400).json({ success: false, message: "El archivo no es un PDF válido." });
      }
      const buffer = Buffer.from(raw, "base64");
      if (buffer.subarray(0, 5).toString() !== "%PDF-") {
        return res.status(400).json({ success: false, message: "El archivo no es un PDF válido." });
      }
      if (buffer.length > MAX_PDF_BYTES) {
        return res.status(400).json({ success: false, message: "El folleto puede pesar hasta 3 MB." });
      }
      await upsert("brochure", { name, size: buffer.length, data: raw, updatedAt: new Date().toISOString() });
      return res.status(200).json({ success: true, brochure: await getBrochureMeta() });
    }

    if (action === "delete-brochure") {
      await query("DELETE FROM crm_settings WHERE key='brochure'");
      return res.status(200).json({ success: true });
    }

    const body = req.body?.capture || {};
    const brochureUrl = cleanUrl(body.brochureUrl);
    if (body.brochureUrl && !brochureUrl) {
      return res.status(400).json({ success: false, message: "El enlace del folleto no es válido." });
    }
    const value = {
      ...DEFAULT_CAPTURE,
      contactOffer: body.contactOffer !== false,
      vacancyAlerts: body.vacancyAlerts !== false,
      vacancyText: String(body.vacancyText ?? "").trim().slice(0, 400),
      brochure: body.brochure !== false,
      brochureUrl,
      callback: body.callback !== false,
      autoDetect: body.autoDetect !== false
    };
    await upsert("capture", value);
    return res.status(200).json({ success: true, capture: value });
  } catch (error) {
    console.error("CRM capture settings error:", error);
    return res.status(500).json({ success: false, message: "No se pudo guardar la configuración de captación." });
  }
};
