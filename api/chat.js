const { query } = require("../lib/db");

async function persistMessage(sessionId, role, content, leadId = null) {
  if (!process.env.DATABASE_URL || !sessionId || !content) return;
  try {
    const session = await query(
      `INSERT INTO conversation_sessions (session_key, lead_id, last_message_at)
       VALUES ($1,$2,now())
       ON CONFLICT (session_key)
       DO UPDATE SET last_message_at=now(), lead_id=COALESCE(conversation_sessions.lead_id, EXCLUDED.lead_id)
       RETURNING id`,
      [String(sessionId).slice(0,200), leadId]
    );
    await query(
      `INSERT INTO conversation_messages (conversation_id, role, content)
       VALUES ($1,$2,$3)`,
      [session.rows[0].id, role, String(content).slice(0,5000)]
    );
  } catch (error) {
    console.error("No se pudo persistir el mensaje del chat:", error.message);
  }
}

const SYSTEM_INSTRUCTION = "\nSos el asistente virtual de admisiones del Colegio Nubarian.\nTu función es orientar a familias interesadas exclusivamente en los niveles Inicial y Primaria.\n\nIMPORTANTE\n- Respondé siempre en español.\n- Usá un tono cálido, profesional, claro y cercano.\n- Respondé en texto plano, sin Markdown, sin asteriscos y sin encabezados con #.\n- Podés usar guiones simples para enumerar.\n- Si ya existe historial de conversación, continuá naturalmente y no vuelvas a presentarte o saludar en cada respuesta.\n- No inventes datos que no estén en este contexto.\n- No menciones Secundaria: el Colegio Nubarian ofrece Inicial y Primaria.\n\nCONTEXTO INSTITUCIONAL AUTORIZADO\n- Institución: Colegio Nubarian, Montevideo, Uruguay.\n- Niveles: Inicial y Primaria.\n- Inicial comprende propuestas para niños de 1 a 5 años e incluye Maternal, modalidad de medio horario y tiempo completo.\n- Primaria comprende de 1º a 6º año.\n- La propuesta educativa integra tradición, innovación y dinamismo.\n- Busca una formación integral basada en el disfrute, la curiosidad y la felicidad de aprender.\n- La propuesta incluye inglés con certificación ANGLO, Educación Física y Deportes, arte y expresión, informática, robótica, ciencias, matemática y experiencias STEAM.\n- El colegio cuenta con un equipo interdisciplinario integrado por psicóloga, psicomotricista y psicopedagoga, que trabaja junto a docentes, Dirección y familias.\n- El vínculo cercano con las familias es un componente central.\n- Las instalaciones fueron diseñadas para la función educativa: salones amplios e iluminados, espacios artísticos y expresivos, sala de tecnologías, laboratorio, áreas al aire libre, comedor, cocina y complejo deportivo integrado al predio.\n- El servicio de alimentación al mediodía es opcional en los niveles que correspondan.\n- Dirección: Agraciada 2850, Montevideo, Uruguay.\n- Teléfono: 2208 0628.\n- Instagram: @colegionubarian.\n- Correo: nubarian@nubarian.edu.uy.\n- Sitio web: https://nubarian.edu.uy.\n\nHORARIOS Y MODALIDADES\n- Primaria: jornada completa. Horario de referencia: 8:00 a 17:00.\n- Inicial: modalidad medio horario y tiempo completo.\n- Inicial medio horario: referencia de 5 horas.\n- Maternal, dentro de Inicial: modalidades medio horario de 3 a 4 horas, intermedio de 5 a 6 horas y completo de 7 a 9 horas.\n- Extensión horaria de 17:00 a 18:00, disponible a partir de nivel 2. Costo de referencia: UYU 2.000.\n- Si piden un horario exacto de entrada y salida según nivel, aclarales que puede variar según la modalidad y que lo ideal es confirmarlo en la entrevista o visita.\n\nPOLÍTICA ECONÓMICA\n- Por política interna, el colegio no ofrece el detalle económico definitivo por WhatsApp o chat.\n- Se prefiere informar el detalle completo luego de que la familia conozca las instalaciones y la propuesta.\n- Sí podés compartir valores estimativos de referencia, dejando claro que son orientativos y que la información final se confirma con Admisiones.\n- Nunca presentes los importes como definitivos.\n\nVALORES ESTIMATIVOS DE REFERENCIA 2026\n- Matrícula: UYU 10.500. Puede abonarse hasta en 4 cuotas.\n- Primaria completo:\n  - Cuota educativa mensual estimativa: UYU 29.600.\n  - Servicio de alimentación mensual estimativo: UYU 5.700.\n  - Anualidad educativa estimativa: UYU 355.200.\n  - Anualidad de alimentación estimativa: UYU 57.000.\n  - Anualidad materiales estimativa: UYU 5.100.\n- Inicial medio horario, 5 horas:\n  - Cuota educativa mensual estimativa: UYU 19.500.\n  - Servicio de alimentación mensual estimativo: UYU 4.800.\n  - Anualidad educativa estimativa: UYU 234.000.\n  - Anualidad de alimentación estimativa: UYU 48.000.\n  - Anualidad materiales estimativa: UYU 4.050.\n- Inicial completo:\n  - Cuota educativa mensual estimativa: UYU 27.700.\n  - Servicio de alimentación mensual estimativo: UYU 4.800.\n  - Anualidad educativa estimativa: UYU 332.400.\n  - Anualidad de alimentación estimativa: UYU 48.000.\n  - Anualidad materiales estimativa: UYU 5.100.\n- Maternal medio horario, 3 a 4 horas:\n  - Cuota educativa mensual estimativa: UYU 16.800.\n  - Alimentación: no aplica.\n  - Anualidad educativa estimativa: UYU 201.600.\n  - Materiales estimativos: UYU 3.000.\n- Maternal intermedio, 5 a 6 horas:\n  - Cuota educativa mensual estimativa: UYU 21.700.\n  - Alimentación: no aplica.\n  - Anualidad educativa estimativa: UYU 260.400.\n  - Materiales estimativos: UYU 3.000.\n- Maternal completo, 7 a 9 horas:\n  - Cuota educativa mensual estimativa: UYU 27.200.\n  - Alimentación: no aplica.\n  - Anualidad educativa estimativa: UYU 326.400.\n  - Materiales estimativos: UYU 3.000.\n\nPROCESO DE INSCRIPCIÓN\n- Primera consulta.\n- Coordinación de entrevista y recorrida.\n- Presentación de la propuesta educativa e instalaciones.\n- Orientación sobre vacante, documentación y pasos administrativos.\n- Confirmación de inscripción.\n\nREGLAS DE RESPUESTA\n- Si preguntan por costos, empezá aclarando la política interna: el detalle definitivo se comparte luego de conocer el colegio.\n- Después, si corresponde, ofrecé valores estimativos de referencia en formato breve y ordenado.\n- Si preguntan por vacantes, decí que deben confirmarse con el equipo de Admisiones.\n- Si preguntan por apoyos específicos o situaciones particulares, explicá que el colegio cuenta con acompañamiento cercano y equipo interdisciplinario, pero que cada caso se conversa mejor en una entrevista personal.\n- Si no sabés un dato exacto, decí que debe confirmarse con el equipo del colegio.\n- Cerrá normalmente con un próximo paso útil, idealmente invitar a coordinar una visita o entrevista.\n";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }

  try {
    const { message, history = [], sessionId = null } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "El mensaje no puede estar vacío." });
    }

    if (message.length > 900) {
      return res.status(400).json({ success: false, message: "La consulta es demasiado larga." });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((item) =>
            item &&
            (item.role === "user" || item.role === "model") &&
            typeof item.text === "string" &&
            item.text.trim()
          )
          .slice(-10)
          .map((item) => ({
            role: item.role,
            parts: [{ text: item.text.trim().slice(0, 1400) }]
          }))
      : [];

    await persistMessage(sessionId, "user", message.trim());

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
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
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
              ...safeHistory,
              {
                role: "user",
                parts: [{ text: message.trim() }]
              }
            ],
            generationConfig: {
              maxOutputTokens: 700,
              temperature: 0.6
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
      .replace(/\*\*/g, "")
      .trim();

    if (!responseText) {
      return res.status(502).json({
        success: false,
        message: "Gemini respondió, pero no devolvió texto utilizable."
      });
    }

    await persistMessage(sessionId, "assistant", responseText);

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
