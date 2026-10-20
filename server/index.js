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
  "/api/booking/availability": require("../api/booking/availability"),
  "/api/booking/create": require("../api/booking/create"),
  "/api/crm/login": require("../api/crm/login"),
  "/api/crm/logout": require("../api/crm/logout"),
  "/api/crm/me": require("../api/crm/me"),
  "/api/crm/summary": require("../api/crm/summary"),
  "/api/crm/leads": require("../api/crm/leads"),
  "/api/crm/lead": require("../api/crm/lead"),
  "/api/crm/lead-update": require("../api/crm/lead-update"),
  "/api/crm/appointments": require("../api/crm/appointments"),
  "/api/crm/followups": require("../api/crm/followups"),
  "/api/crm/inquiries": require("../api/crm/inquiries"),
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
});
