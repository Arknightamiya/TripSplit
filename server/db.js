const noopDatabase = {
  enabled: false,
  driver: "postgresql",
  query() {
    return [];
  },
  async close() {}
};

export async function connectDatabase() {
  // TODO: Install a PostgreSQL driver such as `pg`.
  // TODO: Read real connection values from environment variables.
  // TODO: Create and return a shared connection pool.
  // TODO: Add startup failure handling once the database is required.
  return noopDatabase;
}
