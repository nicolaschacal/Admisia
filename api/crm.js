const handlers = {
  "login": require("../handlers/crm/login"),
  "logout": require("../handlers/crm/logout"),
  "me": require("../handlers/crm/me"),
  "summary": require("../handlers/crm/summary"),
  "leads": require("../handlers/crm/leads"),
  "lead": require("../handlers/crm/lead"),
  "lead-update": require("../handlers/crm/lead-update"),
  "appointments": require("../handlers/crm/appointments"),
  "followups": require("../handlers/crm/followups"),
  "inquiries": require("../handlers/crm/inquiries"),
  "analyze-lead": require("../handlers/crm/analyze-lead"),
  "settings": require("../handlers/crm/settings"),
  "blocked-slots": require("../handlers/crm/blocked-slots"),
  "knowledge": require("../handlers/crm/knowledge"),
  "integrations": require("../handlers/crm/integrations"),
  "team": require("../handlers/crm/team"),
  "setup": require("../handlers/crm/setup")
};

module.exports = async (req, res) => {
  const raw = req.query?.action;
  const action = Array.isArray(raw) ? raw[0] : String(raw || "");
  const handler = handlers[action];

  if (!handler) {
    return res.status(404).json({ success: false, message: "Ruta CRM no encontrada." });
  }

  return handler(req, res);
};
