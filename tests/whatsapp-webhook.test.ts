import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, summarizeEvents } from "@/app/api/webhooks/whatsapp/route";

/**
 * WhatsApp Cloud API webhook — pure route-handler tests, no network, no DB.
 * Covers Meta's GET verification handshake, defensive POST ingestion (fast 200,
 * never throws on unsupported/oddly-shaped events, rejects malformed bodies),
 * and the privacy invariant: phone numbers, message text and the verify token
 * never reach the logs.
 */

const VERIFY_TOKEN = "test_verify_token_123";
const PHONE = "919876543210";
const SECRET_TEXT = "hello this is a private message body";

beforeEach(() => {
  process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function get(params: Record<string, string>): Promise<Response> {
  const url = new URL("http://localhost/api/webhooks/whatsapp");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return Promise.resolve(GET(new Request(url, { method: "GET" })));
}

function post(body: string, contentType = "application/json"): Promise<Response> {
  return POST(
    new Request("http://localhost/api/webhooks/whatsapp", {
      method: "POST",
      body,
      headers: { "content-type": contentType },
    }),
  );
}

function statusPayload(messageId: string, status: string): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: PHONE, phone_number_id: "PNID" },
              statuses: [{ id: messageId, status, timestamp: "1700000000", recipient_id: PHONE }],
            },
          },
        ],
      },
    ],
  });
}

function incomingPayload(messageId: string): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: PHONE, phone_number_id: "PNID" },
              contacts: [{ wa_id: PHONE, profile: { name: "Jane" } }],
              messages: [{ id: messageId, from: PHONE, type: "text", text: { body: SECRET_TEXT } }],
            },
          },
        ],
      },
    ],
  });
}

describe("WhatsApp webhook — GET verification", () => {
  it("(1) returns the challenge as plain text when the token matches", async () => {
    const res = await get({
      "hub.mode": "subscribe",
      "hub.verify_token": VERIFY_TOKEN,
      "hub.challenge": "1158201444",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("1158201444");
  });

  it("(2) returns 403 when the verify token is wrong", async () => {
    const res = await get({
      "hub.mode": "subscribe",
      "hub.verify_token": "WRONG",
      "hub.challenge": "1158201444",
    });
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("1158201444");
  });

  it("returns 403 when hub.mode is not 'subscribe'", async () => {
    const res = await get({
      "hub.mode": "unsubscribe",
      "hub.verify_token": VERIFY_TOKEN,
      "hub.challenge": "x",
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when params are missing", async () => {
    expect((await get({})).status).toBe(403);
  });
});

describe("WhatsApp webhook — POST ingestion", () => {
  it("(3) accepts a valid status payload and returns 200", async () => {
    const res = await post(statusPayload("wamid.ABC", "delivered"));
    expect(res.status).toBe(200);
  });

  it("(4) ignores an unsupported event shape and still returns 200", async () => {
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "X", changes: [{ field: "account_alerts", value: { something: true } }] }],
    });
    const res = await post(body);
    expect(res.status).toBe(200);
  });

  it("accepts an incoming message payload and returns 200", async () => {
    const res = await post(incomingPayload("wamid.IN1"));
    expect(res.status).toBe(200);
  });

  it("(5) rejects an unparseable body with 400", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
  });

  it("(5) rejects a wrong-shape JSON object with 400", async () => {
    const res = await post(JSON.stringify({ object: "instagram", entry: [] }));
    expect(res.status).toBe(400);
  });

  it("(5) rejects a non-JSON content type with 400", async () => {
    const res = await post(statusPayload("wamid.A", "sent"), "text/plain");
    expect(res.status).toBe(400);
  });

  it("(7) responds in well under a second without external calls", async () => {
    const started = Date.now();
    const res = await post(statusPayload("wamid.FAST", "read"));
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(200);
  });
});

describe("WhatsApp webhook — logging privacy (6)", () => {
  it("never logs phone numbers, message text, or the verify token", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    });
    vi.spyOn(console, "info").mockImplementation((...args) => {
      logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args) => {
      logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    });

    await post(incomingPayload("wamid.PRIV"));
    await get({ "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "c" });

    const blob = logged.join("\n");
    expect(blob).not.toContain(PHONE);
    expect(blob).not.toContain(SECRET_TEXT);
    expect(blob).not.toContain(VERIFY_TOKEN);
  });
});

describe("summarizeEvents — pure log-safe projection", () => {
  it("projects statuses to {kind,status,messageId} with no PII", () => {
    const out = summarizeEvents(JSON.parse(statusPayload("wamid.S1", "delivered")));
    expect(out).toEqual([{ kind: "status", messageId: "wamid.S1", status: "delivered" }]);
  });

  it("projects incoming messages without text or sender", () => {
    const out = summarizeEvents(JSON.parse(incomingPayload("wamid.M1")));
    expect(out).toEqual([{ kind: "incoming", messageId: "wamid.M1", messageType: "text" }]);
    expect(JSON.stringify(out)).not.toContain(SECRET_TEXT);
    expect(JSON.stringify(out)).not.toContain(PHONE);
  });

  it("marks an unrecognized change as unsupported", () => {
    const out = summarizeEvents({
      object: "whatsapp_business_account",
      entry: [{ id: "X", changes: [{ field: "account_review_update", value: {} }] }],
    });
    expect(out).toEqual([{ kind: "unsupported", field: "account_review_update" }]);
  });
});
