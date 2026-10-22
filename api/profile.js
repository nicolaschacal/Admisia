const { getProfile } = require("../lib/profile");
const { getBrochureFile } = require("../lib/capture");
const { vocabFor, typeOptions } = require("../lib/business-types");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }

  // Public brochure uploaded from Configuración → Captación.
  if (req.query?.file === "brochure") {
    try {
      const file = await getBrochureFile();
      if (!file) return res.status(404).json({ success: false, message: "No hay folleto disponible." });
      const buffer = Buffer.from(file.data, "base64");
      const name = String(file.name || "folleto.pdf").replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]/g, "") || "folleto.pdf";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
      return res.status(200).send(buffer);
    } catch (error) {
      console.error("Brochure error:", error);
      return res.status(500).json({ success: false, message: "No se pudo descargar el folleto." });
    }
  }

  const profile = await getProfile();
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
  return res.status(200).json({
    success: true,
    profile,
    vocab: vocabFor(profile.businessType, profile.name),
    businessTypes: typeOptions()
  });
};
