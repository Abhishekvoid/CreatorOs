import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ConfirmingPoller from "@/components/public-profile/ConfirmingPoller";

export const metadata: Metadata = {
  title: "Confirming your booking | CreatorOS",
};

/**
 * Confirming screen. The checkout callback is not authority — this page polls
 * our own backend (ConfirmingPoller) until the Processor has confirmed the
 * booking, then forwards to success.
 */
export default async function ConfirmingPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { handle } = await params;
  const { c } = await searchParams;
  if (!c) redirect(`/${handle}`);

  return (
    <main className="relative min-h-screen">
      <ConfirmingPoller correlationId={c} />
    </main>
  );
}
