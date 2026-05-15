import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { connectDatabase } from "../../server/db/pool.js";

const database = connectDatabase();

if (!database.enabled) {
  console.error("DATABASE_URL is required before applying the schema.");
  process.exit(1);
}

try {
  const schemaPath = resolve("database/schema.sql");
  const schemaSql = await readFile(schemaPath, "utf8");

  await database.query(schemaSql);
  console.log("Applied database/schema.sql successfully.");
} finally {
  await database.close();
}
