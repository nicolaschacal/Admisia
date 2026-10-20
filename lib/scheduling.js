const { DateTime } = require("luxon");
const { query } = require("./db");
const { getBusyRanges } = require("./google-calendar");

const ZONE = process.env.APP_TIMEZONE || "America/Montevideo";

async function getBookingSettings() {
  const result = await query("SELECT value FROM crm_settings WHERE key='booking'");
  return result.rows[0]?.value || {
    slotMinutes: 30,
    openHour: 9,
    closeHour: 16,
    minDaysAhead: 1,
    maxDaysAhead: 30,
    weekdays: [1,2,3,4,5]
  };
}

async function getUnavailableBetween(startISO, endISO) {
  const [appointments, blocked] = await Promise.all([
    query(
      `SELECT start_at, end_at FROM appointments
       WHERE status IN ('scheduled','confirmed')
         AND start_at < $2::timestamptz
         AND end_at > $1::timestamptz`,
      [startISO, endISO]
    ),
    query(
      `SELECT start_at, end_at FROM blocked_slots
       WHERE start_at < $2::timestamptz
         AND end_at > $1::timestamptz`,
      [startISO, endISO]
    )
  ]);

  const localBusy = [...appointments.rows, ...blocked.rows].map((row) => ({
    start: DateTime.fromJSDate(new Date(row.start_at), { zone: "utc" }).setZone(ZONE),
    end: DateTime.fromJSDate(new Date(row.end_at), { zone: "utc" }).setZone(ZONE)
  }));

  const externalBusy = (await getBusyRanges(startISO, endISO)).map((row) => ({
    start: DateTime.fromISO(row.start, { setZone: true }).setZone(ZONE),
    end: DateTime.fromISO(row.end, { setZone: true }).setZone(ZONE)
  }));

  return [...localBusy, ...externalBusy];
}

function overlaps(start, end, busy) {
  return busy.some((item) => start < item.end && end > item.start);
}

async function listAvailableSlots({ days = 5, fromDate = null } = {}) {
  const settings = await getBookingSettings();
  const now = DateTime.now().setZone(ZONE);
  let cursor = fromDate
    ? DateTime.fromISO(fromDate, { zone: ZONE }).startOf("day")
    : now.plus({ days: settings.minDaysAhead || 1 }).startOf("day");

  const earliest = now.plus({ days: settings.minDaysAhead || 1 }).startOf("day");
  if (cursor < earliest) cursor = earliest;

  const latest = now.plus({ days: settings.maxDaysAhead || 30 }).endOf("day");
  const result = [];
  let guard = 0;

  while (result.length < days && cursor <= latest && guard < 60) {
    guard += 1;
    if ((settings.weekdays || [1,2,3,4,5]).includes(cursor.weekday)) {
      const dayStart = cursor.set({ hour: settings.openHour ?? 9, minute: 0, second: 0, millisecond: 0 });
      const lastStart = cursor.set({ hour: settings.closeHour ?? 16, minute: 0, second: 0, millisecond: 0 });
      const dayEnd = lastStart.plus({ minutes: settings.slotMinutes || 30 });
      const busy = await getUnavailableBetween(dayStart.toUTC().toISO(), dayEnd.toUTC().toISO());
      const slots = [];

      for (
        let start = dayStart;
        start <= lastStart;
        start = start.plus({ minutes: settings.slotMinutes || 30 })
      ) {
        const end = start.plus({ minutes: settings.slotMinutes || 30 });
        if (!overlaps(start, end, busy)) {
          slots.push({
            start: start.toISO(),
            end: end.toISO(),
            label: start.toFormat("HH:mm")
          });
        }
      }

      if (slots.length) {
        result.push({
          date: cursor.toISODate(),
          label: cursor.setLocale("es").toFormat("cccc d 'de' LLLL"),
          slots
        });
      }
    }
    cursor = cursor.plus({ days: 1 });
  }

  return result;
}

async function validateSlot(startISO) {
  const settings = await getBookingSettings();
  const now = DateTime.now().setZone(ZONE);
  const start = DateTime.fromISO(startISO, { setZone: true }).setZone(ZONE);

  if (!start.isValid) return { valid: false, reason: "Fecha inválida." };

  const earliest = now.plus({ days: settings.minDaysAhead || 1 }).startOf("day");
  const latest = now.plus({ days: settings.maxDaysAhead || 30 }).endOf("day");

  if (start < earliest) return { valid: false, reason: "La agenda comienza a partir del día siguiente." };
  if (start > latest) return { valid: false, reason: "La fecha está fuera del rango de agenda." };
  if (!(settings.weekdays || [1,2,3,4,5]).includes(start.weekday)) {
    return { valid: false, reason: "Ese día no está habilitado para entrevistas." };
  }

  const open = start.startOf("day").set({ hour: settings.openHour ?? 9 });
  const close = start.startOf("day").set({ hour: settings.closeHour ?? 16 });
  const step = settings.slotMinutes || 30;

  if (start < open || start > close || start.minute % step !== 0) {
    return { valid: false, reason: "El horario debe estar entre 09:00 y 16:00 en intervalos habilitados." };
  }

  const end = start.plus({ minutes: step });
  const busy = await getUnavailableBetween(start.toUTC().toISO(), end.toUTC().toISO());
  if (busy.length) return { valid: false, reason: "Ese horario ya no está disponible." };

  return {
    valid: true,
    start,
    end,
    settings
  };
}

module.exports = { ZONE, getBookingSettings, listAvailableSlots, validateSlot };
