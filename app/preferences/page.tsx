import { Suspense } from "react";
import { connection } from "next/server";
import { PreferencesForm } from "@/components/PreferencesForm";
import { getPreferences } from "@/lib/store";

export default function PreferencesPage() {
  return (
    <section className="mx-auto max-w-2xl pt-14">
      <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">Taste profile</p>
      <h1 className="font-display text-5xl">Preferences</h1>
      <p className="mt-3 text-muted">The digest only keeps titles in these languages, on these platforms, matching at least one genre.</p>
      <Suspense fallback={<p className="py-16 text-muted">Loading…</p>}>
        <Form />
      </Suspense>
    </section>
  );
}

async function Form() {
  await connection();
  return <PreferencesForm initial={await getPreferences()} />;
}
