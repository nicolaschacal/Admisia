const { query } = require("../lib/db");
const { retrieveKnowledge, formatKnowledgeContext } = require("../lib/knowledge");
const { getRuntimeConfig } = require("../lib/config");
const { getProfile } = require("../lib/profile");
const {
  loadVisitorMessages,
  persistVisitorMessage,
  getCurrentAppointment
} = require("../lib/visitor-session");
const {
  ensureCaptureSchema,
  getCaptureSettings,
  getBrochureMeta,
  detectContact,
  captureLead,
  notifyCapture
} = require("../lib/capture");
const { analyzeLead } = require("../lib/lead-ai");

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
- Si la familia pide expresamente que la llamen o hablar con una persona, eso tiene prioridad: no insistas con la visita.

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


const CONTACT_TAGS = { info: "info", vacantes: "vacancy", folleto: "brochure", llamada: "callback" };
const CONTACT_TAG_RE = /\[\[\s*CONTACTO\s*:\s*([a-záéíóú]+)\s*\]\]/i;

// Phrases that mean the assistant offered to keep in touch (used when the
// model forgets the tag, and to avoid offering twice in a row).
const OFFER_RE = /\b(te (lo |la |los )?(mand|envi)\w*|te aviso|te avisamos|te (llam|contact)\w*|dejame tu|pasame tu|dejanos tu|tu (numero|correo|mail|whatsapp|telefono))\b/;

// "¿Me pueden llamar?", "prefiero hablarlo por teléfono", "quiero hablar con alguien"…
const CALLBACK_RE = /\b(llamenme|llamame|llamarme|me llamen|me (pueden|podrian|podes|puede|podran|podrias) llamar|(prefiero|mejor|quiero) (hablarlo |hablar |que sea )?por telefono|hablar con (alguien|una persona))\b/;
function wantsCallback(message) {
  return CALLBACK_RE.test(normalizeText(message));
}

function buildCaptureInstruction(capture, { hasLead, brochureAvailable, userTurns, callbackRequested }) {
  if (callbackRequested) {
    return `
PEDIDO DE LLAMADA
- La familia pidió que la llamen o prefiere hablarlo por teléfono. Respetalo: no insistas con la visita ni con la entrevista.
- Respondé en una o dos frases cálidas que con gusto alguien de Admisiones la llama y que confirme su teléfono y el mejor horario en el formulario que aparece debajo.
`;
  }
  if (hasLead) {
    return "\nCONTACTO\n- Ya tenemos los datos de contacto de esta familia. No se los pidas de nuevo. Si pide que la llamen, nunca le insistas con la visita.\n";
  }
  const options = [];
  if (capture.contactOffer) options.push('- [[CONTACTO:info]] cuando la familia mostró interés concreto (cuotas, niveles, propuesta, horarios, inscripción) pero no agenda: ofrecé que Admisiones le mande la información por WhatsApp o correo.');
  if (capture.vacancyAlerts) options.push(`- [[CONTACTO:vacantes]] cuando pregunta por vacantes, cupos, lista de espera, fechas de inscripción o el año próximo: ofrecé avisarle apenas haya novedades.${capture.vacancyText ? ` Dato oficial para responder: "${String(capture.vacancyText).slice(0, 400)}".` : ""}`);
  if (capture.brochure && brochureAvailable) options.push("- [[CONTACTO:folleto]] cuando pide más detalle de la propuesta, un folleto, PDF, lista de útiles o material para leer: ofrecé mandarle el folleto.");
  if (capture.callback) options.push("- [[CONTACTO:llamada]] cuando pide hablar con una persona, que la llamen o prefiere conversarlo por teléfono: ofrecé que Admisiones la llame.");
  if (!options.length) return "";

  return `
CAPTACIÓN DE CONTACTO
- Objetivo secundario: que las familias interesadas que todavía no agendan una visita dejen un contacto para que Admisiones las acompañe.
- Si la familia quiere conocer el colegio, la visita tiene prioridad sobre las demás ofertas (salvo que pida que la llamen).
- ${userTurns < 1 ? "Todavía es muy temprano en la conversación: NO ofrezcas dejar datos en esta respuesta, salvo que la familia pida expresamente que la llamen." : "Podés hacer un ofrecimiento si encaja naturalmente con lo que preguntó."}
- Respondé primero la consulta completa. El ofrecimiento va al final, en una sola frase, como algo útil y nunca como condición.
- Si ya lo ofreciste antes o la familia dijo que no, no lo repitas.
- No pidas los datos ni enumeres campos: la familia los completa en un formulario que aparece en el chat.
- Cuando hagas un ofrecimiento, agregá al final, en una línea aparte, una sola de estas etiquetas exactas (la familia no la ve):
${options.join("\n")}
- No uses las etiquetas en ningún otro caso.
- Si la familia escribe su teléfono o su correo por su cuenta, agradecé y confirmá que Admisiones la va a contactar.
`;
}

