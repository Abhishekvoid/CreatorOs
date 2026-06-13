"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicService } from "@/lib/public-profile";
import AvailabilityCalendar from "./AvailabilityCalendar";
import BookingForm, { type Customer } from "./BookingForm";
import BookingSummary from "./BookingSummary";
import ServiceCard, { inr } from "./ServiceCard";
import SlotPicker, { type Slot } from "./SlotPicker";

type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void };

function loadRazorpay(): Promise<RazorpayCtor | null> {
  return new Promise((resolve) => {
    const w = window as unknown as { Razorpay?: RazorpayCtor };
    if (w.Razorpay) return resolve(w.Razorpay);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve((window as unknown as { Razorpay?: RazorpayCtor }).Razorpay ?? null);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

/**
 * The booking flow root (client). Composes calendar + slot picker + form, then
 * initiates through our API and opens Razorpay checkout. The checkout callback
 * is NOT authority — on success we only navigate to the confirming screen,
 * which polls our backend for the real booking status. In keyless dev (no
 * public key) we route through the gated dev webhook simulator so the same
 * webhook → Processor path still does the confirming.
 */
export default function BookingExperience({
  handle,
  creatorName,
  service,
}: {
  handle: string;
  creatorName: string;
  service: PublicService;
}) {
  const router = useRouter();
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = date !== null && slot !== null;

  async function submit(customer: Customer) {
    if (!ready || processing) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          creatorHandle: handle,
          serviceId: service.id,
          slotStart: slot!.slotStart,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 409 ? "That slot was just taken — please pick another." : "Couldn't start the booking. Try again.");
        setProcessing(false);
        return;
      }

      const { correlationId, orderId, amount, key } = data as { correlationId: string; orderId: string; amount: number; key: string };
      const confirming = `/${handle}/book/confirming?c=${encodeURIComponent(correlationId)}`;

      if (key) {
        const Razorpay = await loadRazorpay();
        if (!Razorpay) {
          setError("Couldn't load the payment window. Try again.");
          setProcessing(false);
          return;
        }
        const rzp = new Razorpay({
          key,
          order_id: orderId,
          amount,
          currency: "INR",
          name: creatorName,
          description: service.title,
          prefill: { name: customer.name, email: customer.email, contact: customer.phone },
          handler: () => router.push(confirming),
          modal: { ondismiss: () => setProcessing(false) },
        });
        rzp.open();
      } else {
        // keyless dev: drive the signed webhook through the real ingestor
        await fetch("/api/dev/simulate-webhook", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ correlationId }),
        });
        router.push(confirming);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setProcessing(false);
    }
  }

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[1fr_392px]">
      <div className="flex min-w-0 flex-col gap-5">
        <ServiceCard handle={handle} service={service} featured />

        <section className="rounded-[26px] border border-line bg-paper p-6.5 max-sm:p-5">
          <h2 className="mb-5 text-[18px] font-bold tracking-tight">Pick a date</h2>
          <AvailabilityCalendar
            selected={date}
            onSelect={(d) => {
              setDate(d);
              setSlot(null);
            }}
          />
        </section>

        <section className="rounded-[26px] border border-line bg-paper p-6.5 max-sm:p-5">
          <h2 className="mb-5 text-[18px] font-bold tracking-tight">Pick a time</h2>
          <SlotPicker handle={handle} serviceId={service.id} date={date} selected={slot} onSelect={setSlot} />
        </section>

        <section className="rounded-[26px] border border-line bg-paper p-6.5 max-sm:p-5">
          <h2 className="mb-5 text-[18px] font-bold tracking-tight">Your details</h2>
          <BookingForm
            ready={ready}
            processing={processing}
            error={error}
            ctaLabel={`Continue • ${inr(service.pricePaise)} →`}
            onSubmit={submit}
          />
        </section>
      </div>

      <aside className="lg:sticky lg:top-24">
        <BookingSummary creatorName={creatorName} service={service} date={date} slot={slot} />
      </aside>
    </div>
  );
}
