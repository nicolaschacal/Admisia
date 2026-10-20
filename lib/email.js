const nodemailer = require("nodemailer");
const { query } = require("./db");

let transporter;

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  return transporter;
}

async function queueEmail({ leadId = null, appointmentId = null, recipient, subject, bodyText }) {
  const result = await query(
    `INSERT INTO email_jobs (lead_id, appointment_id, recipient, subject, body_text)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [leadId, appointmentId, recipient, subject, bodyText]
  );
  return result.rows[0];
}

async function sendQueuedEmail(job) {
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: "smtp_not_configured" };

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: job.recipient,
      subject: job.subject,
      text: job.body_text
    });

    await query(
      `UPDATE email_jobs
       SET status='sent', sent_at=now(), attempts=attempts+1, last_error=NULL
       WHERE id=$1`,
      [job.id]
    );

    return { sent: true };
  } catch (error) {
    await query(
      `UPDATE email_jobs
       SET status='failed', attempts=attempts+1, last_error=$2,
           next_attempt_at=now() + interval '30 minutes'
       WHERE id=$1`,
      [job.id, String(error.message || error).slice(0, 1000)]
    );
    return { sent: false, reason: "send_failed" };
  }
}

async function queueAndTrySend(payload) {
  const job = await queueEmail(payload);
  const result = await sendQueuedEmail(job);
  return { job, ...result };
}

module.exports = { queueEmail, sendQueuedEmail, queueAndTrySend };
