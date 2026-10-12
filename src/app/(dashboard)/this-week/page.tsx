import type { Metadata } from "next";
import { Suspense } from "react";
import { ThisWeekView } from "@/components/releases/ThisWeekView";
import { requirePageUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/db/users";
import { getCatalogue } from "@/services/catalogue.service";

export const metadata: Metadata = { title: "This Week" };

export default async function ThisWeekPage() {
  const { user, db } = await requirePageUser();
  const prefs = await getPreferences(db, user.id);
  const c = await getCatalogue(db, user.id, prefs);
  return (
    <Suspense>
      <ThisWeekView initialItems={c.items} prefs={prefs} window={c.window} lastSyncedAt={c.lastSyncedAt} lastRefreshFailed={c.lastRefresh?.status === "failed"} />
    </Suspense>
  );
}
