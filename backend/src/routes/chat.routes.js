const express = require("express");
const { generateResponse, listModels } = require("../services/gemini.service");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "El mensaje no puede estar vacío." });
    }

    if (message.length > 800) {
      return res.status(400).json({ success: false, message: "La consulta es demasiado larga." });
    }

    const response = await generateResponse(message, history);
    res.json({ success: true, response });
  } catch (error) {
    console.error("Error al consultar Gemini:", error.message);
    res.status(500).json({ success: false, message: "No se pudo obtener una respuesta de la IA." });
  }
});

router.get("/models", async (req, res) => {
  try {
    await listModels();
    res.json({ success: true, message: "Modelos mostrados en la consola." });
  } catch (error) {
    console.error("Error al listar modelos:", error.message);
    res.status(500).json({ success: false, message: "No se pudieron obtener los modelos." });
  }
});

module.exports = router;
