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
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }

  try {
    const { message } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "El mensaje no puede estar vacío." });
    }

    if (message.length > 800) {
      return res.status(400).json({ success: false, message: "La consulta es demasiado larga." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Falta configurar GEMINI_API_KEY en Vercel."
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let googleResponse;

    try {
      googleResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }]
            },
            contents: [
              {
                role: "user",
                parts: [{ text: message.trim() }]
              }
            ],
            generationConfig: {
              maxOutputTokens: 700
            }
          }),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const rawText = await googleResponse.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }

    if (!googleResponse.ok) {
      const providerMessage =
        data?.error?.message ||
        rawText.slice(0, 300) ||
        "Gemini devolvió un error sin detalle.";

      let friendlyMessage = "Gemini devolvió un error.";
      if (googleResponse.status === 400) friendlyMessage = "Gemini rechazó la solicitud.";
      if (googleResponse.status === 401 || googleResponse.status === 403) {
        friendlyMessage = "La clave de Gemini no está autorizada o no es válida.";
      }
      if (googleResponse.status === 404) {
        friendlyMessage = "El modelo de Gemini configurado no está disponible.";
      }
      if (googleResponse.status === 429) {
        friendlyMessage = "Se alcanzó temporalmente el límite de uso de Gemini.";
      }

      return res.status(googleResponse.status).json({
        success: false,
        message: friendlyMessage,
        detail: providerMessage
      });
    }

    const responseText = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!responseText) {
      return res.status(502).json({
        success: false,
        message: "Gemini respondió, pero no devolvió texto utilizable."
      });
    }

    return res.status(200).json({
      success: true,
      response: responseText
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(504).json({
        success: false,
        message: "Gemini demoró demasiado en responder (más de 20 segundos)."
      });
    }

    console.error("Error en /api/chat:", error);

    return res.status(500).json({
      success: false,
      message: "Error interno al comunicarse con Gemini.",
      detail: String(error?.message || "Error desconocido").slice(0, 300)
    });
  }
};
