import { defineConfig } from "vitest/config";

/**
 * Integration tests run against the local Supabase Postgres (supabase start).
 * They share one database, so files run serially to avoid cross-file races;
 * each test isolates itself with a fresh creator and unique slot times.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
