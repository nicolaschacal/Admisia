const { DateTime } = require("luxon");
const { withTransaction, query } = require("../../lib/db");
const { validateSlot, ZONE } = require("../../lib/scheduling");
const {
  ensureConversation,
  getCurrentAppointment,
  persistVisitorMessage
} = require("../../lib/visitor-session");
const {
  updateCalendarEventStatus,
  rescheduleCalendarEvent
} = require("../../lib/google-calendar");
const { getProfile } = require("../../lib/profile");
const { vocabFor } = require("../../lib/business-types");

// "visita" for schools (original texts), "consulta"/"turno" for other businesses.
async function apptWords() {
  const profile = await getProfile().catch(() => ({ businessType: "school" }));
  const school = profile.businessType === "school";
  const w = vocabFor(profile.businessType).appt;
  const o = w.pron === "la" ? "a" : "o";
  return {
    school,
    notFound: school ? words.notFound : `No encontramos ${w.a} asociad${o} a este chat.`,
    noActive: school ? words.noActive : `No tenés ${w.a} activ${o} para modificar.`,
    inactive: school ? "La visita ya no está activa." : `${w.the.charAt(0).toUpperCase() + w.the.slice(1)} ya no está activ${o}.`,
    cancelledActivity: school ? "La familia canceló la visita desde el chat." : `Se canceló ${w.the} desde el chat.`,
    cancelledMsg: (when) => school
      ? `Listo. Cancelé tu visita del ${when}. Si querés, podemos coordinar otra fecha cuando te quede mejor.`
      : `Listo. Cancelé ${w.your} del ${when}. Si querés, podemos buscar otra fecha cuando te quede mejor.`,
    rescheduledActivity: (when) => school ? `Visita reprogramada para ${when}.` : `${w.Noun} reprogramad${o} para ${when}.`,
    rescheduledMsg: (when) => school ? `Listo. Reprogramé tu visita para el ${when}.` : `Listo. Reprogramé ${w.your} para el ${when}.`,
    failed: school ? "No se pudo actualizar la visita." : `No se pudo actualizar ${w.the}.`
  };
}

function appointmentPayload(row) {
  if (!row) return null;
  const start = DateTime.fromJSDate(new Date(row.start_at), { zone: "utc" }).setZone(ZONE);
  return {
    id: row.id,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    studentName: row.student_name || null,
    display: start.setLocale("es").toFormat("cccc dd/LL/yyyy 'a las' HH:mm"),
    shortDisplay: start.setLocale("es").toFormat("ccc dd/LL · HH:mm")
  };
}

module.exports = async (req, res) => {
  if (!["GET","POST"].includes(req.method)) {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }

  const words = await apptWords();
  try {
    const session = await ensureConversation(req, res);
    if (!session.lead_id) {
      return res.status(404).json({ success: false, message: "No encontramos una visita asociada a este chat." });
    }

    const current = await getCurrentAppointment(session.lead_id);

    if (req.method === "GET") {
      return res.status(200).json({ success: true, appointment: appointmentPayload(current) });
    }

    if (!current) {
      return res.status(404).json({ success: false, message: "No tenés una visita activa para modificar." });
    }

    const action = String(req.body?.action || "");

    if (action === "cancel") {
      const cancelled = await withTransaction(async (client) => {
        const updated = await client.query(
          `UPDATE appointments
           SET status='cancelled',updated_at=now()
           WHERE id=$1 AND lead_id=$2 AND status IN ('scheduled','confirmed')
           RETURNING *`,
          [current.id, session.lead_id]
        );
        if (!updated.rows[0]) throw new Error(words.inactive);

        await client.query(
          `UPDATE leads
           SET status='qualified',updated_at=now(),last_contact_at=now()
           WHERE id=$1`,
          [session.lead_id]
        );

        await client.query(
          `INSERT INTO activities(lead_id,type,description,metadata)
           VALUES($1,'appointment_cancelled',$2,$3::jsonb)`,
          [
            session.lead_id,
            words.cancelledActivity,
            JSON.stringify({ appointmentId: current.id, previousStartAt: current.start_at })
          ]
        );

        return updated.rows[0];
      });

      try {
        await updateCalendarEventStatus(cancelled.external_calendar_event_id, "cancelled");
      } catch (error) {
        console.error("Calendar cancel sync:", error.message);
      }

      const previous = DateTime.fromJSDate(new Date(current.start_at), { zone: "utc" }).setZone(ZONE);
      await persistVisitorMessage(
        req,
        res,
        "assistant",
        words.cancelledMsg(previous.setLocale("es").toFormat("cccc dd/LL 'a las' HH:mm")),
        session.lead_id
      );

      return res.status(200).json({ success: true, appointment: null });
    }

    if (action === "reschedule") {
      const startAt = String(req.body?.startAt || "");
      if (!startAt) {
        return res.status(400).json({ success: false, message: "Elegí un nuevo horario." });
      }

      const slot = await validateSlot(startAt);
      if (!slot.valid) {
        return res.status(409).json({ success: false, message: slot.reason });
      }

      const updated = await withTransaction(async (client) => {
        const lockKey = Math.abs(
          Array.from(String(slot.start.toMillis())).reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
        );
        await client.query("SELECT pg_advisory_xact_lock($1)", [lockKey]);

        const result = await client.query(
          `UPDATE appointments
           SET start_at=$3,end_at=$4,updated_at=now(),status='scheduled'
           WHERE id=$1 AND lead_id=$2 AND status IN ('scheduled','confirmed')
           RETURNING *`,
          [
            current.id,
            session.lead_id,
            slot.start.toUTC().toISO(),
            slot.end.toUTC().toISO()
          ]
        );

        if (!result.rows[0]) throw new Error(words.inactive);

        await client.query(
          `INSERT INTO activities(lead_id,type,description,metadata)
           VALUES($1,'appointment_rescheduled',$2,$3::jsonb)`,
          [
            session.lead_id,
            words.rescheduledActivity(slot.start.setLocale("es").toFormat("dd/LL/yyyy HH:mm")),
            JSON.stringify({
              appointmentId: current.id,
              previousStartAt: current.start_at,
              newStartAt: slot.start.toUTC().toISO()
            })
          ]
        );

        return result.rows[0];
      });

      try {
        await rescheduleCalendarEvent(updated.external_calendar_event_id, {
          startISO: slot.start.toISO(),
          endISO: slot.end.toISO()
        });
      } catch (error) {
        console.error("Calendar reschedule sync:", error.message);
      }

      const studentResult = await query(
        `SELECT full_name AS student_name FROM students WHERE id=$1`,
        [updated.student_id]
      );
      updated.student_name = studentResult.rows[0]?.student_name || current.student_name || null;

      const display = slot.start.setLocale("es").toFormat("cccc dd/LL/yyyy 'a las' HH:mm");
      await persistVisitorMessage(
        req,
        res,
        "assistant",
        words.rescheduledMsg(display),
        session.lead_id
      );

      return res.status(200).json({
        success: true,
        appointment: appointmentPayload(updated)
      });
    }

    return res.status(400).json({ success: false, message: "Acción inválida." });
  } catch (error) {
    console.error("Booking management error:", error);
    if (error.constraint === "appointments_no_overlap") {
      return res.status(409).json({ success: false, message: "Ese horario ya no está disponible. Elegí otro." });
    }
    return res.status(500).json({ success: false, message: error.message || words.failed });
  }
};
