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
  async transaction(callback) {
    return callback(this);
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
    async transaction(callback) {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        const result = await callback({
          query(text, params) {
            return client.query(text, params);
          }
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
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
