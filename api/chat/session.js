const { DateTime } = require("luxon");
const { query } = require("../../lib/db");
const { getCaptureSettings } = require("../../lib/capture");
const { ZONE } = require("../../lib/scheduling");
const {
  loadVisitorMessages,
  migrateLegacySession,
  getCurrentAppointment
} = require("../../lib/visitor-session");

function appointmentPayload(row) {
  if (!row) return null;
  const start = DateTime.fromJSDate(new Date(row.start_at), { zone: "utc" }).setZone(ZONE);
  const end = DateTime.fromJSDate(new Date(row.end_at), { zone: "utc" }).setZone(ZONE);
  return {
    id: row.id,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    studentName: row.student_name || null,
    display: start.setLocale("es").toFormat("cccc dd/LL/yyyy 'a las' HH:mm"),
    shortDisplay: start.setLocale("es").toFormat("ccc dd/LL · HH:mm"),
    endDisplay: end.toFormat("HH:mm")
  };
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }

  try {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");

    const legacySessionId = String(req.query?.legacySessionId || "").slice(0, 200);
    const migratedSession = legacySessionId
      ? await migrateLegacySession(req, res, legacySessionId)
      : null;

    const { session, messages } = await loadVisitorMessages(req, res, 250, migratedSession);
    const [appointment, leadRow, capture] = await Promise.all([
      getCurrentAppointment(session.lead_id),
      session.lead_id
        ? query("SELECT adult_name,phone,email FROM leads WHERE id=$1", [session.lead_id]).then((r) => r.rows[0]).catch(() => null)
        : null,
      getCaptureSettings()
    ]);

    return res.status(200).json({
      success: true,
      messages: messages.map((item) => ({
        role: item.role,
        text: item.content,
        createdAt: item.created_at
      })),
      appointment: appointmentPayload(appointment),
      // Same browser that left these details: used to prefill the forms.
      callbackEnabled: capture.callback !== false,
      contact: leadRow ? { name: leadRow.adult_name || "", phone: leadRow.phone || "", email: leadRow.email || "" } : null
    });
  } catch (error) {
    console.error("Chat session bootstrap error:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo recuperar la conversación."
    });
  }
};
