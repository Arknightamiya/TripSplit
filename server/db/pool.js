import pg from "pg";

const { Pool } = pg;
let database;

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
  if (database) {
    return database;
  }

  if (!process.env.DATABASE_URL) {
    database = noopDatabase;
    return database;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  database = {
    enabled: true,
    driver: "postgresql",
    query(text, params) {
      return pool.query(text, params);
    },
    close() {
      database = undefined;
      return pool.end();
    }
  };

  return database;
}

export function getDatabase() {
  return database || connectDatabase();
}
