import { SlotUnavailableError } from "@/lib/booking";
import { BookingsUnavailableError } from "@/lib/billing/enforcement";
import { initiateBooking, CreatorNotFoundError, ServiceNotFoundError } from "@/lib/booking-initiate";

/**
 * Booking initiate endpoint — a thin adapter over initiateBooking(). It resolves
 * the creator + service, prices server-side, and calls the Phase 3 orchestrator
 * (booking + lock + provider order). NO confirmation logic lives here or
 * anywhere the browser can reach; confirmation flows through the webhook/sweep →
 * Processor only.
 */
export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type Body = Partial<{
  creatorHandle: string;
  serviceId: string;
  slotStart: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}>;

export async function POST(request: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  const { creatorHandle, serviceId, slotStart, customerName, customerEmail, customerPhone } = body;
  if (!creatorHandle || !serviceId || !slotStart || !customerName || !customerEmail || !customerPhone) {
    return json(400, { error: "missing required fields" });
  }
  if (Number.isNaN(Date.parse(slotStart))) {
    return json(400, { error: "invalid slotStart" });
  }

  try {
    const result = await initiateBooking({
      creatorHandle,
      serviceId,
      slotStart,
      customerName,
      customerEmail,
      customerPhone,
    });
    return json(200, { ...result });
  } catch (err) {
    if (err instanceof CreatorNotFoundError || err instanceof ServiceNotFoundError) {
      return json(404, { error: "not found" });
    }
    if (err instanceof SlotUnavailableError) {
      return json(409, { error: "slot no longer available" });
    }
    // Decision B: a neutral, dignified signal — NO mention of limit/plan/tier.
    // To the visitor this reads as a deliberate availability choice. The client
    // offers the creator's WhatsApp as the way to arrange a time.
    if (err instanceof BookingsUnavailableError) {
      return json(403, { error: "bookings_unavailable", whatsappNumber: err.whatsappNumber });
    }
    return json(500, { error: "could not start booking" });
  }
}
