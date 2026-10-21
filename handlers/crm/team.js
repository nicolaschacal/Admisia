// Configuración → Equipo y Mi cuenta.
// GET  → lista de usuarios del panel (admin) o solo el propio usuario.
// POST → { action: "create" | "update" | "reset-password" | "change-password", ... }

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { query } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");

const ROLES = ["admin", "manager", "viewer"];

function clean(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function tempPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

async function activeAdminCount(excludeId = null) {
  const result = await query(
    "SELECT count(*) FROM managers WHERE role='admin' AND active AND ($1::uuid IS NULL OR id<>$1)",
    [excludeId]
  );
  return Number(result.rows[0].count);
}

module.exports = async (req, res) => {
  const manager = requireManager(req, res);
  if (!manager) return;
  const isAdmin = manager.role === "admin";

  if (req.method === "GET") {
    try {
      const result = await query(
        `SELECT id,email,full_name,role,active,created_at
         FROM managers
         WHERE $1::boolean OR id=$2
         ORDER BY active DESC, role, full_name`,
        [isAdmin, manager.sub]
      );
      return res.status(200).json({ success: true, members: result.rows, me: manager.sub, isAdmin });
    } catch (error) {
      console.error("Team read error:", error);
      return res.status(500).json({ success: false, message: "No se pudo cargar el equipo." });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }

  const action = clean(req.body?.action, 30);

  try {
    if (action === "change-password") {
      const current = String(req.body?.currentPassword || "");
      const next = String(req.body?.newPassword || "");
      if (next.length < 10) {
        return res.status(400).json({ success: false, message: "La nueva contraseña debe tener al menos 10 caracteres." });
      }
      const row = (await query("SELECT password_hash FROM managers WHERE id=$1", [manager.sub])).rows[0];
      if (!row || !(await bcrypt.compare(current, row.password_hash))) {
        return res.status(400).json({ success: false, message: "La contraseña actual no es correcta." });
      }
      await query("UPDATE managers SET password_hash=$1, updated_at=now() WHERE id=$2", [await bcrypt.hash(next, 12), manager.sub]);
      return res.status(200).json({ success: true, message: "Contraseña actualizada." });
    }

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Solo un administrador puede gestionar el equipo." });
    }

    if (action === "create") {
      const email = clean(req.body?.email).toLowerCase();
      const name = clean(req.body?.name, 160);
      const role = ROLES.includes(req.body?.role) ? req.body.role : "manager";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: "Ingresá un correo válido." });
      }
      if (!name) return res.status(400).json({ success: false, message: "Ingresá el nombre." });

      const password = tempPassword();
      const result = await query(
        `INSERT INTO managers (email,password_hash,full_name,role,active)
         VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (email) DO NOTHING
         RETURNING id,email,full_name,role,active,created_at`,
        [email, await bcrypt.hash(password, 12), name, role]
      );
      if (!result.rows[0]) {
        return res.status(409).json({ success: false, message: "Ya existe un usuario con ese correo." });
      }
      return res.status(200).json({ success: true, member: result.rows[0], temporaryPassword: password });
    }

    const id = clean(req.body?.id, 60);
    if (!id) return res.status(400).json({ success: false, message: "Falta el usuario." });

    if (action === "update") {
      const target = (await query("SELECT id,role,active FROM managers WHERE id=$1", [id])).rows[0];
      if (!target) return res.status(404).json({ success: false, message: "Usuario no encontrado." });

      const role = ROLES.includes(req.body?.role) ? req.body.role : target.role;
      const active = req.body?.active === undefined ? target.active : Boolean(req.body.active);
      const losesAdmin = target.role === "admin" && target.active && (role !== "admin" || !active);
      if (losesAdmin && (await activeAdminCount(id)) === 0) {
        return res.status(400).json({ success: false, message: "Tiene que quedar al menos un administrador activo." });
      }
      if (id === manager.sub && !active) {
        return res.status(400).json({ success: false, message: "No podés desactivar tu propio usuario." });
      }

      await query("UPDATE managers SET role=$1, active=$2, updated_at=now() WHERE id=$3", [role, active, id]);
      return res.status(200).json({ success: true });
    }

    if (action === "reset-password") {
      const password = tempPassword();
      const result = await query(
        "UPDATE managers SET password_hash=$1, updated_at=now() WHERE id=$2 RETURNING email",
        [await bcrypt.hash(password, 12), id]
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, message: "Usuario no encontrado." });
      return res.status(200).json({ success: true, temporaryPassword: password });
    }

    return res.status(400).json({ success: false, message: "Acción desconocida." });
  } catch (error) {
    console.error("Team update error:", error);
    return res.status(500).json({ success: false, message: "No se pudo completar la acción." });
  }
};
