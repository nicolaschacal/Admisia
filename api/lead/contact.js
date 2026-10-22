const { getProfile } = require("../../lib/profile");
const { vocabFor } = require("../../lib/business-types");
const { persistVisitorMessage } = require("../../lib/visitor-session");
const { analyzeLead } = require("../../lib/lead-ai");
const {
  getCaptureSettings,
  getBrochureLink,
  captureLead,
  notifyCapture,
  normalizePhone,
  isValidEmail
} = require("../../lib/capture");

const REASONS = ["info", "vacancy", "brochure", "callback"];
const SETTING_FOR_REASON = { info: "contactOffer", vacancy: "vacancyAlerts", brochure: "brochure", callback: "callback" };

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function confirmation(reason, { name, brochureLink, hasEmail, vocab }) {
  const hi = firstName(name) ? `Gracias, ${firstName(name)}.` : "Gracias.";
  const team = vocab.team;
  switch (reason) {
    case "callback": return `${hi} Le pasé tu pedido al equipo de ${team} y te van a llamar en el horario que elegiste.`;
    case "vacancy": return `${hi} ${vocab.vacancyConfirm}`;
    case "brochure":
      return brochureLink
        ? `${hi} ${hasEmail ? "Te mandé el folleto por correo y también" : "Te"} lo dejo acá para que lo descargues.`
        : `${hi} El equipo de ${team} te va a enviar el folleto.`;
    default: return `${hi} El equipo de ${team} te va a escribir con la información. Mientras tanto, podés seguir preguntándome lo que necesites.`;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ success: false, message: "El registro de contactos no está disponible." });
  }

  try {
    const body = req.body || {};
    const reason = REASONS.includes(body.reason) ? body.reason : "info";
    const settings = await getCaptureSettings();
    if (settings[SETTING_FOR_REASON[reason]] === false) {
      return res.status(403).json({ success: false, message: "Esta opción no está disponible." });
    }

    const name = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);
    const email = isValidEmail(body.email) ? String(body.email).trim() : "";

    if (!name) return res.status(400).json({ success: false, message: "Contanos tu nombre." });
    if (body.phone && !phone) return res.status(400).json({ success: false, message: "El teléfono no parece válido." });
    if (body.email && !email) return res.status(400).json({ success: false, message: "El correo no parece válido." });
    if (reason === "callback" && !phone) return res.status(400).json({ success: false, message: "Necesitamos un teléfono para llamarte." });
    if (reason === "brochure" && !email && !phone) return res.status(400).json({ success: false, message: "Dejanos un correo para mandarte el folleto." });
    if (!phone && !email) return res.status(400).json({ success: false, message: "Dejanos un teléfono o un correo." });
    if (body.consent !== true && body.consent !== "true") {
      return res.status(400).json({ success: false, message: "Necesitamos tu autorización para contactarte." });
    }

    const detail = reason === "callback" ? String(body.bestTime || "").slice(0, 80) : "";
    const captured = await captureLead(req, res, {
      source: reason,
      name,
      phone,
      email,
      detail,
      consent: true,
      utm: body
    });

    const [profile, brochureLink] = await Promise.all([
      getProfile(),
      reason === "brochure" ? getBrochureLink(req, settings) : ""
    ]);

    const message = confirmation(reason, { name, brochureLink, hasEmail: Boolean(captured.lead.email), vocab: vocabFor(profile.businessType, profile.name) });

    await Promise.allSettled([
      persistVisitorMessage(req, res, "assistant", message, captured.lead.id),
      notifyCapture(req, captured, { brochureLink, schoolName: profile.name }),
      // Same analysis the panel shows for visits: interest, concern, next step.
      Promise.race([analyzeLead(captured.lead.id), new Promise((resolve) => setTimeout(resolve, 8000))])
    ]);

    return res.status(201).json({ success: true, message, brochureUrl: brochureLink || null });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
    console.error("Error registrando contacto:", error);
    return res.status(500).json({ success: false, message: "No se pudieron guardar tus datos. Probá de nuevo." });
  }
};
