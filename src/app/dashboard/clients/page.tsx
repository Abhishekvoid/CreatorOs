import type { Metadata } from "next";
import ClientsList from "@/components/dashboard/ClientsList";
import Shell from "@/components/dashboard/Shell";
import { getCreatorClients, type ClientListItem } from "@/lib/clients";
import { getDashboardIdentity } from "@/lib/dashboard-identity";

export const metadata: Metadata = {
  title: "Clients | CreatorOS",
  description: "Your customer database — built automatically from confirmed bookings.",
};

export default async function ClientsPage() {
  // Same owner-scoped path as bookings: identity from Supabase, clients from
  // the service-role pool, every query pinned to this creator.
  const identity = await getDashboardIdentity();
  let clients: ClientListItem[] = [];

  if (identity) {
    try {
      clients = await getCreatorClients(identity.userId);
    } catch (err) {
      // Page still renders (empty) if the store is unreachable.
      console.error("[clients] failed to load creator clients", err);
    }
  }

  return (
    <Shell creator={identity?.creator ?? null}>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Clients</h1>
          <p className="mt-1 text-[13.5px] font-medium text-muted">
            Everyone who&rsquo;s booked you — built automatically, no data entry.
          </p>
        </div>
        <ClientsList clients={clients} />
      </div>
    </Shell>
  );
}
