import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration tests run against the local Supabase Postgres (supabase start).
 * They share one database, so files run serially to avoid cross-file races;
 * each test isolates itself with a fresh creator and unique slot times.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
    // the booking/payments layer reads SUPABASE_DB_URL; default to the local
    // `supabase start` DSN so tests hit the real local Postgres.
    env: {
      SUPABASE_DB_URL:
        process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    },
  },
});
