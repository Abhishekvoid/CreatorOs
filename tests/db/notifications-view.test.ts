import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { getCreatorNotifications } from "@/lib/notifications/queue";
import { applySchema, makePool, seedCreator } from "./helpers";

/**
 * Notification observability read layer — creator-scoped, service-role pool,
 * exactly like bookings.ts / clients.ts. Verifies retrieval, newest-first
 * ordering, the 20-row cap, the empty state, and creator isolation.
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
});

afterAll(async () => {
  await pool.end();
});

async function insertNotification(opts: {
  creatorId: string;
  type?: string;
  status?: string;
  attemptCount?: number;
  createdAt?: string;
  lastError?: string | null;
}): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.notification_queue
       (correlation_id, creator_id, type, channel, payload, status, attempt_count, created_at, last_error)
     values ($1, $2, $3, 'whatsapp', '{}'::jsonb, $4, $5, coalesce($6::timestamptz, now()), $7)
     returning id`,
    [
      randomUUID(),
      opts.creatorId,
      opts.type ?? "client_confirmation",
      opts.status ?? "pending",
      opts.attemptCount ?? 0,
      opts.createdAt ?? null,
      opts.lastError ?? null,
    ],
  );
  return rows[0].id;
}

describe("getCreatorNotifications", () => {
  it("(1) returns the creator's notifications with their real fields", async () => {
    const creator = await seedCreator(pool);
    await insertNotification({ creatorId: creator, type: "monthly_summary", status: "sent" });
    await insertNotification({ creatorId: creator, type: "creator_plan_limit", status: "dead_letter", attemptCount: 4, lastError: "whatsapp 400" });

    const rows = await getCreatorNotifications(creator, pool);
    expect(rows).toHaveLength(2);
    const dl = rows.find((r) => r.type === "creator_plan_limit")!;
    expect(dl.status).toBe("dead_letter");
    expect(dl.attemptCount).toBe(4);
    expect(dl.lastError).toBe("whatsapp 400");
    expect(typeof dl.createdAt).toBe("string");
  });

  it("(3) orders newest first", async () => {
    const creator = await seedCreator(pool);
    await insertNotification({ creatorId: creator, type: "client_confirmation", createdAt: "2026-01-01T00:00:00Z" });
    await insertNotification({ creatorId: creator, type: "monthly_summary", createdAt: "2026-03-01T00:00:00Z" });
    await insertNotification({ creatorId: creator, type: "creator_plan_limit", createdAt: "2026-02-01T00:00:00Z" });

    const rows = await getCreatorNotifications(creator, pool);
    expect(rows.map((r) => r.type)).toEqual(["monthly_summary", "creator_plan_limit", "client_confirmation"]);
  });

  it("(4) caps at the last 20, newest first", async () => {
    const creator = await seedCreator(pool);
    for (let i = 0; i < 25; i++) {
      await insertNotification({ creatorId: creator, createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() });
    }
    const rows = await getCreatorNotifications(creator, pool);
    expect(rows).toHaveLength(20);
    // newest (minute 24) first
    expect(new Date(rows[0].createdAt).getTime()).toBeGreaterThan(new Date(rows[19].createdAt).getTime());
  });

  it("(4-empty) returns [] when the creator has no notifications", async () => {
    const creator = await seedCreator(pool);
    expect(await getCreatorNotifications(creator, pool)).toEqual([]);
  });

  it("(5)+(6) is creator-scoped — never returns another creator's notifications", async () => {
    const a = await seedCreator(pool);
    const b = await seedCreator(pool);
    await insertNotification({ creatorId: a, type: "monthly_summary" });
    await insertNotification({ creatorId: b, type: "monthly_summary" });
    await insertNotification({ creatorId: b, type: "client_confirmation" });

    const rowsA = await getCreatorNotifications(a, pool);
    expect(rowsA).toHaveLength(1);
    const rowsB = await getCreatorNotifications(b, pool);
    expect(rowsB).toHaveLength(2);
    // A's set and B's set never overlap
    const idsA = new Set(rowsA.map((r) => r.id));
    expect(rowsB.every((r) => !idsA.has(r.id))).toBe(true);
  });
});
