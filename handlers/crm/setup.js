// First-run setup: lets the buyer create the first administrator from the
// login screen. Only works while the managers table is empty, so it can't be
// used to take over an installation that is already set up.

const bcrypt = require("bcryptjs");
const { query, withTransaction } = require("../../lib/db");
const { createSessionToken, setSessionCookie } = require("../../lib/auth");
const { normalizeType } = require("../../lib/business-types");

const CATEGORY = { school: "Educación", health: "Salud", beauty: "Estética y bienestar", other: "Servicios" };

async function needsSetup() {
  const result = await query("SELECT count(*) FROM managers");
  return Number(result.rows[0].count) === 0;
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      return res.status(200).json({ success: true, needsSetup: await needsSetup() });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Método no permitido." });
    }

    const name = String(req.body?.name || "").trim().slice(0, 160);
    const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 240);
    const password = String(req.body?.password || "");
    const businessName = String(req.body?.businessName || "").trim().slice(0, 160);
    const businessType = normalizeType(req.body?.businessType);

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Ingresá tu nombre y un correo válido." });
    }
    if (password.length < 10) {
      return res.status(400).json({ success: false, message: "La contraseña debe tener al menos 10 caracteres." });
    }

    const hash = await bcrypt.hash(password, 12);
    const manager = await withTransaction(async (client) => {
      await client.query("LOCK TABLE managers IN EXCLUSIVE MODE");
      const count = await client.query("SELECT count(*) FROM managers");
      if (Number(count.rows[0].count) > 0) return null;

      const created = await client.query(
        `INSERT INTO managers (email,password_hash,full_name,role,active)
         VALUES ($1,$2,$3,'admin',true)
         RETURNING id,email,full_name,role`,
        [email, hash, name]
      );

      if (businessName) {
        // Fresh install: start from a clean public profile with the
        // institution's name. Any active content left from a previous setup is
        // archived; the bundled templates stay as drafts to fill in.
        const profile = {
          businessType, name: businessName, category: CATEGORY[businessType], shortDescription: "", statusText: "",
          addressLine1: "", addressLine2: "", mapQuery: "", phoneDisplay: "", phoneE164: "",
          email, website: "", instagram: "", instagramLabel: "", facebook: "", facebookLabel: "",
          openHour: 8, closeHour: 18, weekdays: [1, 2, 3, 4, 5], badgeEnabled: true
        };
        await client.query(
          `INSERT INTO crm_settings(key,value,updated_at) VALUES ('profile',$1::jsonb,now())
           ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
          [JSON.stringify(profile)]
        );
        await client.query("UPDATE knowledge_items SET status='archived', updated_at=now() WHERE status='active'");
        // The bundled drafts are written for schools; other businesses start empty.
        if (businessType !== "school") {
          await client.query("UPDATE knowledge_items SET status='archived', updated_at=now() WHERE status='draft'");
        }
      }
      return created.rows[0];
    });

    if (!manager) {
      return res.status(409).json({ success: false, message: "La instalación ya tiene un administrador. Iniciá sesión." });
    }

    setSessionCookie(res, createSessionToken(manager));
    return res.status(200).json({
      success: true,
      manager: { id: manager.id, email: manager.email, name: manager.full_name, role: manager.role }
    });
  } catch (error) {
    console.error("Setup error:", error);
    return res.status(500).json({ success: false, message: "No se pudo completar la configuración inicial. Revisá la conexión a la base de datos." });
  }
};
