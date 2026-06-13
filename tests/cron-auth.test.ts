import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { GET as reconcileGET } from "@/app/api/cron/reconcile/route";
import { GET as notificationsGET } from "@/app/api/cron/notifications/route";
import { GET as integrityGET } from "@/app/api/cron/integrity/route";
import proxy from "@/proxy";

/**
 * Phase 6.1 — cron endpoint authorization. Every /api/cron/* request must carry
 * the shared secret as `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`,
 * else 401. The check is a pure, Edge-safe function (also used by middleware).
 */

const SECRET = "cron_test_secret_value";

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
});

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/cron/reconcile", { headers });
}

describe("isCronAuthorized", () => {
  it("accepts Authorization: Bearer <CRON_SECRET>", () => {
    expect(isCronAuthorized(req({ authorization: `Bearer ${SECRET}` }))).toBe(true);
  });

  it("accepts x-cron-secret", () => {
    expect(isCronAuthorized(req({ "x-cron-secret": SECRET }))).toBe(true);
  });

  it("rejects a wrong bearer token", () => {
    expect(isCronAuthorized(req({ authorization: "Bearer wrong" }))).toBe(false);
  });

  it("rejects a wrong x-cron-secret", () => {
    expect(isCronAuthorized(req({ "x-cron-secret": "wrong" }))).toBe(false);
  });

  it("rejects the bearer scheme without a value", () => {
    expect(isCronAuthorized(req({ authorization: "Bearer " }))).toBe(false);
  });

  it("rejects a request with no credentials", () => {
    expect(isCronAuthorized(req({}))).toBe(false);
  });

  it("denies everything when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(req({ authorization: `Bearer ${SECRET}` }))).toBe(false);
    expect(isCronAuthorized(req({ "x-cron-secret": SECRET }))).toBe(false);
  });
});

describe("cronUnauthorized", () => {
  it("is a 401 JSON response", async () => {
    const res = cronUnauthorized();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });
});

describe("reconcile route enforces the guard", () => {
  it("returns 401 with no credentials (and does not run the sweep)", async () => {
    const res = await reconcileGET(req({}));
    expect(res.status).toBe(401);
  });
});

describe("notifications route enforces the guard", () => {
  it("returns 401 with no credentials (and does not run the worker)", async () => {
    const res = await notificationsGET(req({}));
    expect(res.status).toBe(401);
  });
});

describe("integrity route enforces the guard", () => {
  it("returns 401 with no credentials (and does not run the checks)", async () => {
    const res = await integrityGET(req({}));
    expect(res.status).toBe(401);
  });
});

describe("proxy blankets /api/cron/*", () => {
  function cronReq(headers: Record<string, string>): NextRequest {
    return new NextRequest("http://localhost/api/cron/process-events", { headers });
  }

  it("401s an unauthorized cron request — even for an endpoint that doesn't exist yet", async () => {
    const res = await proxy(cronReq({}));
    expect(res.status).toBe(401);
  });

  it("passes an authorized cron request through", async () => {
    const res = await proxy(cronReq({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
  });
});
