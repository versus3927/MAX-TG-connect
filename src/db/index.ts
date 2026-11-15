import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Lazy-инициализация — не падаем на этапе сборки Next.js (build time),
// когда DATABASE_URL ещё недоступна. Ошибка возникнет только при первом
// реальном запросе к БД (runtime), что корректно.

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function getPool(): Pool {
  if (globalForDb.__arenaNextJsPostgresqlPool) {
    return globalForDb.__arenaNextJsPostgresqlPool;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to Railway → Variables → DATABASE_URL=${{Postgres.DATABASE_URL}}",
    );
  }
  const pool = new Pool({ connectionString: url });
  globalForDb.__arenaNextJsPostgresqlPool = pool;
  return pool;
}

// Proxy-объект: db.* вызовы дойдут до реального drizzle только в runtime
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return (getPool() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (
      drizzle(getPool()) as unknown as Record<string | symbol, unknown>
    )[prop];
  },
});
