const { query, withTransaction } = require("./db");
const { ensureConversation, linkVisitorToLead } = require("./visitor-session");

// Ways a family can leave their contact without booking a visit.
const CAPTURE_SOURCES = {
  booking: "Agendó una visita",
  info: "Pidió información",
  vacancy: "Aviso de vacantes",
  brochure: "Pidió el folleto",
  callback: "Pidió que lo llamen",
  detected: "Dejó su contacto en el chat"
};

const DEFAULT_CAPTURE = {
  contactOffer: true,
  vacancyAlerts: true,
  vacancyText: "",
  brochure: true,
  brochureUrl: "",
  callback: true,
  autoDetect: true
};

/* ---------- Schema ---------- */

// Installs that never ran `npm run db:migrate` after this feature still work:
// the columns are added on first use (idempotent, once per instance).
let schemaPromise = null;
function ensureCaptureSchema() {
  if (!process.env.DATABASE_URL) return Promise.resolve();
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS capture_source text");
      await query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS capture_detail text");
      await query("UPDATE leads SET capture_source='booking' WHERE capture_source IS NULL");
    })().catch((error) => {
      schemaPromise = null;
      console.error("No se pudo preparar el esquema de captación:", error.message);
    });
  }
  return schemaPromise;
}

/* ---------- Settings ---------- */

async function getCaptureSettings() {
  try {
    const result = await query("SELECT value FROM crm_settings WHERE key='capture' LIMIT 1");
    return { ...DEFAULT_CAPTURE, ...(result.rows[0]?.value || {}) };
  } catch {
    return { ...DEFAULT_CAPTURE };
  }
}

async function getBrochureFile() {
  const result = await query("SELECT value FROM crm_settings WHERE key='brochure' LIMIT 1");
  const value = result.rows[0]?.value;
  return value?.data ? value : null;
}

