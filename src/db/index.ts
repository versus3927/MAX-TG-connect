import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Максимально простое подключение.
// Если DATABASE_URL нет (при билде), используем заглушку, чтобы не ронять процесс.
const connectionString = process.env.DATABASE_URL || "postgres://localhost/db";

const globalForDb = globalThis as typeof globalThis & {
  __pool?: Pool;
};

export const pool = globalForDb.__pool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pool = pool;
}

export const db = drizzle(pool);
