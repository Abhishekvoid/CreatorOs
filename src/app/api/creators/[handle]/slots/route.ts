import { getCreatorSlots, CreatorNotFoundError, ServiceNotFoundError } from "@/lib/booking-initiate";

/**
 * Available slots for a creator + service across [from, to). Read-only. The
 * underlying Booking Service computes availability from booking_locks (Rule 5),
 * so occupied and pending-reconciliation slots are already absent.
 */
export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await params;
  const sp = new URL(request.url).searchParams;
  const serviceId = sp.get("serviceId");
  const from = sp.get("from");
  const to = sp.get("to");
  if (!serviceId || !from || !to) return json(400, { error: "serviceId, from and to are required" });

  try {
    const slots = await getCreatorSlots({ handle, serviceId, from, to });
    return json(200, { slots });
  } catch (err) {
    if (err instanceof CreatorNotFoundError || err instanceof ServiceNotFoundError) {
      return json(404, { error: "not found" });
    }
    return json(500, { error: "could not load slots" });
  }
}
