const { withTransaction, query } = require("../../lib/db");
const { validateSlot, ZONE } = require("../../lib/scheduling");
const { queueAndTrySend } = require("../../lib/email");
const { DateTime } = require("luxon");
const { createCalendarEvent } = require("../../lib/google-calendar");
const {
  linkVisitorToLead,
  persistVisitorMessage
} = require("../../lib/visitor-session");

function clean(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function inferLevel(birthDate) {
  if (!birthDate) return null;
  const birth = DateTime.fromISO(birthDate, { zone: ZONE });
  if (!birth.isValid) return null;
  const age = Math.floor(DateTime.now().setZone(ZONE).diff(birth, "years").years);
  return age <= 5 ? "inicial" : "primaria";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ success: false, message: "La agenda todavía no está configurada." });
    }

    const {
      startAt,
      adultName,
      email,
      phone,
      studentName,
      birthDate,
      previousInstitution,
      comments,
      privacyConsent,
      utmSource,
      utmMedium,
      utmCampaign
    } = req.body || {};

    const required = { startAt, adultName, email, phone, studentName, birthDate };
    const missing = Object.entries(required).filter(([, value]) => !clean(value)).map(([key]) => key);
    if (missing.length) {
      return res.status(400).json({ success: false, message: "Faltan datos obligatorios para confirmar la visita." });
    }

    if (privacyConsent !== true && privacyConsent !== "true") {
      return res.status(400).json({ success: false, message: "Necesitamos tu autorización para gestionar los datos de admisión." });
    }

    if (!/^\S+@\S+\.\S+$/.test(clean(email, 200))) {
      return res.status(400).json({ success: false, message: "El correo electrónico no parece válido." });
    }

    const slot = await validateSlot(startAt);
    if (!slot.valid) {
      return res.status(409).json({ success: false, message: slot.reason });
    }

    const levelInterest = inferLevel(birthDate);

    const created = await withTransaction(async (client) => {
      const lockKey = Math.abs(
        Array.from(String(slot.start.toMillis())).reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
      );
      await client.query("SELECT pg_advisory_xact_lock($1)", [lockKey]);

      const overlap = await client.query(
        `SELECT id FROM appointments
         WHERE status IN ('scheduled','confirmed')
           AND start_at < $2::timestamptz
           AND end_at > $1::timestamptz
         LIMIT 1`,
        [slot.start.toUTC().toISO(), slot.end.toUTC().toISO()]
      );

      if (overlap.rows.length) {
        const error = new Error("Ese horario acaba de ser reservado por otra familia.");
        error.code = "SLOT_TAKEN";
        throw error;
      }

      let lead = null;
      const existing = await client.query(
        `SELECT * FROM leads
         WHERE lower(email)=lower($1) OR phone=$2
         ORDER BY created_at DESC LIMIT 1`,
        [clean(email, 200), clean(phone, 80)]
      );

      if (existing.rows[0]) {
        lead = existing.rows[0];
        const updated = await client.query(
          `UPDATE leads
           SET adult_name=$2, email=$3, phone=$4,
               status='visit_scheduled',
               level_interest=COALESCE($5, level_interest),
               privacy_consent_at=COALESCE(privacy_consent_at, now()),
               utm_source=COALESCE(NULLIF($6,''), utm_source),
               utm_medium=COALESCE(NULLIF($7,''), utm_medium),
               utm_campaign=COALESCE(NULLIF($8,''), utm_campaign),
               last_contact_at=now(),
               updated_at=now()
           WHERE id=$1
           RETURNING *`,
          [
            lead.id,
            clean(adultName, 200),
            clean(email, 200).toLowerCase(),
            clean(phone, 80),
            levelInterest,
            clean(utmSource, 200),
            clean(utmMedium, 200),
            clean(utmCampaign, 200)
          ]
        );
        lead = updated.rows[0];
      } else {
        const inserted = await client.query(
          `INSERT INTO leads
             (adult_name,email,phone,status,level_interest,privacy_consent_at,
              utm_source,utm_medium,utm_campaign,last_contact_at,source)
           VALUES ($1,$2,$3,'visit_scheduled',$4,now(),$5,$6,$7,now(),'chat')
           RETURNING *`,
          [
            clean(adultName, 200),
            clean(email, 200).toLowerCase(),
            clean(phone, 80),
            levelInterest,
            clean(utmSource, 200) || null,
            clean(utmMedium, 200) || null,
            clean(utmCampaign, 200) || null
          ]
        );
        lead = inserted.rows[0];
      }

      const studentResult = await client.query(
        `INSERT INTO students
           (lead_id, full_name, birth_date, previous_institution, comments, level_interest)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [
          lead.id,
          clean(studentName, 200),
          birthDate,
          clean(previousInstitution, 250) || null,
          clean(comments, 1500) || null,
          levelInterest
        ]
      );
      const student = studentResult.rows[0];

      const appointmentResult = await client.query(
        `INSERT INTO appointments
           (lead_id, student_id, start_at, end_at, status, source)
         VALUES ($1,$2,$3,$4,'scheduled','chat')
         RETURNING *`,
        [lead.id, student.id, slot.start.toUTC().toISO(), slot.end.toUTC().toISO()]
      );
      const appointment = appointmentResult.rows[0];

      await linkVisitorToLead(req, res, lead.id, client);

      await client.query(
        `INSERT INTO activities (lead_id,type,description,metadata)
         VALUES ($1,'appointment_scheduled',$2,$3::jsonb)`,
        [
          lead.id,
          `Visita agendada para ${slot.start.setLocale("es").toFormat("dd/LL/yyyy HH:mm")}.`,
          JSON.stringify({ appointmentId: appointment.id })
        ]
      );

      return { lead, student, appointment };
    });

    const localStart = DateTime.fromJSDate(new Date(created.appointment.start_at), { zone: "utc" }).setZone(ZONE);
    const admissionsEmail = process.env.ADMISSIONS_EMAIL || "nubarian@nubarian.edu.uy";

    try {
      const calendarEvent = await createCalendarEvent({
        startISO: localStart.toISO(),
        endISO: DateTime.fromJSDate(new Date(created.appointment.end_at), { zone: "utc" }).setZone(ZONE).toISO(),
        summary: `Admisiones Nubarian · ${created.student.full_name}`,
        description: [
          `Adulto responsable: ${created.lead.adult_name}`,
          `Teléfono: ${created.lead.phone}`,
          `Correo: ${created.lead.email}`,
          `Institución anterior: ${created.student.previous_institution || "No indicada"}`
        ].join("\n"),
        attendeeEmail: created.lead.email
      });

      if (calendarEvent?.id) {
        await query(
          "UPDATE appointments SET external_calendar_event_id=$2, updated_at=now() WHERE id=$1",
          [created.appointment.id, calendarEvent.id]
        );
      }
    } catch (calendarError) {
      console.error("La reserva se creó pero no pudo sincronizarse con Google Calendar:", calendarError.message);
      await query(
        `INSERT INTO activities (lead_id,type,description,metadata)
         VALUES ($1,'calendar_sync_failed','No se pudo sincronizar la entrevista con Google Calendar.',$2::jsonb)`,
        [created.lead.id, JSON.stringify({ error: String(calendarError.message || calendarError).slice(0,500) })]
      );
    }

    const schoolBody = [
      "Nueva visita agendada desde AdmisIA",
      "",
      `Fecha: ${localStart.setLocale("es").toFormat("cccc dd/LL/yyyy 'a las' HH:mm")}`,
      `Adulto responsable: ${created.lead.adult_name}`,
      `Correo: ${created.lead.email}`,
      `Teléfono: ${created.lead.phone}`,
      `Estudiante: ${created.student.full_name}`,
      `Fecha de nacimiento: ${created.student.birth_date}`,
      `Institución de procedencia: ${created.student.previous_institution || "No indicada"}`,
      `Comentarios: ${created.student.comments || "Sin comentarios adicionales"}`
    ].join("\n");

    await queueAndTrySend({
      leadId: created.lead.id,
      appointmentId: created.appointment.id,
      recipient: admissionsEmail,
      subject: `Nueva visita Nubarian · ${created.student.full_name} · ${localStart.toFormat("dd/LL HH:mm")}`,
      bodyText: schoolBody
    });

    const familyBody = [
      `Hola ${created.lead.adult_name},`,
      "",
      "Tu visita al Colegio Nubarian quedó registrada.",
      `Fecha y hora: ${localStart.setLocale("es").toFormat("cccc dd/LL/yyyy 'a las' HH:mm")}`,
      "Dirección: Agraciada 2850, Montevideo.",
      "",
      "El equipo de Admisiones podrá contactarte si necesita confirmar algún detalle."
    ].join("\n");

    await queueAndTrySend({
      leadId: created.lead.id,
      appointmentId: created.appointment.id,
      recipient: created.lead.email,
      subject: "Confirmación de visita · Colegio Nubarian",
      bodyText: familyBody
    });

    const display = localStart.setLocale("es").toFormat("cccc dd/LL/yyyy 'a las' HH:mm");

    await persistVisitorMessage(
      req,
      res,
      "assistant",
      `Visita confirmada para el ${display}. Si necesitás cambiarla o cancelarla, podés hacerlo desde este mismo chat.`,
      created.lead.id
    );

    return res.status(201).json({
      success: true,
      appointment: {
        id: created.appointment.id,
        startAt: created.appointment.start_at,
        endAt: created.appointment.end_at,
        status: created.appointment.status,
        studentName: created.student.full_name,
        display
      }
    });
  } catch (error) {
    console.error("Error creando reserva:", error);
    if (error.code === "SLOT_TAKEN" || error.constraint === "appointments_no_overlap") {
      return res.status(409).json({ success: false, message: "Ese horario ya no está disponible. Elegí otra opción." });
    }
    return res.status(500).json({ success: false, message: "No se pudo confirmar la visita." });
  }
};
