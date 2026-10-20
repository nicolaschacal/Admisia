const { DateTime } = require("luxon");
const { query, withTransaction } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");
const { ZONE } = require("../../lib/scheduling");
const { updateCalendarEventStatus } = require("../../lib/google-calendar");

const VALID = new Set(["scheduled","confirmed","completed","no_show","cancelled"]);

module.exports = async (req, res) => {
  const manager = requireManager(req, res);
  if (!manager) return;

  if (req.method === "GET") {
    try {
      const from = req.query?.from || DateTime.now().setZone(ZONE).startOf("month").toUTC().toISO();
      const to = req.query?.to || DateTime.now().setZone(ZONE).plus({ months: 2 }).endOf("month").toUTC().toISO();

      const result = await query(
        `SELECT a.*, l.adult_name, l.email, l.phone, l.status AS lead_status,
                st.full_name AS student_name, st.birth_date
         FROM appointments a
         JOIN leads l ON l.id=a.lead_id
         LEFT JOIN students st ON st.id=a.student_id
         WHERE a.start_at >= $1::timestamptz AND a.start_at <= $2::timestamptz
         ORDER BY a.start_at`,
        [from, to]
      );

      return res.status(200).json({ success: true, appointments: result.rows });
    } catch (error) {
      console.error("CRM appointments list error:", error);
      return res.status(500).json({ success: false, message: "No se pudo cargar la agenda." });
    }
  }

  if (req.method === "POST") {
    try {
      const { id, status, notes } = req.body || {};
      if (!id || !VALID.has(status)) {
        return res.status(400).json({ success: false, message: "Datos inválidos." });
      }

      const followupSetting = await query("SELECT value FROM crm_settings WHERE key='followup'");
      const followupDays = Number(
        followupSetting.rows[0]?.value?.daysAfterInterview ??
        process.env.FOLLOWUP_DELAY_DAYS ??
        2
      );

      const updated = await withTransaction(async (client) => {
        const current = await client.query("SELECT * FROM appointments WHERE id=$1 FOR UPDATE", [id]);
        const appointment = current.rows[0];
        if (!appointment) throw new Error("NOT_FOUND");

        const result = await client.query(
          `UPDATE appointments
           SET status=$2, notes=COALESCE($3,notes), updated_at=now()
           WHERE id=$1 RETURNING *`,
          [id, status, notes === undefined ? null : String(notes)]
        );

        let newLeadStatus = null;
        if (status === "completed") newLeadStatus = "interview_completed";
        if (status === "no_show") newLeadStatus = "followup";
        if (status === "cancelled") newLeadStatus = "followup";
        if (status === "confirmed" || status === "scheduled") newLeadStatus = "visit_scheduled";

        if (newLeadStatus) {
          await client.query(
            "UPDATE leads SET status=$2, updated_at=now(), last_contact_at=now() WHERE id=$1",
            [appointment.lead_id, newLeadStatus]
          );
        }

        if (status === "completed" && appointment.status !== "completed") {
          const due = DateTime.now().setZone(ZONE).plus({ days: followupDays }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
          await client.query(
            `INSERT INTO followups
               (lead_id, appointment_id, assigned_manager_id, type, title, due_at)
             VALUES ($1,$2,$3,'post_interview','Contactar a la familia luego de la entrevista',$4)
             ON CONFLICT DO NOTHING`,
            [appointment.lead_id, appointment.id, manager.sub, due.toUTC().toISO()]
          );
          await client.query(
            "UPDATE leads SET status='followup', next_action_at=$2, updated_at=now() WHERE id=$1",
            [appointment.lead_id, due.toUTC().toISO()]
          );
        }

        if (status === "no_show" && appointment.status !== "no_show") {
          const due = DateTime.now().setZone(ZONE).plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
          await client.query(
            `INSERT INTO followups
               (lead_id, appointment_id, assigned_manager_id, type, title, due_at)
             VALUES ($1,$2,$3,'no_show','Contactar a la familia por inasistencia',$4)`,
            [appointment.lead_id, appointment.id, manager.sub, due.toUTC().toISO()]
          );
          await client.query(
            "UPDATE leads SET next_action_at=$2, updated_at=now() WHERE id=$1",
            [appointment.lead_id, due.toUTC().toISO()]
          );
        }

        await client.query(
          `INSERT INTO activities (lead_id,manager_id,type,description,metadata)
           VALUES ($1,$2,'appointment_status',$3,$4::jsonb)`,
          [
            appointment.lead_id,
            manager.sub,
            `Estado de entrevista actualizado a ${status}.`,
            JSON.stringify({ appointmentId: id, status })
          ]
        );

        return result.rows[0];
      });

      try {
        await updateCalendarEventStatus(updated.external_calendar_event_id, status);
      } catch (calendarError) {
        console.error("No se pudo actualizar Google Calendar:", calendarError.message);
      }

      return res.status(200).json({ success: true, appointment: updated });
    } catch (error) {
      if (error.message === "NOT_FOUND") return res.status(404).json({ success: false, message: "Entrevista no encontrada." });
      console.error("CRM appointment update error:", error);
      return res.status(500).json({ success: false, message: "No se pudo actualizar la entrevista." });
    }
  }

  return res.status(405).json({ success: false, message: "Método no permitido." });
};
