const { requireManager } = require("../../lib/auth");
const { analyzeLead } = require("../../lib/lead-ai");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }
  if (!requireManager(req, res)) return;

  try {
    const id = String(req.body?.id || "");
    if (!id) return res.status(400).json({ success: false, message: "Falta id." });

    const lead = await analyzeLead(id);
    return res.status(200).json({ success: true, lead });
  } catch (error) {
    console.error("AI lead analysis error:", error);
    return res.status(500).json({ success: false, message: error.message || "No se pudo analizar el candidato." });
  }
};
