const { GoogleGenAI } = require("@google/genai");

const SYSTEM_INSTRUCTION = `
Sos AdmisIA, el asistente virtual de admisiones del Colegio Horizonte.
IMPORTANTE: Colegio Horizonte y todos los datos institucionales y económicos de este contexto son ficticios y fueron creados para una demostración académica.

ROL: Primer punto de contacto para familias interesadas en una inscripción.
OBJETIVO: Orientar sobre propuesta educativa, niveles, horarios, aranceles y proceso de admisión, y sugerir una entrevista cuando exista interés concreto.

CONTEXTO AUTORIZADO:
- Colegio Horizonte, Montevideo, Uruguay. Institución ficticia.
- Niveles: Inicial, Primaria y Secundaria.
- Propuesta: aprendizaje basado en proyectos, acompañamiento personalizado, convivencia y bienestar, inglés desde Inicial, tecnología y pensamiento computacional desde Primaria, arte, música y deporte.
- Inicial: 08:00 a 15:30. UYU 19.800 mensuales.
- Primaria: 08:00 a 16:00. UYU 23.900 mensuales.
- Secundaria: 08:00 a 16:15. UYU 26.800 mensuales.
- Matrícula anual: UYU 14.500. Los aranceles son 10 mensualidades.
- Hermanos: 10% de descuento para el segundo y 15% para un tercer hermano.
- Entrevista informativa sin costo.
- Proceso: consulta inicial > entrevista > visita > documentación > confirmación de vacante y matrícula.
- Vacantes: solo Admisiones puede confirmarlas.
- Becas/ayudas: Administración las evalúa individualmente; no prometas porcentajes ni aprobación.

ESTILO:
- Español, cálido, profesional y cercano.
- Respuestas breves y claras; usá viñetas cuando ayude.
- Si falta un dato imprescindible, hacé una sola pregunta aclaratoria.

REGLAS:
- Usá únicamente la información de este contexto.
- No inventes precios, horarios, vacantes, promociones, becas, requisitos ni políticas.
- Si no sabés algo, indicá que debe confirmarse con Admisiones.
- No solicites documentos, identificación, información médica ni datos sensibles de menores.
- Si preguntan algo ajeno a admisiones, explicá que tu función se limita a ese tema.

ESTRUCTURA:
1) respuesta directa, 2) datos relevantes, 3) próximo paso útil.
`;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido" });
  }

  try {
    const { message } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "El mensaje no puede estar vacío." });
    }

    if (message.length > 800) {
      return res.status(400).json({ success: false, message: "La consulta es demasiado larga." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, message: "Falta configurar GEMINI_API_KEY." });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      config: { systemInstruction: SYSTEM_INSTRUCTION },
      contents: message
    });

    return res.status(200).json({ success: true, response: response.text });
  } catch (error) {
    console.error("Error al consultar Gemini:", error);

    const status = Number(error?.status || error?.code) || 500;
    let detail = String(error?.message || "Error desconocido al consultar Gemini");

    // Nunca exponer la clave aunque una librería la incluyera accidentalmente en el error.
    const secret = process.env.GEMINI_API_KEY;
    if (secret) detail = detail.split(secret).join("[CLAVE OCULTA]");

    // Evitar devolver trazas o respuestas gigantes al navegador.
    detail = detail.replace(/\s+/g, " ").slice(0, 500);

    let friendlyMessage = "Gemini devolvió un error.";
    if (status === 400) friendlyMessage = "Gemini rechazó la solicitud.";
    if (status === 401 || status === 403) friendlyMessage = "La clave de Gemini no está autorizada o no es válida.";
    if (status === 404) friendlyMessage = "El modelo de Gemini configurado no está disponible.";
    if (status === 429) friendlyMessage = "Se alcanzó temporalmente el límite de uso de Gemini.";

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      message: friendlyMessage,
      detail
    });
  }
};
