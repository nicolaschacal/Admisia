const { requireManager } = require("../../lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }
  const manager = requireManager(req, res);
  if (!manager) return;
  return res.status(200).json({ success: true, manager });
};
