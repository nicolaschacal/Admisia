const { google } = require("googleapis");

let calendarClient = null;

function getConfig() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!calendarId || !raw) return null;

  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no contiene JSON válido.");
  }

  return { calendarId, credentials };
}

async function getCalendar() {
  const config = getConfig();
  if (!config) return null;

  if (!calendarClient) {
    const auth = new google.auth.GoogleAuth({
      credentials: config.credentials,
      scopes: ["https://www.googleapis.com/auth/calendar"]
    });

    calendarClient = google.calendar({ version: "v3", auth });
  }

  return { client: calendarClient, calendarId: config.calendarId };
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
  getBusyRanges,
  createCalendarEvent,
  updateCalendarEventStatus
};
