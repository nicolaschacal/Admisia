const { query } = require("../../lib/db");
const { queueAndTrySend, sendQueuedEmail } = require("../../lib/email");

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }
  if (!authorized(req)) {
    return res.status(401).json({ success: false, message: "No autorizado." });
  }

  try {
    const due = await query(`
      SELECT f.id, f.title, f.due_at, l.id AS lead_id, l.adult_name, l.phone, l.email,
             (SELECT full_name FROM students st WHERE st.lead_id=l.id ORDER BY st.created_at DESC LIMIT 1) AS student_name
      FROM followups f
      JOIN leads l ON l.id=f.lead_id
      WHERE f.status='pending'
        AND f.due_at <= now() + interval '24 hours'
        AND (f.reminder_sent_at IS NULL OR f.reminder_sent_at < now() - interval '20 hours')
      ORDER BY f.due_at
    `);

    if (due.rows.length) {
      const body = [
        `Seguimientos pendientes: ${due.rows.length}`,
        "",
        ...due.rows.flatMap((item) => [
          `- ${item.title}`,
          `  Familia: ${item.adult_name || "Sin nombre"} · Estudiante: ${item.student_name || "Sin dato"}`,
          `  Tel: ${item.phone || "-"} · Email: ${item.email || "-"}`,
          `  Vence: ${new Date(item.due_at).toLocaleString("es-UY")}`,
          ""
        ])
      ].join("\n");

      await queueAndTrySend({
        recipient: process.env.ADMISSIONS_EMAIL || "nubarian@nubarian.edu.uy",
        subject: `AdmisIA CRM · ${due.rows.length} seguimiento(s) pendientes`,
        bodyText: body
      });

      await query(
        "UPDATE followups SET reminder_sent_at=now() WHERE id = ANY($1::uuid[])",
        [due.rows.map((row) => row.id)]
      );
    }

    const jobs = await query(`
      SELECT * FROM email_jobs
      WHERE status IN ('pending','failed')
        AND next_attempt_at <= now()
        AND attempts < 5
      ORDER BY created_at
      LIMIT 20
    `);

    for (const job of jobs.rows) {
      await sendQueuedEmail(job);
    }

    return res.status(200).json({
      success: true,
      reminders: due.rows.length,
      retriedEmails: jobs.rows.length
    });
  } catch (error) {
    console.error("CRM cron error:", error);
    return res.status(500).json({ success: false, message: "Falló el procesamiento de recordatorios." });
  }
};
