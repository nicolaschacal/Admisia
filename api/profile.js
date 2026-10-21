const { query } = require("../lib/db");

const DEFAULT_PROFILE = {
  name: "Colegio Nubarian",
  category: "Educación",
  shortDescription: "Colegio Nubarian · Inicial y Primaria",
  statusText: "Inscripciones abiertas",
  addressLine1: "Av. Agraciada 2850",
  addressLine2: "11800 Montevideo, Uruguay",
  mapQuery: "Av. Agraciada 2850 Montevideo Uruguay",
  phoneDisplay: "2208 0628",
  phoneE164: "+59822080628",
  email: "nubarian@nubarian.edu.uy",
  website: "https://nubarian.edu.uy",
  instagram: "https://www.instagram.com/colegionubarian/",
  instagramLabel: "@colegionubarian",
  facebook: "https://www.facebook.com/colegionubarian/",
  facebookLabel: "Colegio Nubarian",
  openHour: 8,
  closeHour: 18,
  weekdays: [1,2,3,4,5],
  badgeEnabled: true
};

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }

  try {
    const result = await query("SELECT value FROM crm_settings WHERE key='profile' LIMIT 1");
    const profile = {
      ...DEFAULT_PROFILE,
      ...(result.rows[0]?.value || {})
    };

    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error("Public profile read error:", error);
    return res.status(200).json({ success: true, profile: DEFAULT_PROFILE });
  }
};
