const { query, withTransaction } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");

module.exports = async (req, res) => {
  const manager = requireManager(req, res);
  if (!manager) return;

  if (req.method === "GET") {
    try {
      const result = await query("SELECT key,value FROM crm_settings WHERE key IN ('booking','followup')");
      const settings = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
      return res.status(200).json({ success: true, settings });
    } catch (error) {
      console.error("CRM settings read error:", error);
      return res.status(500).json({ success: false, message: "No se pudo cargar la configuración." });
    }
  }

  if (req.method === "POST") {
    if (manager.role !== "admin") {
      return res.status(403).json({ success: false, message: "Solo un administrador puede cambiar esta configuración." });
    }

    try {
      const booking = req.body?.booking || {};
      const followup = req.body?.followup || {};

      const openHour = Number(booking.openHour);
      const closeHour = Number(booking.closeHour);
      const slotMinutes = Number(booking.slotMinutes);
      const minDaysAhead = Number(booking.minDaysAhead);
      const maxDaysAhead = Number(booking.maxDaysAhead);
      const daysAfterInterview = Number(followup.daysAfterInterview);

      if (
        !Number.isInteger(openHour) || openHour < 0 || openHour > 23 ||
        !Number.isInteger(closeHour) || closeHour < openHour || closeHour > 23 ||
        ![15,20,30,45,60].includes(slotMinutes) ||
        !Number.isInteger(minDaysAhead) || minDaysAhead < 0 || minDaysAhead > 30 ||
        !Number.isInteger(maxDaysAhead) || maxDaysAhead < minDaysAhead || maxDaysAhead > 180 ||
        !Number.isInteger(daysAfterInterview) || daysAfterInterview < 0 || daysAfterInterview > 60
      ) {
        return res.status(400).json({ success: false, message: "Configuración inválida." });
      }

      const bookingValue = {
        slotMinutes,
        openHour,
        closeHour,
        minDaysAhead,
        maxDaysAhead,
        weekdays: Array.isArray(booking.weekdays) && booking.weekdays.length
          ? booking.weekdays.map(Number).filter((d) => d >= 1 && d <= 7)
          : [1,2,3,4,5]
      };

      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO crm_settings(key,value,updated_at)
           VALUES ('booking',$1::jsonb,now())
           ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
          [JSON.stringify(bookingValue)]
        );
        await client.query(
          `INSERT INTO crm_settings(key,value,updated_at)
           VALUES ('followup',$1::jsonb,now())
           ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
          [JSON.stringify({ daysAfterInterview })]
        );
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("CRM settings update error:", error);
      return res.status(500).json({ success: false, message: "No se pudo guardar la configuración." });
    }
  }

  return res.status(405).json({ success: false, message: "Método no permitido." });
};
