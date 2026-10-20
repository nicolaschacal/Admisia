const { withTransaction } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");

const VALID_STATUSES = new Set([
  "new_inquiry","qualified","visit_scheduled","interview_completed",
  "followup","application_started","waitlist","enrolled","lost"
]);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }
  const manager = requireManager(req, res);
  if (!manager) return;

  try {
    const { id, status, notes, nextActionAt } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: "Falta id." });
    if (status && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: "Estado inválido." });
    }

    const updated = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE leads
         SET status=COALESCE($2,status),
             notes=COALESCE($3,notes),
             next_action_at=$4,
             updated_at=now()
         WHERE id=$1
         RETURNING *`,
        [id, status || null, notes === undefined ? null : String(notes), nextActionAt || null]
      );

      if (!result.rows[0]) throw new Error("NOT_FOUND");

      await client.query(
        `INSERT INTO activities (lead_id,manager_id,type,description,metadata)
         VALUES ($1,$2,'lead_updated',$3,$4::jsonb)`,
        [
          id,
          manager.sub,
          "Ficha del candidato actualizada.",
          JSON.stringify({ status: status || null, nextActionAt: nextActionAt || null })
        ]
      );

      return result.rows[0];
    });

    return res.status(200).json({ success: true, lead: updated });
  } catch (error) {
    if (error.message === "NOT_FOUND") return res.status(404).json({ success: false, message: "Candidato no encontrado." });
    console.error("CRM lead update error:", error);
    return res.status(500).json({ success: false, message: "No se pudo actualizar la ficha." });
  }
};
