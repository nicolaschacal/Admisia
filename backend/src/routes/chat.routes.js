const express = require("express");
const { generateResponse } = require("../services/gemini.service");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "El mensaje no puede estar vacío." });
    }

    if (message.length > 900) {
      return res.status(400).json({ success: false, message: "La consulta es demasiado larga." });
    }

    const response = await generateResponse(message, history);
    return res.json({ success: true, response });
  } catch (error) {
    console.error("Error al consultar Gemini:", error);
    return res.status(500).json({ success: false, message: "No se pudo obtener una respuesta de la IA." });
  }
});

module.exports = router;
