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


function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\sº°]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function conversationText(message, history) {
  const previous = Array.isArray(history)
    ? history
        .filter((item) => item?.role === "user" && typeof item.text === "string")
        .slice(-4)
        .map((item) => item.text)
        .join(" ")
    : "";

  return normalizeText(`${previous} ${message}`);
}

function getInstantAnswer(message, history = []) {
  const current = normalizeText(message);
  const context = conversationText(message, history);

  const mentionsPrimaria = /\bprimaria\b|\b[1-6](?:ro|do|to|º|°)?\s*(?:ano|grado)\b/.test(context);
  const mentionsInicial = /\binicial\b|\bmaternal\b|\bnivel\s*[1-5]\b/.test(context);

  if (
    /\b(2do|2º|2°|segundo)\s*(ano|grado)?\b/.test(current) &&
    (/primaria/.test(current) || mentionsPrimaria)
  ) {
    return "Sí. El Colegio Nubarian ofrece Primaria de 1.º a 6.º año, por lo que cuenta con 2.º año de Primaria. Si querés, también puedo contarte sobre la propuesta, el horario o darte una orientación estimativa de costos.";
  }

  if (/\b(que niveles|niveles tienen|tienen primaria|ofrecen primaria|hasta que ano|que grados)\b/.test(current)) {
    return "El Colegio Nubarian ofrece Inicial y Primaria. Inicial comprende propuestas para niños de 1 a 5 años, y Primaria abarca de 1.º a 6.º año.";
  }

  if (/\b(donde|direccion|ubicad|telefono|correo|email|instagram|contact)\b/.test(current)) {
    return [
      "El Colegio Nubarian se encuentra en Agraciada 2850, Montevideo.",
      "",
      "Podés contactarte por:",
      "- Teléfono: 2208 0628",
      "- Correo: nubarian@nubarian.edu.uy",
      "- Instagram: @colegionubarian",
      "- Sitio web: https://nubarian.edu.uy",
      "",
      "Si querés conocer las instalaciones, también puedo ayudarte a coordinar una visita."
    ].join("\n");
  }

  if (/\b(horario|hora de entrada|hora de salida|jornada)\b/.test(current)) {
    if (mentionsPrimaria) {
      return "En Primaria la modalidad es de jornada completa, con horario de referencia de 8:00 a 17:00. También existe extensión horaria de 17:00 a 18:00. El horario definitivo se confirma con Admisiones.";
    }
    if (mentionsInicial) {
      return "En Inicial existen distintas modalidades según la edad y la propuesta: medio horario, intermedio en Maternal y tiempo completo. Si me decís la edad o el nivel del niño o niña, puedo orientarte mejor.";
    }
    return "Los horarios dependen del nivel y la modalidad. En Primaria la referencia es de 8:00 a 17:00; en Inicial hay opciones de medio horario y tiempo completo. Si me indicás el nivel, te doy el detalle correspondiente.";
  }

  if (/\b(precio|precios|cuota|costo|costos|sale|matricula|arancel)\b/.test(current)) {
    if (mentionsPrimaria) {
      return [
        "Por política interna, el Colegio Nubarian brinda el detalle económico definitivo luego de que la familia conozca la propuesta y las instalaciones.",
        "",
        "Como referencia estimativa 2026 para Primaria:",
        "- Cuota educativa mensual: UYU 29.600",
        "- Alimentación mensual: UYU 5.700",
        "- Matrícula: UYU 10.500, abonable hasta en 4 cuotas",
        "",
        "Estos importes son orientativos y deben confirmarse con Admisiones."
      ].join("\n");
    }
    if (mentionsInicial) {
      return [
        "Por política interna, el detalle económico definitivo se informa luego de conocer la propuesta y las instalaciones.",
        "",
        "Como referencia 2026, Inicial tiene distintas modalidades:",
        "- Medio horario (5 h): UYU 19.500 mensuales",
        "- Tiempo completo: UYU 27.700 mensuales",
        "- Matrícula: UYU 10.500, abonable hasta en 4 cuotas",
        "",
        "En Maternal los valores varían según la cantidad de horas. Si me indicás la edad o modalidad, te doy la referencia correspondiente."
      ].join("\n");
    }
    return "Podemos darte una orientación estimativa, aunque por política interna el detalle económico definitivo se comparte luego de conocer el colegio. Decime si te interesa Inicial o Primaria y te paso una referencia.";
  }

  if (/\b(inscripcion|inscribir|proceso de ingreso|como ingreso|como anoto)\b/.test(current)) {
    return [
      "El proceso de admisión comienza con una primera consulta y luego una entrevista o visita al colegio.",
      "",
      "Después de conocer la propuesta y las instalaciones, el equipo de Admisiones orienta sobre vacante, documentación y pasos administrativos. La vacante siempre debe ser confirmada por el colegio.",
      "",
      "Si querés, puedo ayudarte a coordinar una visita."
    ].join("\n");
  }

  if (/\b(propuesta educativa|metodologia|educacion|ensenanza|como trabajan)\b/.test(current)) {
    return [
      "La propuesta del Colegio Nubarian integra tradición, innovación y dinamismo, buscando el desarrollo integral y el disfrute por aprender.",
      "",
      "Incluye inglés con certificación ANGLO, Educación Física y Deportes, arte y expresión, informática, robótica, ciencias, matemática y experiencias STEAM, junto con un vínculo cercano con las familias."
    ].join("\n");
  }

  if (/\b(psicolog|psicopedagog|psicomotric|equipo interdisciplinario|apoyo|discapacidad|necesidades especiales)\b/.test(current)) {
    return "El colegio cuenta con un equipo interdisciplinario integrado por psicóloga, psicomotricista y psicopedagoga, que trabaja junto a docentes, Dirección y familias. Las necesidades particulares se conversan de forma individual en una entrevista para evaluar el acompañamiento adecuado.";
  }

  if (/\b(instalaciones|laboratorio|comedor|deporte|patio|infraestructura)\b/.test(current)) {
    return "El Colegio Nubarian cuenta con salones amplios e iluminados, espacios artísticos, sala de tecnologías, laboratorio, áreas al aire libre, comedor, cocina y un complejo deportivo integrado al predio. Si querés conocerlos personalmente, puedo ayudarte a coordinar una visita.";
  }

  if (/\b(ingles|anglo|robotica|steam|tecnologia)\b/.test(current)) {
    return "La propuesta incluye inglés con certificación ANGLO, informática, robótica y experiencias STEAM, además de ciencias, matemática, arte, expresión, Educación Física y Deportes.";
  }

  return null;
}

