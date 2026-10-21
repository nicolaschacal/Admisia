const { google } = require("googleapis");

const { getRuntimeConfig } = require("./config");

let calendarClient = null;
let calendarKey = "";

function parseCredentials(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Las credenciales de Google Calendar no son un JSON válido.");
  }
}

function buildCalendarClient(credentials) {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"]
  });
  return google.calendar({ version: "v3", auth });
}

async function getCalendar() {
  const { calendar } = await getRuntimeConfig();
  if (!calendar.calendarId || !calendar.serviceAccountJson) return null;

  const key = `${calendar.calendarId}|${calendar.serviceAccountJson}`;
  if (!calendarClient || key !== calendarKey) {
    calendarClient = buildCalendarClient(parseCredentials(calendar.serviceAccountJson));
    calendarKey = key;
  }

  return { client: calendarClient, calendarId: calendar.calendarId };
}

// Used by Configuración → Integraciones → "Probar conexión".
async function testCalendarConnection({ calendarId, serviceAccountJson }) {
  const client = buildCalendarClient(parseCredentials(serviceAccountJson));
  const now = new Date();
  const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const response = await client.freebusy.query({
    requestBody: { timeMin: now.toISOString(), timeMax: later.toISOString(), items: [{ id: calendarId }] }
  });
  const entry = response.data.calendars?.[calendarId];
  if (entry?.errors?.length) {
    const reason = entry.errors[0]?.reason || "sin acceso";
    throw new Error(`Google respondió "${reason}". Compartí el calendario con el correo de la cuenta de servicio.`);
  }
  return true;
}

async function getBusyRanges(startISO, endISO) {
  const calendar = await getCalendar();
  if (!calendar) return [];

  const response = await calendar.client.freebusy.query({
    requestBody: {
      timeMin: startISO,
      timeMax: endISO,
      items: [{ id: calendar.calendarId }]
    }
  });

  return (response.data.calendars?.[calendar.calendarId]?.busy || []).map((item) => ({
    start: item.start,
    end: item.end
  }));
}

async function createCalendarEvent({ startISO, endISO, summary, description, attendeeEmail }) {
  const calendar = await getCalendar();
  if (!calendar) return null;

  const response = await calendar.client.events.insert({
    calendarId: calendar.calendarId,
    sendUpdates: attendeeEmail ? "all" : "none",
    requestBody: {
      summary,
      description,
      start: { dateTime: startISO },
      end: { dateTime: endISO },
      attendees: attendeeEmail ? [{ email: attendeeEmail }] : undefined
    }
  });

  return response.data;
}

async function rescheduleCalendarEvent(eventId, { startISO, endISO }) {
  const calendar = await getCalendar();
  if (!calendar || !eventId) return null;

  const response = await calendar.client.events.patch({
    calendarId: calendar.calendarId,
    eventId,
    sendUpdates: "all",
    requestBody: {
      start: { dateTime: startISO },
      end: { dateTime: endISO }
    }
  });

  return response.data;
}

async function updateCalendarEventStatus(eventId, status) {
  const calendar = await getCalendar();
  if (!calendar || !eventId) return null;

  if (status === "cancelled") {
    await calendar.client.events.delete({
      calendarId: calendar.calendarId,
      eventId,
      sendUpdates: "all"
    });
    return { deleted: true };
  }

  return null;
}

module.exports = {
  testCalendarConnection,
  getBusyRanges,
  createCalendarEvent,
  rescheduleCalendarEvent,
  updateCalendarEventStatus
};
