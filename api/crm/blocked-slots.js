const { query } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");

module.exports = async (req, res) => {
  const manager = requireManager(req, res);
  if (!manager) return;

  if (req.method === "GET") {
    try {
      const result = await query(
        `SELECT * FROM blocked_slots
         WHERE end_at >= now() - interval '1 day'
         ORDER BY start_at
         LIMIT 250`
      );
      return res.status(200).json({ success: true, blocks: result.rows });
    } catch (error) {
      console.error("Blocked slots read error:", error);
      return res.status(500).json({ success: false, message: "No se pudieron cargar los bloqueos." });
    }
  }

  if (req.method === "POST") {
    try {
      const { action, id, startAt, endAt, reason } = req.body || {};

      if (action === "delete") {
        if (!id) return res.status(400).json({ success: false, message: "Falta id." });
        await query("DELETE FROM blocked_slots WHERE id=$1", [id]);
        return res.status(200).json({ success: true });
      }

      if (action === "create") {
        if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) {
          return res.status(400).json({ success: false, message: "Rango inválido." });
        }
        const result = await query(
          `INSERT INTO blocked_slots(start_at,end_at,reason)
           VALUES ($1,$2,$3)
           RETURNING *`,
          [startAt, endAt, String(reason || "").slice(0,500) || null]
        );
        return res.status(201).json({ success: true, block: result.rows[0] });
      }

      return res.status(400).json({ success: false, message: "Acción inválida." });
    } catch (error) {
      console.error("Blocked slots update error:", error);
      return res.status(500).json({ success: false, message: "No se pudo actualizar el bloqueo." });
    }
  }

  return res.status(405).json({ success: false, message: "Método no permitido." });
};
