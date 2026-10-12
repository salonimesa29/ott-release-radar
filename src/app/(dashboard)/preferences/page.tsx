import type { Metadata } from "next";
import { PreferencesForm } from "@/components/preferences/PreferencesForm";
import { requirePageUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/db/users";

export const metadata: Metadata = { title: "My Preferences" };

export default async function PreferencesPage() {
  const { user, db } = await requirePageUser();
  return (
    <div className="mx-auto max-w-3xl space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan">Taste profile</p>
      <h1 className="font-display text-4xl sm:text-5xl">My Preferences</h1>
      <p className="text-muted-foreground">Saved to your account and used for your digest and AI recommendations. Only genres, languages and platforms are required.</p>
      <PreferencesForm initial={await getPreferences(db, user.id)} />
    </div>
  );
}
