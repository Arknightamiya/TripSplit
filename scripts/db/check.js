import "dotenv/config";
import { connectDatabase } from "../../server/db/pool.js";

const database = connectDatabase();

if (!database.enabled) {
  console.log("DATABASE_URL is not set. PostgreSQL is not enabled.");
  process.exit(0);
}

try {
  const result = await database.query("SELECT current_database() AS database_name");
  console.log(`Connected to PostgreSQL database: ${result.rows[0].database_name}`);
} finally {
  await database.close();
}
