const { query } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }
  if (!requireManager(req, res)) return;

  try {
    const id = String(req.query?.id || "");
    if (!id) return res.status(400).json({ success: false, message: "Falta id." });

    const leadResult = await query("SELECT * FROM leads WHERE id=$1", [id]);
    const lead = leadResult.rows[0];
    if (!lead) return res.status(404).json({ success: false, message: "Candidato no encontrado." });

    const [students, appointments, followups, activities, conversations] = await Promise.all([
      query("SELECT * FROM students WHERE lead_id=$1 ORDER BY created_at", [id]),
      query("SELECT * FROM appointments WHERE lead_id=$1 ORDER BY start_at DESC", [id]),
      query("SELECT * FROM followups WHERE lead_id=$1 ORDER BY due_at DESC", [id]),
      query("SELECT * FROM activities WHERE lead_id=$1 ORDER BY created_at DESC LIMIT 100", [id]),
      query(
        `SELECT cs.id, cs.session_key, cs.started_at, cs.last_message_at
         FROM conversation_sessions cs
         WHERE cs.lead_id=$1
         ORDER BY cs.started_at DESC`,
        [id]
      )
    ]);

    const conversationData = [];
    for (const conversation of conversations.rows) {
      const messages = await query(
        `SELECT role,content,created_at
         FROM conversation_messages
         WHERE conversation_id=$1
         ORDER BY created_at`,
        [conversation.id]
      );
      conversationData.push({ ...conversation, messages: messages.rows });
    }

    return res.status(200).json({
      success: true,
      lead,
      students: students.rows,
      appointments: appointments.rows,
      followups: followups.rows,
      activities: activities.rows,
      conversations: conversationData
    });
  } catch (error) {
    console.error("CRM lead detail error:", error);
    return res.status(500).json({ success: false, message: "No se pudo cargar la ficha." });
  }
};
