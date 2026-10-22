// Business types (rubros). One install = one business; the type picks the
// vocabulary of the chat and the panel, the booking form and the assistant's
// goal and rules. "school" reproduces the original AdmisIA texts exactly, so
// existing installs (without a type) keep behaving the same.

const APPOINTMENT = {
  visita: { noun: "visita", plural: "visitas", g: "f" },
  consulta: { noun: "consulta", plural: "consultas", g: "f" },
  turno: { noun: "turno", plural: "turnos", g: "m" }
};

const cap = (text) => String(text).charAt(0).toUpperCase() + String(text).slice(1);

function appointmentWords(key) {
  const a = APPOINTMENT[key];
  const f = a.g === "f";
  const adj = (base) => `${base}${f ? "a" : "o"}`;
  return {
    noun: a.noun,
    Noun: cap(a.noun),
    plural: a.plural,
    Plural: cap(a.plural),
    a: `${f ? "una" : "un"} ${a.noun}`,
    the: `${f ? "la" : "el"} ${a.noun}`,
    of: f ? `de la ${a.noun}` : `del ${a.noun}`,
    your: `tu ${a.noun}`,
    pron: f ? "la" : "lo",
    scheduled: adj("agendad"),
    cancelledAdj: adj("cancelad"),
    confirmed: `${cap(a.noun)} ${adj("confirmad")}`,
    cancelled: `${cap(a.noun)} ${adj("cancelad")}`
  };
}

