import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClientDetail from "@/components/dashboard/ClientDetail";
import Shell from "@/components/dashboard/Shell";
import { getCreatorClientDetail } from "@/lib/clients";
import { getDashboardIdentity } from "@/lib/dashboard-identity";

export const metadata: Metadata = {
  title: "Client | CreatorOS",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const identity = await getDashboardIdentity();
  // No signed-in creator (e.g. local dev without Supabase) → nothing to show.
  if (!identity) notFound();

  // getCreatorClientDetail is scoped by creator_id: another creator's client
  // id (or a non-existent one) returns null → 404. This is the access control.
  const client = await getCreatorClientDetail(identity.userId, id);
  if (!client) notFound();

  return (
    <Shell creator={identity.creator}>
      <ClientDetail client={client} creatorName={identity.creator.name} creatorHandle={identity.creator.handle} />
    </Shell>
  );
}
