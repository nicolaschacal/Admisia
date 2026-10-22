const { query } = require("../../lib/db");
const { requireManager } = require("../../lib/auth");
const { CAPTURE_COLUMNS_SQL, NO_VISIT_SQL } = require("../../lib/capture");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido." });
  }
  if (!requireManager(req, res)) return;

  try {
    const status = String(req.query?.status || "").trim();
    const search = String(req.query?.search || "").trim();
    const params = [];
    const where = [];

    if (status) {
      params.push(status);
      where.push(`l.status=$${params.length}`);
    }

    // "Contacto sin visita": left their contact but never booked.
    if (String(req.query?.capture || "") === "no_visit") {
      where.push(NO_VISIT_SQL("l"));
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        l.adult_name ILIKE $${params.length}
        OR l.email ILIKE $${params.length}
        OR l.phone ILIKE $${params.length}
        OR EXISTS (
          SELECT 1 FROM students st
          WHERE st.lead_id=l.id AND st.full_name ILIKE $${params.length}
        )
      )`);
    }

    const result = await query(
      `SELECT
         l.*,
         ${CAPTURE_COLUMNS_SQL("l")},
         (SELECT full_name FROM students st WHERE st.lead_id=l.id ORDER BY st.created_at DESC LIMIT 1) AS student_name,
         (SELECT birth_date FROM students st WHERE st.lead_id=l.id ORDER BY st.created_at DESC LIMIT 1) AS birth_date,
         (SELECT start_at FROM appointments a
          WHERE a.lead_id=l.id AND a.status IN ('scheduled','confirmed') AND a.start_at >= now()
          ORDER BY a.start_at LIMIT 1) AS next_appointment,
         (SELECT due_at FROM followups f
          WHERE f.lead_id=l.id AND f.status='pending'
          ORDER BY f.due_at LIMIT 1) AS next_followup
       FROM leads l
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY COALESCE(l.next_action_at, l.updated_at) DESC
       LIMIT 250`,
      params
    );

    return res.status(200).json({ success: true, leads: result.rows });
  } catch (error) {
    console.error("CRM leads error:", error);
    return res.status(500).json({ success: false, message: "No se pudieron cargar los candidatos." });
  }
};
