import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/SettingsView";
import { requirePageUser } from "@/lib/auth/session";
import { formatTimestamp } from "@/lib/dates/ist";
import { lastSuccessfulRun, latestRuns } from "@/lib/db/ops";
import { getPreferences, getProfile, lastSuccessfulDelivery } from "@/lib/db/users";
import { formatRun, nextDigestRun } from "@/lib/schedule";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, db } = await requirePageUser();
  const [prefs, profile, refreshRuns, digestRuns, lastRefreshOk, lastDigestOk, lastDelivery] = await Promise.all([
    getPreferences(db, user.id),
    getProfile(db, user.id),
    latestRuns(db, "release_refresh", 1),
    latestRuns(db, "weekly_digest", 1),
    lastSuccessfulRun(db, "release_refresh"),
    lastSuccessfulRun(db, "weekly_digest"),
    lastSuccessfulDelivery(db, user.id),
  ]);
  const ts = (iso: string | null | undefined) => (iso ? `${formatTimestamp(iso)} IST` : null);

  return (
    <SettingsView
      email={user.email}
      displayName={profile.displayName}
      prefs={prefs}
      automation={{
        nextRun: prefs.digestEnabled ? formatRun(nextDigestRun(prefs.digestDay)) : null,
        lastRefreshOk: ts(lastRefreshOk?.completedAt),
        lastRefresh: refreshRuns[0] ? { status: refreshRuns[0].status, at: ts(refreshRuns[0].completedAt ?? refreshRuns[0].startedAt)!, message: (refreshRuns[0].summary?.message as string | undefined) ?? refreshRuns[0].errorSummary } : null,
        lastDigestOk: ts(lastDigestOk?.completedAt),
        lastDigest: digestRuns[0] ? { status: digestRuns[0].status, at: ts(digestRuns[0].completedAt ?? digestRuns[0].startedAt)!, message: digestRuns[0].errorSummary } : null,
        lastDelivery: ts(lastDelivery),
      }}
    />
  );
}
