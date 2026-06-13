import { Pool, type PoolClient } from "pg";

/**
 * Shared Postgres access for the payments/booking internal layer.
 *
 * These tables are service-role only (Phase 1 RLS), and the architecture
 * requires transactional, row-locking SQL (FOR UPDATE SKIP LOCKED, single
 * transaction per event) that the Supabase JS/PostgREST client cannot
 * express. So this layer talks to Postgres directly with a service-role /
 * direct connection string. It is server-only — never import from a client
 * component.
 */

export type Executor = Pool | PoolClient;

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("SUPABASE_DB_URL (or DATABASE_URL) must be set for the booking/payments layer");
    }
    pool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX ?? 10),
    });
  }
  return pool;
}

/**
 * Run `fn` inside a single transaction. Commits on success, rolls back on
 * any thrown error (the all-or-nothing guarantee the processor relies on).
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  basePool: Pool = getPool(),
): Promise<T> {
  const client = await basePool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/** Narrow an unknown thrown value to its Postgres SQLSTATE code, if any. */
export function pgErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}
