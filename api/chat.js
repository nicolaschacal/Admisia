const { query } = require("../lib/db");
const { retrieveKnowledge, formatKnowledgeContext } = require("../lib/knowledge");
const { getRuntimeConfig } = require("../lib/config");
const { getProfile } = require("../lib/profile");
const {
  loadVisitorMessages,
  persistVisitorMessage,
  getCurrentAppointment
} = require("../lib/visitor-session");

function buildSystemInstruction(profile) {
  const name = profile.name || "la institución";
  const notes = String(profile.assistantNotes || "").trim();
  return `
Sos el asistente virtual de admisiones de ${name}.

OBJETIVO
- Orientar a familias interesadas en inscribirse.
- Responder de forma cálida, natural, precisa y breve.
- Mantener el hilo de la conversación sin volver a presentarte en cada mensaje.
- Cuando corresponda, proponer como siguiente paso una visita o entrevista.
- Si ofrecés una visita o entrevista, preguntá de forma clara si quiere ver horarios disponibles dentro del chat. No derives a teléfono como primer paso cuando la agenda puede gestionarse aquí.

REGLAS
- Respondé siempre en español.
- Usá texto plano: sin Markdown, sin asteriscos y sin encabezados con #.
- Podés usar guiones simples para ordenar información.
- No inventes datos. Tu fuente de verdad es la BASE DE CONOCIMIENTO que se incluye en cada consulta.
- Si la base no contiene un dato exacto, decí que debe confirmarse con Admisiones.
- No presentes valores económicos estimativos como definitivos.
- No supongas vacantes; deben confirmarse con Admisiones.
- Si la familia pregunta por una situación particular que requiere evaluación individual, orientá a una entrevista.
${notes ? `\nINDICACIONES DE ${name.toUpperCase()}\n${notes}\n` : ""}
USO DE LA BASE DE CONOCIMIENTO
- Priorizá la información recuperada por relevancia.
- Combiná varias fuentes si ayudan a responder mejor.
- No menciones al usuario que estás usando una base de conocimiento, RAG, fragmentos o contexto recuperado.
- Si dos fuentes parecen contradecirse, evitá afirmar el dato y sugerí confirmarlo con Admisiones.
`;
}

// When the AI is unavailable, answer with the most relevant item of the
// client's own knowledge base instead of failing.
function knowledgeFallback(items = []) {
  const top = items.find((item) => item?.content);
  if (!top) return null;
  const content = String(top.content).trim();
  const excerpt = content.length > 700 ? `${content.slice(0, 700).replace(/\s+\S*$/, "")}…` : content;
  return `${excerpt}\n\nSi querés, puedo ayudarte a coordinar una visita.`;
}