async function getBrochureMeta() {
  try {
    const result = await query(
      `SELECT value->>'name' AS name, (value->>'size')::int AS size, value->>'updatedAt' AS updated_at
       FROM crm_settings WHERE key='brochure' AND value ? 'data' LIMIT 1`
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

function publicOrigin(req) {
  const host = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "").split(",")[0].trim();
  const proto = String(req.headers?.["x-forwarded-proto"] || (process.env.VERCEL ? "https" : "http")).split(",")[0].trim();
  return host ? `${proto}://${host}` : "";
}

// Public link to the brochure: an uploaded PDF wins over an external URL.
async function getBrochureLink(req, settings = null) {
  const capture = settings || await getCaptureSettings();
  const meta = await getBrochureMeta();
  if (meta) {
    const version = meta.updated_at ? `&v=${encodeURIComponent(Date.parse(meta.updated_at) || "")}` : "";
    return `${publicOrigin(req)}/api/profile?file=brochure${version}`;
  }
  return capture.brochureUrl || "";
}

/* ---------- Detection ---------- */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// Uruguayan mobiles (09X XXX XXX), landlines (2XXX XXXX / 4XXX XXXX),
// with or without +598, and other international numbers starting with +.
const PHONE_RES = [
  /(?<![\d$])(?:\+?598[\s.-]?)?0?9\d(?:[\s.-]?\d){6}(?!\d)/,
  /(?<![\d$])(?:\+?598[\s.-]?)?[24]\d{3}[\s.-]?\d{4}(?!\d)/,
  /(?<![\d$])\+\d{1,3}(?:[\s.-]?\d){7,12}(?!\d)/
];

function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return plus ? `+${digits}` : digits;
}

function detectContact(text) {
  const value = String(text || "");
  const email = (value.match(EMAIL_RE) || [])[0] || "";
  const withoutEmail = email ? value.replace(email, " ") : value;
  let phone = "";
  for (const re of PHONE_RES) {
    const match = withoutEmail.match(re);
    if (match) { phone = normalizePhone(match[0]); if (phone) break; }
  }
  return { email: email.toLowerCase(), phone };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

/* ---------- Capture ---------- */

function clean(value, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

function followupTitle(source, name, detail) {
  const who = name || "la familia";
  switch (source) {
    case "callback": return `Llamar a ${who}${detail ? ` (${detail.toLowerCase()})` : ""}`;
    case "vacancy": return `Avisar a ${who} sobre vacantes e inscripciones`;
    case "brochure": return `Contactar a ${who}: pidió el folleto`;
    case "info": return `Enviar información a ${who}`;
    default: return `Contactar a ${who}: dejó su contacto en el chat`;
  }
}

/**
 * Creates (or completes) the lead for this browser's conversation and links
 * them. Never downgrades a lead that already booked a visit.
 */
async function captureLead(req, res, { source, name, phone, email, detail, consent = false, utm = {} }) {
  await ensureCaptureSchema();
  const sourceKey = CAPTURE_SOURCES[source] ? source : "detected";
  const adultName = clean(name, 200) || null;
  const cleanPhone = normalizePhone(phone) || null;
  const cleanEmail = isValidEmail(email) ? clean(email, 200).toLowerCase() : null;
  const cleanDetail = clean(detail, 300) || null;
  if (!cleanPhone && !cleanEmail) {
    const error = new Error("Necesitamos un teléfono o un correo para contactarte.");
    error.status = 400;
    throw error;
  }

  return withTransaction(async (client) => {
    const session = await ensureConversation(req, res, client);
    let lead = null;
    let created = false;

    if (session.lead_id) {
      lead = (await client.query("SELECT * FROM leads WHERE id=$1", [session.lead_id])).rows[0] || null;
    }
    if (!lead) {
      lead = (await client.query(
        `SELECT * FROM leads
         WHERE ($1::text IS NOT NULL AND lower(email)=lower($1)) OR ($2::text IS NOT NULL AND phone=$2)
         ORDER BY created_at DESC LIMIT 1`,
        [cleanEmail, cleanPhone]
      )).rows[0] || null;
    }

    if (lead) {
      lead = (await client.query(
        `UPDATE leads
         SET adult_name=COALESCE(adult_name,$2),
             phone=COALESCE(phone,$3),
             email=COALESCE(email,$4),
             capture_source=COALESCE(capture_source,$5),
             capture_detail=COALESCE($6,capture_detail),
             privacy_consent_at=CASE WHEN $7 THEN COALESCE(privacy_consent_at,now()) ELSE privacy_consent_at END,
             last_contact_at=now(),
             updated_at=now()
         WHERE id=$1
         RETURNING *`,
        [lead.id, adultName, cleanPhone, cleanEmail, sourceKey, cleanDetail, Boolean(consent)]
      )).rows[0];
    } else {
      lead = (await client.query(
        `INSERT INTO leads
           (adult_name,email,phone,status,source,capture_source,capture_detail,privacy_consent_at,
            utm_source,utm_medium,utm_campaign,last_contact_at,next_action_at)
         VALUES ($1,$2,$3,'new_inquiry','chat',$4,$5,CASE WHEN $6 THEN now() END,$7,$8,$9,now(),now())
         RETURNING *`,
        [
          adultName, cleanEmail, cleanPhone, sourceKey, cleanDetail, Boolean(consent),
          clean(utm.utmSource, 200) || null, clean(utm.utmMedium, 200) || null, clean(utm.utmCampaign, 200) || null
        ]
      )).rows[0];
      created = true;
    }

    await linkVisitorToLead(req, res, lead.id, client);

    await client.query(
      `INSERT INTO activities (lead_id,type,description,metadata)
       VALUES ($1,'contact_captured',$2,$3::jsonb)`,
      [
        lead.id,
        `${CAPTURE_SOURCES[sourceKey]} desde el chat${cleanDetail ? ` · ${cleanDetail}` : ""}.`,
        JSON.stringify({ source: sourceKey, phone: cleanPhone, email: cleanEmail })
      ]
    );

    const pending = await client.query(
      `SELECT 1 FROM followups WHERE lead_id=$1 AND status='pending' AND type='capture_contact' LIMIT 1`,
      [lead.id]
    );
    if (!pending.rows.length && lead.status !== "visit_scheduled") {
      await client.query(
        `INSERT INTO followups (lead_id,type,title,notes,due_at)
         VALUES ($1,'capture_contact',$2,$3,now())`,
        [
          lead.id,
          followupTitle(sourceKey, lead.adult_name, cleanDetail),
          [cleanPhone && `Teléfono: ${cleanPhone}`, cleanEmail && `Correo: ${cleanEmail}`].filter(Boolean).join(" · ") || null
        ]
      );
    }

    return { lead, created, source: sourceKey, detail: cleanDetail };
  });
}

/* ---------- Notifications ---------- */

async function notifyCapture(req, { lead, source, detail }, { brochureLink = "", schoolName = "" } = {}) {
  const { queueAndTrySend, getNotifyEmail } = require("./email");
  const jobs = [];
  const admissionsEmail = await getNotifyEmail().catch(() => "");

  if (admissionsEmail) {
    jobs.push(queueAndTrySend({
      leadId: lead.id,
      recipient: admissionsEmail,
      subject: `Nuevo contacto · ${CAPTURE_SOURCES[source]} · ${lead.adult_name || lead.phone || lead.email}`,
      bodyText: [
        "Una familia dejó su contacto en el chat (todavía sin visita).",
        "",
        `Motivo: ${CAPTURE_SOURCES[source]}${detail ? ` (${detail})` : ""}`,
        `Nombre: ${lead.adult_name || "No indicado"}`,
        `Teléfono: ${lead.phone || "No indicado"}`,
        `Correo: ${lead.email || "No indicado"}`,
        "",
        "La conversación completa y el análisis de la IA están en el panel → Candidatos."
      ].join("\n")
    }));
  }

  if (source === "brochure" && brochureLink && lead.email) {
    jobs.push(queueAndTrySend({
      leadId: lead.id,
      recipient: lead.email,
      subject: `Folleto de ${schoolName || "admisiones"}`,
      bodyText: [
        `Hola${lead.adult_name ? ` ${lead.adult_name}` : ""},`,
        "",
        `Te compartimos el folleto de ${schoolName || "la institución"}:`,
        brochureLink,
        "",
        "Si tenés dudas, podés seguir la conversación en el mismo chat o responder este correo."
      ].join("\n")
    }));
  }

  await Promise.allSettled(jobs);
}

module.exports = {
  CAPTURE_SOURCES,
  DEFAULT_CAPTURE,
  ensureCaptureSchema,
  getCaptureSettings,
  getBrochureFile,
  getBrochureMeta,
  getBrochureLink,
  detectContact,
  normalizePhone,
  isValidEmail,
  captureLead,
  notifyCapture
};
