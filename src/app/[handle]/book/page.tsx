import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookingExperience from "@/components/public-profile/BookingExperience";
import { LogoMark } from "@/components/ui";
import { loadCreatorPage, selectBookingService } from "@/lib/public-profile";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const page = await loadCreatorPage(handle);
  return { title: page ? `Book with ${page.creator.name} | CreatorOS` : "Book | CreatorOS" };
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ service?: string; name?: string; email?: string; phone?: string }>;
}) {
  const { handle } = await params;
  const { service: serviceId, name, email, phone } = await searchParams;
  const page = await loadCreatorPage(handle);
  if (!page || page.services.length === 0) notFound();

  // A valid own active-service id preselects it; anything else (missing,
  // deleted, archived, cross-creator, garbage) falls back to the first service.
  const service = selectBookingService(page.services, serviceId)!;

  // Optional prefill from a rebook deep-link. These are treated purely as
  // editable form defaults — no lookup is performed against them — so the
  // public page can never be used to read stored client data.
  const initialCustomer =
    name || email || phone ? { name, email, phone } : undefined;

  return (
    <main className="relative min-h-screen">
      <div className="mx-auto max-w-[1160px] px-6 pb-[clamp(56px,8vw,96px)] pt-[clamp(40px,6vw,72px)]">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[clamp(24px,3.2vw,32px)] font-black tracking-[-0.02em]">
            Book with <span className="text-grad">{page.creator.name}</span>
          </h1>
          <Link href={`/${handle}`} className="text-[13px] font-bold text-muted underline-offset-4 hover:text-ink hover:underline">
            ← Back to profile
          </Link>
        </div>
        <BookingExperience handle={handle} creatorName={page.creator.name} service={service} initialCustomer={initialCustomer} />
      </div>
      <footer className="border-t border-line bg-paper py-6">
        <Link href="/" className="mx-auto flex w-max items-center gap-2 text-[13px] font-bold text-muted transition-colors hover:text-ink">
          <LogoMark className="size-[20px] rounded-[7px]" />
          Powered by CreatorOS
        </Link>
      </footer>
    </main>
  );
}