function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\sº°]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function callGeminiModel({ apiKey, model, contents, systemInstruction, timeoutMs = 6000 }) {
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
            parts: [{ text: systemInstruction }]
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

function isTransientModelError(error) {
  return (
    error?.name === "AbortError" ||
    error?.status === 408 ||
    error?.status === 429 ||
    (Number(error?.status) >= 500 && Number(error?.status) <= 599)
  );
}

function inferSuggestedAction(text) {
  const normalized = normalizeText(text);
  const invitation = /\b(queres|te gustaria|si queres|puedo ayudarte|puedo mostrarte|te muestro|agendamos)\b/.test(normalized);
  const booking = /\b(agendar|coordinar|agenda|horarios disponibles|visita|entrevista)\b/.test(normalized);
  return invitation && booking ? "booking" : null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function askGeminiWithFallback({ apiKey, contents, systemInstruction, model = "gemini-3.1-flash-lite", fallbackModel = "gemini-3.5-flash-lite" }) {
  let done = false;
  let secondaryPromise = null;

  const getSecondary = () => {
    if (!secondaryPromise) {
      secondaryPromise = callGeminiModel({
        apiKey,
        model: fallbackModel,
        contents,
        systemInstruction,
        timeoutMs: 6000
      });
    }
    return secondaryPromise;
  };

  const primary = callGeminiModel({
    apiKey,
    model,
    contents,
    systemInstruction,
    timeoutMs: 6000
  }).catch((error) => {
    if (!isTransientModelError(error)) throw error;
    return getSecondary();
  });

  const hedge = delay(1200).then(() => {
    if (done) return new Promise(() => {});
    return getSecondary();
  });

  try {
    const response = await Promise.any([primary, hedge]);
    done = true;
    return response;
  } catch (aggregateError) {
    done = true;
    const errors = Array.isArray(aggregateError?.errors) ? aggregateError.errors : [];
    throw errors[errors.length - 1] || aggregateError;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }

  try {
    const { message, history = [] } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "El mensaje no puede estar vacío." });
    }

    if (message.length > 900) {
      return res.status(400).json({ success: false, message: "La consulta es demasiado larga." });
    }

    const visitorState = await loadVisitorMessages(req, res, 12);
    const serverHistory = visitorState.messages.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      text: item.content
    }));

    const effectiveHistory = serverHistory.length ? serverHistory : history;

    const safeHistory = Array.isArray(effectiveHistory)
      ? effectiveHistory
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

    const userPersistPromise = persistVisitorMessage(req, res, "user", message.trim());
    const knowledgePromise = retrieveKnowledge(message, effectiveHistory, 6);
    const appointmentPromise = getCurrentAppointment(visitorState.session.lead_id);

    const profilePromise = getProfile();

    const { ai } = await getRuntimeConfig();
    const apiKey = ai.apiKey;

    if (!apiKey) {
      const fallback = knowledgeFallback(await knowledgePromise.catch(() => []));
      await userPersistPromise.catch(() => {});
      if (fallback) {
        await persistVisitorMessage(req, res, "assistant", fallback).catch(() => {});
        return res.status(200).json({ success: true, response: fallback, source: "knowledge-fallback", action: inferSuggestedAction(fallback) });
      }
      return res.status(503).json({
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
    let knowledgeItems = [];

    try {
      const [retrieved, currentAppointment, profile] = await Promise.all([
        knowledgePromise,
        appointmentPromise,
        profilePromise
      ]);
      knowledgeItems = retrieved || [];
      const knowledgeContext = formatKnowledgeContext(knowledgeItems);
      let appointmentContext = "No hay una visita activa vinculada a este navegador.";

      if (currentAppointment) {
        appointmentContext =
          `La familia tiene una visita activa para ${new Date(currentAppointment.start_at).toISOString()}. ` +
          `Estado: ${currentAppointment.status}. Estudiante: ${currentAppointment.student_name || "sin nombre asociado"}. ` +
          "Si pregunta por cambiar o cancelar, explicá que puede hacerlo directamente en este chat.";
      }

      const systemInstruction = `${buildSystemInstruction(profile)}

BASE DE CONOCIMIENTO RELEVANTE PARA ESTA CONSULTA
${knowledgeContext}

SITUACIÓN ACTUAL DE LA FAMILIA
${appointmentContext}`;

      responseText = await askGeminiWithFallback({
        apiKey,
        model: ai.model,
        fallbackModel: ai.fallbackModel,
        contents,
        systemInstruction
      });
    } catch (error) {
      console.error("Gemini fallback agotado:", error?.status, error?.message);

      const fallback = knowledgeFallback(knowledgeItems);
      if (fallback) {
        await Promise.allSettled([
          userPersistPromise,
          persistVisitorMessage(req, res, "assistant", fallback)
        ]);

        return res.status(200).json({
          success: true,
          response: fallback,
          source: "knowledge-fallback",
          action: inferSuggestedAction(fallback)
        });
      }

      await userPersistPromise.catch(() => {});

      return res.status(503).json({
        success: false,
        message: "El asistente está momentáneamente ocupado. Probá nuevamente en unos segundos."
      });
    }

    await Promise.allSettled([
      userPersistPromise,
      persistVisitorMessage(req, res, "assistant", responseText)
    ]);

    return res.status(200).json({
      success: true,
      response: responseText,
      source: "gemini",
      action: inferSuggestedAction(responseText)
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
