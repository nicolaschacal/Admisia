require("dotenv").config();
const express = require("express");
const cors = require("cors");
const chatRoutes = require("./routes/chat.routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "20kb" }));
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Backend AdmisIA funcionando" });
});

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