async function callGeminiModel({ apiKey, model, contents, timeoutMs = 6500 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
          contents,
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.45
          }
        }),
        signal: controller.signal
      }
    );

    const rawText = await response.text();
    let data = null;

    try {
      data = JSON.parse(rawText);
    } catch {}

    if (!response.ok) {
      const error = new Error(data?.error?.message || "Gemini no pudo responder.");
      error.status = response.status;
      throw error;
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .replace(/\*\*/g, "")
      .trim();

    if (!text) {
      const error = new Error("Gemini respondió sin texto utilizable.");
      error.status = 502;
      throw error;
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function askGeminiWithFallback({ apiKey, contents }) {
  const models = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash"
  ];

  let lastError;

  for (const model of models) {
    try {
      return await callGeminiModel({ apiKey, model, contents, timeoutMs: 6500 });
    } catch (error) {
      lastError = error;
      const transient =
        error?.name === "AbortError" ||
        error?.status === 408 ||
        error?.status === 429 ||
        (Number(error?.status) >= 500 && Number(error?.status) <= 599);

      if (!transient) throw error;
    }
  }

  throw lastError || new Error("No se pudo obtener respuesta de Gemini.");
}

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

    const userPersistPromise = persistMessage(sessionId, "user", message.trim());

    const instantAnswer = getInstantAnswer(message, history);

    if (instantAnswer) {
      await Promise.allSettled([
        userPersistPromise,
        persistMessage(sessionId, "assistant", instantAnswer)
      ]);

      return res.status(200).json({
        success: true,
        response: instantAnswer,
        source: "institutional"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "El asistente no está disponible en este momento."
      });
    }

    const contents = [
      ...safeHistory,
      {
        role: "user",
        parts: [{ text: message.trim() }]
      }
    ];

    let responseText;

    try {
      responseText = await askGeminiWithFallback({
        apiKey,
        contents
      });
    } catch (error) {
      console.error("Gemini fallback agotado:", error?.status, error?.message);

      await userPersistPromise.catch(() => {});

      return res.status(503).json({
        success: false,
        message: "El asistente está momentáneamente ocupado. Probá nuevamente en unos segundos."
      });
    }

    await Promise.allSettled([
      userPersistPromise,
      persistMessage(sessionId, "assistant", responseText)
    ]);

    return res.status(200).json({
      success: true,
      response: responseText,
      source: "gemini"
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
