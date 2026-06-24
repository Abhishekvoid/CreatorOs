import { describe, expect, it, vi } from "vitest";
import { RealNotificationProvider, type NotificationMessage } from "@/lib/notifications/provider";

/**
 * RealNotificationProvider (WhatsApp Cloud API) — pure unit tests with an
 * injected fetch double. No network. Verifies the to+text contract, the
 * retryable-vs-permanent failure mapping the worker relies on, and that the
 * access token / payload never leak into the returned error.
 */

const TOKEN = "SECRET_TOKEN_should_never_leak";

function provider(fetchImpl: typeof fetch) {
  return new RealNotificationProvider({
    accessToken: TOKEN,
    phoneNumberId: "PNID123",
    fetchImpl,
    timeoutMs: 50,
  });
}

function msg(payload: Record<string, unknown>): NotificationMessage {
  return { id: "n1", correlationId: "c1", bookingId: null, type: "monthly_summary", channel: "whatsapp", payload };
}

function res(status: number): Response {
  return { ok: status >= 200 && status < 300, status, text: async () => "" } as unknown as Response;
}

describe("RealNotificationProvider", () => {
  it("(1) success: posts to the Graph API and returns ok", async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => res(200),
    );
    const r = await provider(fetchImpl as unknown as typeof fetch).send(msg({ to: "+91 98765 43210", text: "Hi" }));
    expect(r.ok).toBe(true);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/PNID123/messages");
    const headers = init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    const body = JSON.parse(String(init!.body));
    expect(body.to).toBe("919876543210"); // digits only
    expect(body.text.body).toBe("Hi");
  });

  it("(permanent) missing to or text fails permanently and never calls fetch", async () => {
    const fetchImpl = vi.fn(async () => res(200));
    const r1 = await provider(fetchImpl).send(msg({ text: "Hi" }));
    const r2 = await provider(fetchImpl).send(msg({ to: "+919812345678" }));
    expect(r1).toMatchObject({ ok: false, retryable: false });
    expect(r2).toMatchObject({ ok: false, retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("(retryable) 5xx and 429 are retryable", async () => {
    expect(await provider(vi.fn(async () => res(500))).send(msg({ to: "+91", text: "x" }))).toMatchObject({ ok: false, retryable: true });
    expect(await provider(vi.fn(async () => res(429))).send(msg({ to: "+91", text: "x" }))).toMatchObject({ ok: false, retryable: true });
  });

  it("(permanent) other 4xx are permanent", async () => {
    expect(await provider(vi.fn(async () => res(400))).send(msg({ to: "+91", text: "x" }))).toMatchObject({ ok: false, retryable: false });
  });

  it("(retryable) a network error / timeout is retryable", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch;
    expect(await provider(fetchImpl).send(msg({ to: "+91", text: "x" }))).toMatchObject({ ok: false, retryable: true });
  });

  it("(security) the access token never appears in the error", async () => {
    const fetchImpl = vi.fn(async () => res(403));
    const r = await provider(fetchImpl).send(msg({ to: "+91", text: "x" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toContain(TOKEN);
  });
});
