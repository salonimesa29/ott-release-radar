import type { Metadata } from "next";
import { DiscoverView } from "@/components/releases/DiscoverView";
import { requirePageUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/db/users";
import { getCatalogue } from "@/services/catalogue.service";

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage() {
  const { user, db } = await requirePageUser();
  const prefs = await getPreferences(db, user.id);
  const c = await getCatalogue(db, user.id, prefs);
  return (
    <DiscoverView
      initialItems={c.items}
      prefs={prefs}
      watchlistCount={c.watchlistCount}
      lastSyncedAt={c.lastSyncedAt}
      lastRefreshFailed={c.lastRefresh?.status === "failed"}
    />
  );
}
