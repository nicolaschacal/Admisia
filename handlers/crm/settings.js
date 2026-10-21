const { query, withTransaction } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanUrl(value) {
  const raw = clean(value, 1200);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function cleanWeekdays(value, fallback = [1,2,3,4,5]) {
  if (!Array.isArray(value) || !value.length) return fallback;
  const unique = [...new Set(value.map(Number).filter((day) => day >= 1 && day <= 7))];
  return unique.length ? unique : fallback;
}

module.exports = async (req, res) => {
  const manager = requireManager(req, res);
  if (!manager) return;

  if (req.method === "GET") {
    try {
      const result = await query(
        "SELECT key,value FROM crm_settings WHERE key IN ('booking','followup','profile')"
      );
      const settings = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
      return res.status(200).json({ success: true, settings });
    } catch (error) {
      console.error("CRM settings read error:", error);
      return res.status(500).json({ success: false, message: "No se pudo cargar la configuración." });
    }
  }

  if (req.method === "POST") {
    if (manager.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Solo un administrador puede cambiar esta configuración."
      });
    }

    try {
      const booking = req.body?.booking || {};
      const followup = req.body?.followup || {};
      const profile = req.body?.profile || {};

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
        return res.status(400).json({ success: false, message: "Configuración de agenda inválida." });
      }

      const bookingValue = {
        slotMinutes,
        openHour,
        closeHour,
        minDaysAhead,
        maxDaysAhead,
        weekdays: cleanWeekdays(booking.weekdays)
      };

      const profileOpenHour = Number(profile.openHour ?? 8);
      const profileCloseHour = Number(profile.closeHour ?? 18);

      if (
        !Number.isInteger(profileOpenHour) || profileOpenHour < 0 || profileOpenHour > 23 ||
        !Number.isInteger(profileCloseHour) || profileCloseHour <= profileOpenHour || profileCloseHour > 24
      ) {
        return res.status(400).json({ success: false, message: "El horario público del perfil no es válido." });
      }

      const website = cleanUrl(profile.website);
      const instagram = cleanUrl(profile.instagram);
      const facebook = cleanUrl(profile.facebook);
      const logoUrl = cleanUrl(profile.logoUrl);
      if (profile.logoUrl && !logoUrl) {
        return res.status(400).json({ success: false, message: "La dirección del logo no es válida." });
      }

      if (profile.website && !website) {
        return res.status(400).json({ success: false, message: "La URL del sitio web no es válida." });
      }
      if (profile.instagram && !instagram) {
        return res.status(400).json({ success: false, message: "La URL de Instagram no es válida." });
      }
      if (profile.facebook && !facebook) {
        return res.status(400).json({ success: false, message: "La URL de Facebook no es válida." });
      }

      const profileValue = {
        name: clean(profile.name, 160) || "Mi institución",
        category: clean(profile.category, 120) || "Educación",
        shortDescription: clean(profile.shortDescription, 260),
        statusText: clean(profile.statusText, 160),
        addressLine1: clean(profile.addressLine1, 240),
        addressLine2: clean(profile.addressLine2, 240),
        mapQuery: clean(profile.mapQuery, 400),
        phoneDisplay: clean(profile.phoneDisplay, 80),
        phoneE164: clean(profile.phoneE164, 40).replace(/[^+\d]/g, ""),
        email: clean(profile.email, 240),
        website,
        instagram,
        instagramLabel: clean(profile.instagramLabel, 160),
        facebook,
        facebookLabel: clean(profile.facebookLabel, 160),
        openHour: profileOpenHour,
        closeHour: profileCloseHour,
        weekdays: cleanWeekdays(profile.weekdays),
        badgeEnabled: profile.badgeEnabled !== false,
        logoUrl
      };

      if (profileValue.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileValue.email)) {
        return res.status(400).json({ success: false, message: "El correo del perfil no es válido." });
      }

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
        await client.query(
          `INSERT INTO crm_settings(key,value,updated_at)
           VALUES ('profile',$1::jsonb,now())
           ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
          [JSON.stringify(profileValue)]
        );

        const institutionalContent = [
          `Institución: ${profileValue.name}.`,
          "Niveles: Inicial y Primaria.",
          "Inicial comprende propuestas para niños de 1 a 5 años.",
          "Primaria comprende de 1.º a 6.º año.",
          profileValue.addressLine1 || profileValue.addressLine2
            ? `Dirección: ${[profileValue.addressLine1, profileValue.addressLine2].filter(Boolean).join(", ")}.`
            : "",
          profileValue.phoneDisplay ? `Teléfono: ${profileValue.phoneDisplay}.` : "",
          profileValue.instagramLabel ? `Instagram: ${profileValue.instagramLabel}.` : "",
          profileValue.email ? `Correo: ${profileValue.email}.` : "",
          profileValue.website ? `Sitio web: ${profileValue.website}.` : ""
        ].filter(Boolean).join("\n");

        await client.query(
          `UPDATE knowledge_items
           SET content=$1,
               summary=$2,
               updated_by=$3,
               updated_at=now()
           WHERE title='Información general del Colegio Nubarian'`,
          [
            institutionalContent,
            `${profileValue.name} ofrece Inicial y Primaria en Montevideo.`,
            manager.sub
          ]
        );
      });

      return res.status(200).json({ success: true, profile: profileValue });
    } catch (error) {
      console.error("CRM settings update error:", error);
      return res.status(500).json({ success: false, message: "No se pudo guardar la configuración." });
    }
  }

  return res.status(405).json({ success: false, message: "Método no permitido." });
};
