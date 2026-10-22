const { query } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");
const { ensureCaptureSchema } = require("../../lib/capture");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }
  if (!requireManager(req, res)) return;

  try {
    await ensureCaptureSchema();
    const result = await query(`
      SELECT
        (SELECT count(*) FROM conversation_sessions WHERE started_at >= now() - interval '30 days')::int AS inquiries_30d,
        (SELECT count(*) FROM leads WHERE created_at >= now() - interval '30 days')::int AS leads_30d,
        (SELECT count(*) FROM leads l WHERE l.created_at >= now() - interval '30 days'
           AND COALESCE(l.capture_source,'booking')<>'booking'
           AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.lead_id=l.id AND a.status<>'cancelled'))::int AS contacts_no_visit_30d,
        (SELECT count(*) FROM appointments WHERE status IN ('scheduled','confirmed') AND start_at >= now())::int AS upcoming_appointments,
        (SELECT count(*) FROM appointments WHERE status='completed' AND start_at >= now() - interval '30 days')::int AS interviews_30d,
        (SELECT count(*) FROM leads WHERE status='enrolled' AND updated_at >= now() - interval '30 days')::int AS enrolled_30d,
        (SELECT count(*) FROM followups WHERE status='pending' AND due_at <= now())::int AS overdue_followups,
        (SELECT count(*) FROM followups WHERE status='pending' AND due_at > now() AND due_at < now() + interval '24 hours')::int AS due_next_24h
    `);

    const stages = await query(`
      SELECT status, count(*)::int AS count
      FROM leads
      GROUP BY status
      ORDER BY status
    `);

    return res.status(200).json({
      success: true,
      summary: result.rows[0],
      stages: stages.rows
    });
  } catch (error) {
    console.error("CRM summary error:", error);
    return res.status(500).json({ success: false, message: "No se pudo cargar el resumen." });
  }
};
