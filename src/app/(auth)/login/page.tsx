import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/common/LoginForm";
import { LogoMark } from "@/components/common/Logo";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!isConfigured("supabase")) redirect("/setup");
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/discover";
  const linkError = sp.error === "link";

  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-border lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(700px_400px_at_20%_20%,rgb(139_108_255/0.25),transparent_70%),radial-gradient(600px_400px_at_80%_90%,rgb(79_216_235/0.12),transparent_70%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-2xl">Release Radar</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan">Every Friday, 6 PM IST</p>
            <h1 className="mt-4 max-w-lg font-display text-6xl leading-[1.02] text-balance">
              Your next favourite watch, <em className="text-violet">discovered automatically.</em>
            </h1>
            <p className="mt-6 max-w-md text-muted-foreground">
              What actually landed on Netflix, Prime Video and Hotstar in India this week — filtered to your genres and languages, with an honest watch-or-skip from Gemini.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Release data: TMDB · Recommendations: Google Gemini Flash</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-16 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <span className="font-display text-2xl">Release Radar</span>
          </div>
          <h2 className="font-display text-4xl">Welcome back</h2>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to see what’s new on your platforms this week.</p>
          {linkError && <p className="mt-4 rounded-lg border border-skip/30 bg-skip/10 px-3 py-2 text-sm text-skip">That sign-in link is invalid or expired. Request a new one.</p>}
          <LoginForm next={next} />
        </div>
      </section>
    </div>
  );
}

// Per-request: reads the session and runtime configuration.
export const dynamic = "force-dynamic";
