const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { query } = require("../../lib/db");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }

  if (process.env.VERCEL_ENV !== "preview") {
    return res.status(404).json({ success: false, message: "No disponible." });
  }

  try {
    const email = "admin@admisia.local";
    const password = crypto.randomBytes(15).toString("base64url");
    const hash = await bcrypt.hash(password, 12);

    await query(
      `INSERT INTO managers (email,password_hash,full_name,role,active)
       VALUES ($1,$2,$3,'admin',true)
       ON CONFLICT (email)
       DO UPDATE SET password_hash=EXCLUDED.password_hash,
                     full_name=EXCLUDED.full_name,
                     role='admin',
                     active=true,
                     updated_at=now()`,
      [email, hash, "Administrador"]
    );

    return res.status(200).json({ success: true, email, password });
  } catch (error) {
    console.error("Admin bootstrap error:", error);
    return res.status(500).json({ success: false, message: "No se pudo crear el administrador." });
  }
};
