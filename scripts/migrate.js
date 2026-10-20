require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { getPool } = require("../lib/db");

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "../database/001_init.sql"), "utf8");
  await getPool().query(sql);
  console.log("Migración completada.");
  await getPool().end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
