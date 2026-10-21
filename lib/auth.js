const jwt = require("jsonwebtoken");

const COOKIE_NAME = "admisia_session";

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((acc, item) => {
    const index = item.indexOf("=");
    if (index === -1) return acc;
    const key = item.slice(0, index).trim();
    const value = decodeURIComponent(item.slice(index + 1).trim());
    acc[key] = value;
    return acc;
  }, {});
}

function getSecret() {
  if (!process.env.CRM_JWT_SECRET) {
    throw new Error("CRM_JWT_SECRET no está configurado.");
  }
  return process.env.CRM_JWT_SECRET;
}

function createSessionToken(manager) {
  return jwt.sign(
    {
      sub: manager.id,
      email: manager.email,
      name: manager.full_name,
      role: manager.role
    },
    getSecret(),
    { expiresIn: "12h" }
  );
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure ? "; Secure" : ""}`
  );
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`
  );
}

function requireManager(req, res) {
  try {
    const token = parseCookies(req)[COOKIE_NAME];
    if (!token) {
      res.status(401).json({ success: false, message: "Sesión requerida." });
      return null;
    }
    return jwt.verify(token, getSecret());
  } catch {
    res.status(401).json({ success: false, message: "Sesión inválida o vencida." });
    return null;
  }
}

module.exports = {
  COOKIE_NAME,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  requireManager
};
