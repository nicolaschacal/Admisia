const crypto = require("crypto");
const { query, withTransaction } = require("./db");

const COOKIE_NAME = "admisia_visitor";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

function parseCookies(req) {
  const raw = String(req.headers?.cookie || "");
  return raw.split(";").reduce((acc, part) => {
    const index = part.indexOf("=");
    if (index <= 0) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function isSecureRequest(req) {
  const forwarded = String(req.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  return forwarded === "https" || Boolean(process.env.VERCEL);
}

function appendSetCookie(res, cookie) {
  const existing = res.getHeader?.("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }
  const list = Array.isArray(existing) ? existing : [existing];
  res.setHeader("Set-Cookie", [...list, cookie]);
}

function getVisitorToken(req, res) {
  const cookies = parseCookies(req);
  let token = cookies[COOKIE_NAME];

  if (!token || !/^[A-Za-z0-9_-]{24,128}$/.test(token)) {
    token = crypto.randomBytes(32).toString("base64url");
    const attributes = [
      `${COOKIE_NAME}=${encodeURIComponent(token)}`,
      "Path=/",
      `Max-Age=${COOKIE_MAX_AGE}`,
      "HttpOnly",
      "SameSite=Lax"
    ];
    if (isSecureRequest(req)) attributes.push("Secure");
    appendSetCookie(res, attributes.join("; "));
  }

  return token;
}

function getVisitorSessionKey(req, res) {
  const token = getVisitorToken(req, res);
  const digest = crypto.createHash("sha256").update(token).digest("hex");
  return `visitor:${digest}`;
}

function runner(client) {
  return client?.query ? client.query.bind(client) : query;
}

async function ensureConversation(req, res, client = null) {
  const run = runner(client);
  const sessionKey = getVisitorSessionKey(req, res);

  const result = await run(
    `INSERT INTO conversation_sessions(session_key,last_message_at)
     VALUES($1,now())
     ON CONFLICT(session_key)
     DO UPDATE SET last_message_at=now()
     RETURNING id,session_key,lead_id,started_at,last_message_at`,
    [sessionKey]
  );

  return result.rows[0];
}

async function migrateLegacySession(req, res, legacySessionId) {
  const current = await ensureConversation(req, res);
  const legacyKey = String(legacySessionId || "").trim().slice(0, 200);

  if (!legacyKey || legacyKey.startsWith("visitor:")) return current;

  try {
    return await withTransaction(async (client) => {
      const freshResult = await client.query(
        `SELECT id,session_key,lead_id,started_at,last_message_at
         FROM conversation_sessions
         WHERE id=$1
         FOR UPDATE`,
        [current.id]
      );
      const fresh = freshResult.rows[0];
      if (!fresh) return current;

      const state = await client.query(
        `SELECT EXISTS(
           SELECT 1 FROM conversation_messages WHERE conversation_id=$1
         ) AS has_messages`,
        [fresh.id]
      );

      if (fresh.lead_id || state.rows[0]?.has_messages) return fresh;

      const legacyResult = await client.query(
        `SELECT id,session_key,lead_id,started_at,last_message_at
         FROM conversation_sessions
         WHERE session_key=$1 AND id<>$2
         FOR UPDATE`,
        [legacyKey, fresh.id]
      );
      const legacy = legacyResult.rows[0];
      if (!legacy) return fresh;

      await client.query("DELETE FROM conversation_sessions WHERE id=$1", [fresh.id]);

      const moved = await client.query(
        `UPDATE conversation_sessions
         SET session_key=$2,last_message_at=now()
         WHERE id=$1
         RETURNING id,session_key,lead_id,started_at,last_message_at`,
        [legacy.id, fresh.session_key]
      );

      return moved.rows[0] || fresh;
    });
  } catch (error) {
    console.error("Legacy chat migration error:", error.message);
    return current;
  }
}

async function loadVisitorMessages(req, res, limit = 200, existingSession = null) {
  const session = existingSession || await ensureConversation(req, res);
  const result = await query(
    `SELECT role,content,created_at
     FROM conversation_messages
     WHERE conversation_id=$1
     ORDER BY created_at DESC
     LIMIT $2`,
    [session.id, Math.min(Math.max(Number(limit) || 200, 1), 500)]
  );

  return {
    session,
    messages: result.rows.reverse()
  };
}

async function persistVisitorMessage(req, res, role, content, leadId = null, client = null) {
  if (!process.env.DATABASE_URL || !content) return null;

  try {
    const run = runner(client);
    const session = await ensureConversation(req, res, client);

    if (leadId && !session.lead_id) {
      await run(
        `UPDATE conversation_sessions
         SET lead_id=$2,last_message_at=now()
         WHERE id=$1`,
        [session.id, leadId]
      );
      session.lead_id = leadId;
    }

    await run(
      `INSERT INTO conversation_messages(conversation_id,role,content)
       VALUES($1,$2,$3)`,
      [session.id, role, String(content).slice(0,5000)]
    );

    return session;
  } catch (error) {
    console.error("No se pudo persistir el mensaje del visitante:", error.message);
    return null;
  }
}

async function linkVisitorToLead(req, res, leadId, client = null) {
  const run = runner(client);
  const session = await ensureConversation(req, res, client);
  await run(
    `UPDATE conversation_sessions
     SET lead_id=$2,last_message_at=now()
     WHERE id=$1`,
    [session.id, leadId]
  );
  return { ...session, lead_id: leadId };
}

async function getCurrentAppointment(leadId, client = null) {
  if (!leadId) return null;
  const run = runner(client);
  const result = await run(
    `SELECT a.*, s.full_name AS student_name
     FROM appointments a
     LEFT JOIN students s ON s.id=a.student_id
     WHERE a.lead_id=$1
       AND a.status IN ('scheduled','confirmed')
       AND a.end_at >= now() - interval '2 hours'
     ORDER BY a.start_at
     LIMIT 1`,
    [leadId]
  );
  return result.rows[0] || null;
}

module.exports = {
  ensureConversation,
  migrateLegacySession,
  loadVisitorMessages,
  persistVisitorMessage,
  linkVisitorToLead,
  getCurrentAppointment,
  getVisitorSessionKey
};
