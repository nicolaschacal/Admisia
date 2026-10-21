require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { getPool } = require("../lib/db");

// Applies every database/*.sql file once, in order, and records it in
// schema_migrations. Installs created before this tracking existed are
// detected so seed files are not applied twice.
async function main() {
  const pool = getPool();
  const dir = path.join(__dirname, "../database");
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();

  const tracked = await pool.query("SELECT to_regclass('public.schema_migrations') AS t");
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  if (!tracked.rows[0].t) {
    const legacy = await pool.query(`
      SELECT to_regclass('public.managers') IS NOT NULL AS has_init,
             to_regclass('public.knowledge_items') IS NOT NULL AS has_knowledge,
             (to_regclass('public.crm_settings') IS NOT NULL
               AND EXISTS (SELECT 1 FROM crm_settings WHERE key='profile')) AS has_profile`
    ).catch(() => ({ rows: [{}] }));
    const flags = legacy.rows[0] || {};
    const already = [
      flags.has_init && "001_init.sql",
      flags.has_knowledge && "002_knowledge_base.sql",
      flags.has_profile && "003_public_profile.sql"
    ].filter(Boolean);
    for (const file of already) {
      await pool.query("INSERT INTO schema_migrations(filename) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
    }
  }

  const applied = new Set((await pool.query("SELECT filename FROM schema_migrations")).rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`· ${file} (ya aplicada)`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations(filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`✓ ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`${file}: ${error.message}`);
    } finally {
      client.release();
    }
  }

  console.log("Migración completada.");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
