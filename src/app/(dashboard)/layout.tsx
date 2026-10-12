import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import type { ShellStatus } from "@/components/layout/TopBar";
import { requirePageUser } from "@/lib/auth/session";
import { formatTimestamp, formatWindow, releaseWindow, TIMEZONE } from "@/lib/dates/ist";
import { lastSuccessfulRun, latestRuns } from "@/lib/db/ops";
import { getPreferences, getProfile, lastSuccessfulDelivery } from "@/lib/db/users";
import { isConfigured } from "@/lib/env";
import { formatRun, nextDigestRun } from "@/lib/schedule";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  if (!isConfigured("supabase")) redirect("/setup");
  const { user, db } = await requirePageUser();
  const [prefs, profile, lastOk, recent, delivered] = await Promise.all([
    getPreferences(db, user.id),
    getProfile(db, user.id),
    lastSuccessfulRun(db, "release_refresh"),
    latestRuns(db, "release_refresh", 1),
    lastSuccessfulDelivery(db, user.id),
  ]);

  const now = new Date();
  const status: ShellStatus = {
    todayLabel: now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TIMEZONE }),
    windowLabel: formatWindow(releaseWindow(now)),
    lastSyncedAt: lastOk?.completedAt ?? null,
    lastSyncedLabel: lastOk?.completedAt ? formatTimestamp(lastOk.completedAt) : null,
    lastRefreshFailed: recent[0]?.status === "failed",
    lastDeliveryLabel: delivered ? formatTimestamp(delivered) : null,
    telegramConnected: prefs.telegramConnected,
    digestEnabled: prefs.digestEnabled,
    nextRunLabel: prefs.digestEnabled ? formatRun(nextDigestRun(prefs.digestDay, now)) : null,
  };

  return (
    <AppShell user={{ email: user.email, displayName: profile.displayName }} status={status}>
      {children}
    </AppShell>
  );
}

// Per-request: reads the session and runtime configuration.
export const dynamic = "force-dynamic";
