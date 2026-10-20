const { query } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }
  if (!requireManager(req, res)) return;

  try {
    const result = await query(`
      SELECT
        cs.id, cs.session_key, cs.lead_id, cs.started_at, cs.last_message_at,
        l.adult_name, l.status,
        (SELECT content FROM conversation_messages m
         WHERE m.conversation_id=cs.id AND m.role='user'
         ORDER BY m.created_at DESC LIMIT 1) AS last_user_message,
        (SELECT count(*) FROM conversation_messages m
         WHERE m.conversation_id=cs.id)::int AS message_count
      FROM conversation_sessions cs
      LEFT JOIN leads l ON l.id=cs.lead_id
      ORDER BY cs.last_message_at DESC
      LIMIT 250
    `);

    return res.status(200).json({ success: true, inquiries: result.rows });
  } catch (error) {
    console.error("CRM inquiries error:", error);
    return res.status(500).json({ success: false, message: "No se pudieron cargar las consultas." });
  }
};
