const { getPool, query } = require("./db");
const { queueAndTrySend, sendQueuedEmail, getNotifyEmail } = require("./email");
const { getProfile } = require("./profile");

async function processReminders() {
  const client = await getPool().connect();
  let locked = false;

  try {
    const lock = await client.query("SELECT pg_try_advisory_lock(934512) AS locked");
    locked = Boolean(lock.rows[0]?.locked);
    if (!locked) return { skipped: true, reason: "another_worker_running" };

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

    const notifyTo = await getNotifyEmail();
    const isSchool = (await getProfile().catch(() => ({ businessType: "school" }))).businessType === "school";
    if (due.rows.length && notifyTo) {
      const body = [
        `Seguimientos pendientes: ${due.rows.length}`,
        "",
        ...due.rows.flatMap((item) => [
          `- ${item.title}`,
          isSchool
            ? `  Familia: ${item.adult_name || "Sin nombre"} · Estudiante: ${item.student_name || "Sin dato"}`
            : `  Contacto: ${item.adult_name || "Sin nombre"}`,
          `  Tel: ${item.phone || "-"} · Email: ${item.email || "-"}`,
          `  Vence: ${new Date(item.due_at).toLocaleString("es-UY")}`,
          ""
        ])
      ].join("\n");

      await queueAndTrySend({
        recipient: notifyTo,
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

    return {
      skipped: false,
      reminders: due.rows.length,
      retriedEmails: jobs.rows.length
    };
  } finally {
    if (locked) {
      await client.query("SELECT pg_advisory_unlock(934512)").catch(() => {});
    }
    client.release();
  }
}

module.exports = { processReminders };
