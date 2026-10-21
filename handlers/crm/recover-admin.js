// TEMPORARY admin recovery. Only active while ADMIN_RECOVERY_TOKEN is set in
// the environment. Resets the password of the oldest active administrator
// (or creates one) and returns the new credentials. Remove after use.

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { query } = require("../../lib/db");

module.exports = async (req, res) => {
  const expected = process.env.ADMIN_RECOVERY_TOKEN || "";
  const given = String(req.query?.token || "");
  if (expected.length < 24 || given.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return res.status(404).json({ success: false, message: "No disponible." });
  }

  try {
    const password = crypto.randomBytes(9).toString("base64url");
    const hash = await bcrypt.hash(password, 12);
    const existing = await query(
      "SELECT id,email FROM managers WHERE role='admin' ORDER BY active DESC, created_at ASC LIMIT 1"
    );

    let email;
    if (existing.rows[0]) {
      email = existing.rows[0].email;
      await query("UPDATE managers SET password_hash=$1, active=true, updated_at=now() WHERE id=$2", [hash, existing.rows[0].id]);
    } else {
      email = "admin@admisia.local";
      await query(
        `INSERT INTO managers (email,password_hash,full_name,role,active) VALUES ($1,$2,'Administrador','admin',true)
         ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role='admin', active=true`,
        [email, hash]
      );
    }

    const all = await query("SELECT email, role, active FROM managers ORDER BY created_at");
    return res.status(200).json({ success: true, email, password, managers: all.rows });
  } catch (error) {
    console.error("Admin recovery error:", error);
    return res.status(500).json({ success: false, message: String(error.message || error) });
  }
};