const TYPES = {
  school: {
    label: "Colegio o institución educativa",
    short: "Colegio",
    appointment: "visita",
    form: "school",
    vocab: {
      team: "Admisiones",
      assistantRole: "asistente de admisiones",
      panelName: "Panel de admisiones",
      client: "familia",
      clients: "familias",
      Client: "Familia",
      Clients: "Familias",
      lead: "candidato",
      Lead: "Candidato",
      Leads: "Candidatos",
      person: "estudiante",
      cta: "Agendar visita",
      ctaLong: "Agendar una visita",
      ctaTitle: "Agendar una visita",
      bookingIntro: "Completá tus datos para confirmar la visita.",
      confirmButton: "Confirmar visita",
      consentBooking: "Acepto que el colegio use estos datos solo para el proceso de admisión.",
      consentContact: "Acepto que el colegio use estos datos para contactarme sobre admisiones.",
      welcome: [
        "¡Hola! 👋 Soy el asistente de admisiones de {name}.",
        "",
        "Puedo ayudarte con la propuesta educativa, horarios, proceso de inscripción y costos.",
        "",
        "También puedo mostrarte horarios disponibles para coordinar una visita."
      ],
      quick: [
        ["Propuesta educativa", "Quiero conocer la propuesta educativa del colegio."],
        ["Niveles y horarios", "¿Qué niveles y horarios tienen?"],
        ["Costos estimativos", "¿Pueden darme una orientación de costos?"]
      ],
      vacancyTitle: "Aviso de vacantes",
      vacancySubtitle: "Te avisamos apenas haya novedades de vacantes e inscripciones.",
      vacancyButton: "Avisame",
      vacancyEcho: "Sí, avisame cuando haya novedades.",
      vacancyConfirm: "Quedaste anotado: te avisamos apenas haya novedades de vacantes e inscripciones.",
      vacancyOption: ["Aviso de vacantes", "Si pregunta por cupos, inscripciones o el año próximo, el asistente ofrece avisarle cuando haya novedades."],
      vacancyTextLabel: "Novedades de inscripción",
      vacancyTextPlaceholder: "Ej. Las inscripciones para 2027 abren el 1 de noviembre. Quedan pocos lugares en Inicial 4.",
      vacancyTextHelp: "Opcional. El asistente lo usa al hablar de vacantes e inscripciones.",
      vacancyLabel: "Aviso de vacantes",
      searchPlaceholder: "Buscar familia, estudiante o correo",
      knowledgeHint: "Agregá precios, horarios, niveles y todo lo que las familias suelen preguntar.",
      stages: {
        new_inquiry: "Nuevos",
        qualified: "Interesados",
        visit_scheduled: "Visita agendada",
        followup: "Seguimiento",
        application_started: "Inscripción",
        waitlist: "Lista de espera",
        enrolled: "Confirmados",
        lost: "No continúa"
      }
    }
  },

  health: {
    label: "Consultorio, clínica o servicio de salud",
    short: "Salud",
    appointment: "consulta",
    form: "health",
    vocab: {
      team: "Recepción",
      assistantRole: "asistente virtual",
      panelName: "Panel de pacientes",
      client: "paciente",
      clients: "pacientes",
      Client: "Paciente",
      Clients: "Pacientes",
      lead: "paciente",
      Lead: "Paciente",
      Leads: "Pacientes",
      person: "paciente",
      cta: "Reservar consulta",
      ctaLong: "Reservar una consulta",
      ctaTitle: "Reservar una consulta",
      bookingIntro: "Completá tus datos para confirmar la consulta.",
      confirmButton: "Confirmar consulta",
      consentBooking: "Acepto que {name} use estos datos para gestionar mi consulta.",
      consentContact: "Acepto que {name} use estos datos para contactarme.",
      welcome: [
        "¡Hola! 👋 Soy el asistente virtual de {name}.",
        "",
        "Puedo ayudarte con especialidades, profesionales, coberturas, horarios y costos.",
        "",
        "También puedo mostrarte horarios disponibles para reservar una consulta."
      ],
      quick: [
        ["Especialidades", "¿Qué especialidades y profesionales tienen?"],
        ["Coberturas", "¿Con qué coberturas o mutualistas trabajan?"],
        ["Costos", "¿Cuánto cuesta una consulta?"]
      ],
      vacancyTitle: "Lista de espera",
      vacancySubtitle: "Te avisamos si se libera un turno antes.",
      vacancyButton: "Anotarme",
      vacancyEcho: "Sí, anotame en la lista de espera.",
      vacancyConfirm: "Quedaste en la lista de espera: si se libera un horario antes, te avisamos.",
      vacancyOption: ["Lista de espera", "Si no encuentra horario o pregunta por turnos antes, el asistente ofrece anotarlo para avisarle cuando se libere uno."],
      vacancyTextLabel: "Novedades de agenda",
      vacancyTextPlaceholder: "Ej. La Dra. Pérez vuelve a atender desde el 3 de noviembre. Hay agenda abierta para diciembre.",
      vacancyTextHelp: "Opcional. El asistente lo usa al hablar de disponibilidad.",
      vacancyLabel: "Lista de espera",
      searchPlaceholder: "Buscar paciente, teléfono o correo",
      knowledgeHint: "Agregá especialidades, profesionales, coberturas, precios y preparación para cada consulta.",
      stages: {
        new_inquiry: "Nuevos",
        qualified: "Interesados",
        visit_scheduled: "Consulta agendada",
        followup: "Seguimiento",
        application_started: "En tratamiento",
        waitlist: "Lista de espera",
        enrolled: "Pacientes activos",
        lost: "No continúa"
      }
    }
  },

  beauty: {
    label: "Estética, peluquería o bienestar",
    short: "Estética",
    appointment: "turno",
    form: "beauty",
    vocab: {
      team: "Recepción",
      assistantRole: "asistente virtual",
      panelName: "Panel de clientes",
      client: "cliente",
      clients: "clientes",
      Client: "Cliente",
      Clients: "Clientes",
      lead: "cliente",
      Lead: "Cliente",
      Leads: "Clientes",
      person: "cliente",
      cta: "Reservar turno",
      ctaLong: "Reservar un turno",
      ctaTitle: "Reservar un turno",
      bookingIntro: "Completá tus datos para confirmar el turno.",
      confirmButton: "Confirmar turno",
      consentBooking: "Acepto que {name} use estos datos para gestionar mi turno.",
      consentContact: "Acepto que {name} use estos datos para contactarme.",
      welcome: [
        "¡Hola! 👋 Soy el asistente virtual de {name}.",
        "",
        "Puedo contarte sobre servicios, precios, duración y promociones.",
        "",
        "También puedo mostrarte horarios disponibles para reservar un turno."
      ],
      quick: [
        ["Servicios", "¿Qué servicios ofrecen?"],
        ["Precios", "¿Cuáles son los precios?"],
        ["Promociones", "¿Tienen alguna promoción?"]
      ],
      vacancyTitle: "Turnos libres y promociones",
      vacancySubtitle: "Te avisamos cuando se libere un turno o haya promociones.",
      vacancyButton: "Avisame",
      vacancyEcho: "Sí, avisame de turnos libres y promociones.",
      vacancyConfirm: "Listo, te avisamos cuando se libere un turno o haya promociones.",
      vacancyOption: ["Turnos libres y promociones", "Si no encuentra horario o pregunta por promociones, el asistente ofrece avisarle cuando haya novedades."],
      vacancyTextLabel: "Promociones y novedades",
      vacancyTextPlaceholder: "Ej. 20 % de descuento en limpieza facial los martes de noviembre.",
      vacancyTextHelp: "Opcional. El asistente lo usa al hablar de promociones y disponibilidad.",
      vacancyLabel: "Turnos libres y promociones",
      searchPlaceholder: "Buscar cliente, teléfono o correo",
      knowledgeHint: "Agregá servicios, precios, duración, profesionales y promociones.",
      stages: {
        new_inquiry: "Nuevos",
        qualified: "Interesados",
        visit_scheduled: "Turno reservado",
        followup: "Seguimiento",
        application_started: "Presupuesto enviado",
        waitlist: "Lista de espera",
        enrolled: "Clientes frecuentes",
        lost: "No continúa"
      }
    }
  },

  other: {
    label: "Otro servicio con turnos",
    short: "Servicios",
    appointment: "turno",
    form: "other",
    vocab: {
      team: "Atención al cliente",
      assistantRole: "asistente virtual",
      panelName: "Panel de clientes",
      client: "cliente",
      clients: "clientes",
      Client: "Cliente",
      Clients: "Clientes",
      lead: "cliente",
      Lead: "Cliente",
      Leads: "Clientes",
      person: "cliente",
      cta: "Reservar turno",
      ctaLong: "Reservar un turno",
      ctaTitle: "Reservar un turno",
      bookingIntro: "Completá tus datos para confirmar el turno.",
      confirmButton: "Confirmar turno",
      consentBooking: "Acepto que {name} use estos datos para gestionar mi turno.",
      consentContact: "Acepto que {name} use estos datos para contactarme.",
      welcome: [
        "¡Hola! 👋 Soy el asistente virtual de {name}.",
        "",
        "Puedo ayudarte con servicios, precios y horarios.",
        "",
        "También puedo mostrarte horarios disponibles para reservar un turno."
      ],
      quick: [
        ["Servicios", "¿Qué servicios ofrecen?"],
        ["Precios", "¿Cuáles son los precios?"],
        ["Horarios", "¿Qué horarios de atención tienen?"]
      ],
      vacancyTitle: "Turnos libres",
      vacancySubtitle: "Te avisamos cuando se libere un turno.",
      vacancyButton: "Avisame",
      vacancyEcho: "Sí, avisame cuando se libere un turno.",
      vacancyConfirm: "Listo, te avisamos cuando se libere un turno.",
      vacancyOption: ["Turnos libres", "Si no encuentra horario, el asistente ofrece avisarle cuando se libere uno."],
      vacancyTextLabel: "Novedades",
      vacancyTextPlaceholder: "Ej. En diciembre atendemos también los sábados.",
      vacancyTextHelp: "Opcional. El asistente lo usa al hablar de disponibilidad.",
      vacancyLabel: "Turnos libres",
      searchPlaceholder: "Buscar cliente, teléfono o correo",
      knowledgeHint: "Agregá servicios, precios, duración y todo lo que tus clientes suelen preguntar.",
      stages: {
        new_inquiry: "Nuevos",
        qualified: "Interesados",
        visit_scheduled: "Turno agendado",
        followup: "Seguimiento",
        application_started: "En proceso",
        waitlist: "Lista de espera",
        enrolled: "Clientes",
        lost: "No continúa"
      }
    }
  }
};

const DEFAULT_TYPE = "school";

function normalizeType(value) {
  return Object.prototype.hasOwnProperty.call(TYPES, value) ? value : DEFAULT_TYPE;
}

function fill(text, name) {
  return String(text).replace(/\{name\}/g, name);
}

// Flat, ready-to-use strings for the chat, the panel and the server.
function vocabFor(type, name = "") {
  const key = normalizeType(type);
  const def = TYPES[key];
  const businessName = name || (key === "school" ? "la institución" : "nosotros");
  const v = def.vocab;
  return {
    type: key,
    form: def.form,
    ...v,
    consentBooking: fill(v.consentBooking, businessName),
    consentContact: fill(v.consentContact, businessName),
    welcome: v.welcome.map((line) => fill(line, businessName)),
    appt: appointmentWords(def.appointment)
  };
}

function typeOptions() {
  return Object.entries(TYPES).map(([key, def]) => ({ key, label: def.label, short: def.short }));
}

module.exports = { TYPES, DEFAULT_TYPE, normalizeType, vocabFor, typeOptions };
