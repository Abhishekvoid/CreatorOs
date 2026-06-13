import { ingestWebhook } from "@/lib/payments/ingest";

/**
 * Razorpay webhook endpoint — a thin HTTP adapter. It reads the raw body and
 * the relevant headers, hands them to ingestWebhook(), and maps the result to
 * a status code. No database access and no business logic live here.
 */
export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");

  try {
    const result = await ingestWebhook({ rawBody, signature, eventId });
    if (result.status === "invalid_signature") {
      return json(400, { error: "invalid signature" });
    }
    return json(200, { status: result.status });
  } catch {
    return json(500, { error: "ingest failed" });
  }
}
