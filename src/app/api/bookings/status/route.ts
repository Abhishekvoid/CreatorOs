import { getBookingStatus } from "@/lib/booking-initiate";

/**
 * Booking status endpoint — the confirming screen's poll target. STRICTLY
 * read-only: it returns the booking's current status and nothing it does can
 * change truth. The browser is never authority; this only reflects what the
 * Processor has already decided.
 */
export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function GET(request: Request): Promise<Response> {
  const correlationId = new URL(request.url).searchParams.get("correlationId");
  if (!correlationId) return json(400, { error: "correlationId required" });

  try {
    const status = await getBookingStatus(correlationId);
    if (!status) return json(404, { error: "not found" });
    return json(200, { ...status });
  } catch {
    return json(500, { error: "could not read status" });
  }
}
