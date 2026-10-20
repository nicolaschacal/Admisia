const { listAvailableSlots } = require("../../lib/scheduling");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({
        success: false,
        message: "La agenda todavía no está conectada a la base de datos."
      });
    }

    const days = Math.min(Math.max(Number(req.query?.days || 5), 1), 10);
    const fromDate = req.query?.from || null;
    const availability = await listAvailableSlots({ days, fromDate });

    return res.status(200).json({
      success: true,
      availability
    });
  } catch (error) {
    console.error("Error consultando disponibilidad:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo consultar la agenda."
    });
  }
};
