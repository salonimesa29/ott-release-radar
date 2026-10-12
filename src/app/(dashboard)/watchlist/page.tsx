import type { Metadata } from "next";
import { WatchlistView } from "@/components/watchlist/WatchlistView";
import { requirePageUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/db/users";
import { getWatchlistItems } from "@/services/catalogue.service";

export const metadata: Metadata = { title: "My Watchlist" };

/** Reads only from Supabase, so it keeps working if TMDB is down. */
export default async function WatchlistPage() {
  const { user, db } = await requirePageUser();
  const prefs = await getPreferences(db, user.id);
  const items = await getWatchlistItems(db, user.id, prefs);
  return <WatchlistView initialItems={items} prefs={prefs} />;
}
