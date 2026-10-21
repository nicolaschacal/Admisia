require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const frontend = path.join(__dirname, "../frontend");

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use("/css", express.static(path.join(frontend, "css")));
app.use("/js", express.static(path.join(frontend, "js")));
app.use("/assets", express.static(path.join(frontend, "assets")));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "admisia-crm" });
});

app.get("/", (req, res) => res.sendFile(path.join(frontend, "index.html")));
app.get(["/dashboard", "/dashboard/"], (req, res) => res.sendFile(path.join(frontend, "dashboard.html")));

const routes = {
  "/api/chat": require("../api/chat"),
  "/api/chat/session": require("../api/chat/session"),
  "/api/booking/availability": require("../api/booking/availability"),
  "/api/booking/create": require("../api/booking/create"),
  "/api/booking/manage": require("../api/booking/manage"),
  "/api/crm/login": require("../handlers/crm/login"),
  "/api/crm/logout": require("../handlers/crm/logout"),
  "/api/crm/me": require("../handlers/crm/me"),
  "/api/crm/summary": require("../handlers/crm/summary"),
  "/api/crm/leads": require("../handlers/crm/leads"),
  "/api/crm/lead": require("../handlers/crm/lead"),
  "/api/crm/lead-update": require("../handlers/crm/lead-update"),
  "/api/crm/appointments": require("../handlers/crm/appointments"),
  "/api/crm/followups": require("../handlers/crm/followups"),
  "/api/crm/inquiries": require("../handlers/crm/inquiries"),
  "/api/crm/analyze-lead": require("../handlers/crm/analyze-lead"),
  "/api/crm/settings": require("../handlers/crm/settings"),
  "/api/crm/blocked-slots": require("../handlers/crm/blocked-slots"),
  "/api/cron/followups": require("../api/cron/followups")
};

Object.entries(routes).forEach(([route, handler]) => {
  app.all(route, handler);
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Ruta no encontrada." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AdmisIA CRM escuchando en puerto ${PORT}`);

  if (process.env.DATABASE_URL) {
    const { processReminders } = require("../lib/reminders");
    const run = () => processReminders().catch((error) => console.error("Reminder worker:", error));
    setTimeout(run, 15000);
    setInterval(run, 60 * 60 * 1000);
  }
});
