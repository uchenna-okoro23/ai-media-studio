import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

const pool =
  global.pgPool ??
  (connectionString
    ? new Pool({
        connectionString,
        ssl:
          process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : undefined,
      })
    : null);

if (pool && process.env.NODE_ENV !== "production") {
  global.pgPool = pool;
}

export function db() {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }
  return pool;
}

export async function query<T = any>(text: string, values?: unknown[]) {
  return db().query<T>(text, values);
}
