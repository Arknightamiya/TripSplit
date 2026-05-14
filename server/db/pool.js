import pg from "pg";

const { Pool } = pg;

const noopDatabase = {
  enabled: false,
  driver: "postgresql",
  async query() {
    return {
      rows: []
    };
  },
  async close() {}
};

export function connectDatabase() {
  if (!process.env.DATABASE_URL) {
    return noopDatabase;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  return {
    enabled: true,
    driver: "postgresql",
    query(text, params) {
      return pool.query(text, params);
    },
    close() {
      return pool.end();
    }
  };
}
