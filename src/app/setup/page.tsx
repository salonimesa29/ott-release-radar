import { CheckCircle2, XCircle } from "lucide-react";
import { LogoMark } from "@/components/common/Logo";
import { isConfigured, type EnvGroup } from "@/lib/env";

export const metadata = { title: "Setup required" };

const ITEMS: { group: EnvGroup; label: string; vars: string; required: boolean }[] = [
  { group: "supabase", label: "Supabase (database & auth)", vars: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY", required: true },
  { group: "tmdb", label: "TMDB (release data)", vars: "TMDB_API_KEY", required: true },
  { group: "gemini", label: "Gemini Flash (recommendations)", vars: "GEMINI_API_KEY, GEMINI_MODEL", required: false },
  { group: "telegram", label: "Telegram bot (digest delivery)", vars: "TELEGRAM_BOT_TOKEN", required: false },
  { group: "cron", label: "Cron secret (scheduled jobs)", vars: "CRON_SECRET", required: false },
];

/** Shown when required configuration is missing. Lists variable names only — never values. */
export default function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <LogoMark className="size-10" />
      <h1 className="mt-6 font-display text-5xl">Finish setting up</h1>
      <p className="mt-3 text-muted-foreground">
        Add these environment variables (see <code>.env.example</code> and the README), then restart the server or redeploy.
      </p>
      <ul className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
        {ITEMS.map((i) => {
          const ok = isConfigured(i.group);
          return (
            <li key={i.group} className="flex gap-4 p-5">
              {ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-watch" /> : <XCircle className={`mt-0.5 size-5 shrink-0 ${i.required ? "text-skip" : "text-maybe"}`} />}
              <div className="min-w-0">
                <p className="font-medium">
                  {i.label} {!i.required && <span className="text-xs text-muted-foreground">(optional to start)</span>}
                </p>
                <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{i.vars}</p>
              </div>
              <span className="ml-auto text-xs text-muted-foreground">{ok ? "Set" : "Missing"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Per-request: reads the session and runtime configuration.
export const dynamic = "force-dynamic";