function extractContactAction(text) {
  const match = String(text || "").match(CONTACT_TAG_RE);
  const clean = String(text || "").replace(new RegExp(CONTACT_TAG_RE.source, "gi"), "").replace(/[ \t]+\n/g, "\n").trim();
  const reason = match ? CONTACT_TAGS[normalizeText(match[1])] || "info" : null;
  return { text: clean, reason };
}

function inferContactReason(text) {
  const normalized = normalizeText(text);
  if (!OFFER_RE.test(normalized)) return null;
  if (/\b(llam|telefon)/.test(normalized)) return "callback";
  if (/\b(folleto|pdf|material)\b/.test(normalized)) return "brochure";
  if (/\b(vacante|cupo|inscripcion|lista de espera)/.test(normalized)) return "vacancy";
  if (/\b(informacion|detalle|propuesta|cuota)/.test(normalized)) return "info";
  return null;
}

const SETTING_FOR_REASON = { info: "contactOffer", vacancy: "vacancyAlerts", brochure: "brochure", callback: "callback" };

// Decides which action the chat shows under the assistant reply.
function resolveAction(responseText, { capture, hasLead, hasAppointment, brochureAvailable, userTurns, previousAssistant, callbackRequested }) {
  const tagged = extractContactAction(responseText);
  if (callbackRequested) return { text: tagged.text, action: "contact:callback", openContact: true };
  const booking = inferSuggestedAction(tagged.text);
  let reason = tagged.reason || inferContactReason(tagged.text);

  if (reason) {
    const enabled = capture[SETTING_FOR_REASON[reason]] !== false && (reason !== "brochure" || brochureAvailable);
    // Asking to be called is the family's own request: always honour it.
    const offeredBefore = reason !== "callback" && previousAssistant.slice(-3).some((text) => OFFER_RE.test(normalizeText(text)));
    const tooEarly = userTurns < 1 && reason !== "callback";
    if (!enabled || hasLead || offeredBefore || tooEarly) reason = null;
  }

  const action = booking && !hasAppointment ? "booking" : reason ? `contact:${reason}` : booking;
  return { text: tagged.text, action };
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
    const { message, history = [], utmSource, utmMedium, utmCampaign } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "El mensaje no puede estar vacío." });
    }

    if (message.length > 900) {
      return res.status(400).json({ success: false, message: "La consulta es demasiado larga." });
    }

    const [visitorState, capture] = await Promise.all([
      loadVisitorMessages(req, res, 12),
      getCaptureSettings(),
      ensureCaptureSchema()
    ]);
    const serverHistory = visitorState.messages.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      text: item.content
    }));

    const effectiveHistory = serverHistory.length ? serverHistory : history;
    const userTurns = visitorState.messages.filter((item) => item.role === "user").length;
    const previousAssistant = visitorState.messages.filter((item) => item.role === "assistant").map((item) => item.content);

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

    // A phone or email typed in the conversation becomes a lead right away.
    let leadId = visitorState.session.lead_id || null;
    let justCaptured = null;
    const found = capture.autoDetect !== false ? detectContact(message) : { phone: "", email: "" };
    if (found.phone || found.email) {
      try {
        await userPersistPromise;
        justCaptured = await captureLead(req, res, {
          source: "detected",
          phone: found.phone,
          email: found.email,
          utm: { utmSource, utmMedium, utmCampaign }
        });
        leadId = justCaptured.lead.id;
      } catch (error) {
        console.error("No se pudo registrar el contacto detectado:", error.message);
      }
    }

    const afterCapture = justCaptured
      ? Promise.allSettled([
          justCaptured.created ? notifyCapture(req, justCaptured) : null,
          Promise.race([analyzeLead(justCaptured.lead.id), delay(9000)])
        ])
      : Promise.resolve();

    const knowledgePromise = retrieveKnowledge(message, effectiveHistory, 6);
    const appointmentPromise = getCurrentAppointment(leadId);
    const brochurePromise = capture.brochure ? getBrochureMeta() : Promise.resolve(null);

    const profilePromise = getProfile();

    const { ai } = await getRuntimeConfig();
    const apiKey = ai.apiKey;

    const actionContext = async () => ({
      capture,
      hasLead: Boolean(leadId),
      hasAppointment: Boolean(await appointmentPromise.catch(() => null)),
      brochureAvailable: Boolean((await brochurePromise.catch(() => null)) || capture.brochureUrl),
      userTurns,
      previousAssistant,
      callbackRequested: capture.callback !== false && wantsCallback(message)
    });

    if (!apiKey) {
      const fallback = knowledgeFallback(await knowledgePromise.catch(() => []));
      await userPersistPromise.catch(() => {});
      await afterCapture;
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
    let context = null;

    try {
      const [retrieved, currentAppointment, profile, ctx] = await Promise.all([
        knowledgePromise,
        appointmentPromise,
        profilePromise,
        actionContext()
      ]);
      context = ctx;
      knowledgeItems = retrieved || [];
      const knowledgeContext = formatKnowledgeContext(knowledgeItems);
      let appointmentContext = "No hay una visita activa vinculada a este navegador.";

      if (currentAppointment) {
        appointmentContext =
          `La familia tiene una visita activa para ${new Date(currentAppointment.start_at).toISOString()}. ` +
          `Estado: ${currentAppointment.status}. Estudiante: ${currentAppointment.student_name || "sin nombre asociado"}. ` +
          "Si pregunta por cambiar o cancelar, explicá que puede hacerlo directamente en este chat.";
      }

      const capturedContext = justCaptured
        ? `\nLa familia acaba de compartir su ${[found.phone && "teléfono", found.email && "correo"].filter(Boolean).join(" y ")} en este mensaje y ya quedó registrado. Agradecé en una frase y confirmá que el equipo de Admisiones la va a contactar; después respondé lo que haya preguntado.`
        : "";

      const systemInstruction = `${buildSystemInstruction(profile)}${buildCaptureInstruction(capture, context)}

BASE DE CONOCIMIENTO RELEVANTE PARA ESTA CONSULTA
${knowledgeContext}

SITUACIÓN ACTUAL DE LA FAMILIA
${appointmentContext}
Mensajes de la familia en esta conversación: ${userTurns + 1}.${capturedContext}`;

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
          persistVisitorMessage(req, res, "assistant", fallback),
          afterCapture
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

    const resolved = resolveAction(responseText, context || await actionContext());

    await Promise.allSettled([
      userPersistPromise,
      persistVisitorMessage(req, res, "assistant", resolved.text),
      afterCapture
    ]);

    return res.status(200).json({
      success: true,
      response: resolved.text,
      source: "gemini",
      action: resolved.action,
      openContact: Boolean(resolved.openContact)
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
