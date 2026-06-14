import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProfileHeader, {
  type ProfileHeaderData,
} from "@/components/profile/ProfileHeader";
import ServiceCard from "@/components/public-profile/ServiceCard";
import ServicesList from "@/components/public-profile/ServicesList";
import { LogoMark } from "@/components/ui";
import { loadCreatorPage } from "@/lib/public-profile";

/**
 * The real, dynamic public creator page at creatoros.in/{handle}. Resolves a
 * published creator + services from the database (SSR), 404s otherwise. Reuses
 * the genuinely data-driven ProfileHeader (cold-start mode → no demo metrics);
 * services and the booking card are real. The /meera demo is separate.
 */

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  console.log("CreatorPage handle:", handle);
  const page = await loadCreatorPage(handle);
  if (!page) return { title: "Not found | CreatorOS" };
  const { creator } = page;
  return {
    title: `${creator.name}${creator.title ? ` — ${creator.title}` : ""} | CreatorOS`,
    description: creator.bio ?? `Book a session with ${creator.name}.`,
  };
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const page = await loadCreatorPage(handle);

  if (!page) {
    throw new Error(`Creator not found for handle: ${handle}`);
  }

  const { creator, services } = page;
  const headerData: ProfileHeaderData = {
    name: creator.name,
    title: creator.title ?? "",
    bio: creator.bio ?? "",
    avatar: creator.avatar,
    location: creator.location ?? undefined,
    languages: creator.languages,
    highlights: creator.highlights,
    socials: Object.entries(creator.socials)
      .filter(([, v]) => v)
      .map(([k, v]) => ({ label: SOCIAL_LABELS[k] ?? k, href: v })),
  };

  return (
    <>
      <main>
        <ProfileHeader
          creator={headerData}
          coldStart
          serviceSlot={
            services[0] ? (
              <ServiceCard handle={handle} service={services[0]} featured />
            ) : undefined
          }
        />
        <ServicesList handle={handle} services={services} />
      </main>
      <footer className="border-t border-line bg-paper py-6">
        <Link
          href="/"
          className="mx-auto flex w-max items-center gap-2 text-[13px] font-bold text-muted transition-colors hover:text-ink"
        >
          <LogoMark className="size-[20px] rounded-[7px]" />
          Powered by CreatorOS
        </Link>
      </footer>
    </>
  );
}
