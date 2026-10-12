"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDashed, ExternalLink, Loader2, LogOut, RefreshCw, Send, Unplug, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PROVIDERS } from "@/config/providers";
import { DISCOVERY_MODES, GENRES, WEEKDAYS, languageLabel } from "@/config/taxonomy";
import { api } from "@/lib/client-api";
import { formatTimestamp } from "@/lib/dates/ist";
import { cn } from "@/lib/utils";
import type { IntegrationHealth, Preferences } from "@/types/domain";

type RunInfo = { status: string; at: string; message: string | null } | null;
type Automation = { nextRun: string | null; lastRefreshOk: string | null; lastRefresh: RunInfo; lastDigestOk: string | null; lastDigest: RunInfo; lastDelivery: string | null };

export function SettingsView({ email, displayName, prefs, automation }: { email: string | null; displayName: string | null; prefs: Preferences; automation: Automation }) {
  const router = useRouter();
  const [name, setName] = useState(displayName ?? "");
  const [digestEnabled, setDigestEnabled] = useState(prefs.digestEnabled);
  const [digestDay, setDigestDay] = useState(prefs.digestDay);
  const [health, setHealth] = useState<IntegrationHealth[] | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);

  const loadHealth = useCallback(async (force = false) => {
    setHealthBusy(true);
    const res = await api<{ integrations: IntegrationHealth[] }>(`/api/health${force ? "?force=1" : ""}`);
    setHealthBusy(false);
    if (res.ok) setHealth(res.data.integrations);
    else toast.error(res.error);
  }, []);
  useEffect(() => {
    let live = true;
    api<{ integrations: IntegrationHealth[] }>("/api/health").then((res) => {
      if (live && res.ok) setHealth(res.data.integrations);
    });
    return () => {
      live = false;
    };
  }, []);

  async function saveDigest(patch: { digestEnabled?: boolean; digestDay?: number }) {
    const res = await api("/api/preferences", { method: "PUT", body: patch });
    if (res.ok) {
      toast.success("Digest settings saved");
      router.refresh();
    } else toast.error(res.error);
    return res.ok;
  }

  const h = (n: IntegrationHealth["name"]) => health?.find((i) => i.name === n);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan">Control room</p>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl">Settings</h1>
      </div>

      <Card title="Account">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs text-muted-foreground">Display name</label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-64" maxLength={80} />
          </div>
          <Button variant="secondary" disabled={!name.trim() || name === displayName} onClick={async () => {
            const res = await api("/api/profile", { method: "PATCH", body: { displayName: name } });
            if (res.ok) { toast.success("Profile updated"); router.refresh(); } else toast.error(res.error);
          }}>Save</Button>
          <form action="/auth/signout" method="post" className="ml-auto">
            <Button variant="ghost" type="submit"><LogOut /> Sign out</Button>
          </form>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Signed in as {email}</p>
      </Card>

      <Card title="Preferences" action={<Button asChild variant="secondary" size="sm"><Link href="/preferences">Edit</Link></Button>}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <KV k="Genres" v={prefs.genres.map((g) => GENRES[g].label).join(", ") || "Any"} />
          <KV k="Languages" v={prefs.languages.map(languageLabel).join(", ")} />
          <KV k="Platforms" v={prefs.platforms.map((p) => PROVIDERS[p].shortLabel).join(", ")} />
          <KV k="Discovery mode" v={DISCOVERY_MODES.find((d) => d.key === prefs.discoveryMode)!.label} />
        </dl>
      </Card>

      <Card title="Weekly digest">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={digestEnabled} onCheckedChange={async (v) => { setDigestEnabled(v); if (!(await saveDigest({ digestEnabled: v }))) setDigestEnabled(!v); }} />
            {digestEnabled ? "Enabled" : "Disabled"}
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Delivery day</span>
            <Select value={String(digestDay)} onValueChange={async (v) => { const prev = digestDay; setDigestDay(Number(v)); if (!(await saveDigest({ digestDay: Number(v) }))) setDigestDay(prev); }}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{WEEKDAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <KV k="Delivery time" v="6:00 PM (fixed by schedule)" />
          <KV k="Timezone" v="Asia/Kolkata (IST)" />
        </div>
      </Card>

      <TelegramCard initiallyConnected={prefs.telegramConnected} username={prefs.telegramUsername} health={h("telegram")} />

      <Card title="Data sources & AI" action={<Button variant="ghost" size="sm" onClick={() => loadHealth(true)} disabled={healthBusy}>{healthBusy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-check</Button>}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Health label="Supabase" item={h("supabase")} loading={!health} />
          <Health label="TMDB" item={h("tmdb")} loading={!health} />
          <Health label="Gemini Flash" item={h("gemini")} loading={!health} />
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <KV k="Last successful refresh" v={automation.lastRefreshOk ?? "Never"} />
          <KV k="Latest refresh result" v={automation.lastRefresh ? `${automation.lastRefresh.status} · ${automation.lastRefresh.at}${automation.lastRefresh.message ? ` — ${automation.lastRefresh.message}` : ""}` : "No runs yet"} />
          <KV k="Last successful recommendation run" v={h("gemini")?.lastSuccessAt ? `${formatTimestamp(h("gemini")!.lastSuccessAt!)} IST` : "Never"} />
        </dl>
      </Card>

      <Card title="Automation">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <KV k="Next scheduled digest" v={automation.nextRun ?? (prefs.digestEnabled ? "Can't be calculated" : "Digest disabled")} />
          <KV k="Last successful digest run" v={automation.lastDigestOk ?? "Never"} />
          <KV k="Last run status" v={automation.lastDigest ? `${automation.lastDigest.status} · ${automation.lastDigest.at}${automation.lastDigest.message ? ` — ${automation.lastDigest.message}` : ""}` : "No runs yet"} />
          <KV k="Last successful delivery to you" v={automation.lastDelivery ?? "None yet"} />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">Schedules are defined in vercel.json (UTC): release refresh daily 00:30 UTC (06:00 IST); digest check daily 12:30 UTC (18:00 IST), delivering to users whose digest day is today.</p>
      </Card>
    </div>
  );
}

function TelegramCard({ initiallyConnected, username, health }: { initiallyConnected: boolean; username: string | null; health?: IntegrationHealth }) {
  const router = useRouter();
  const [connected, setConnected] = useState(initiallyConnected);
  const [link, setLink] = useState<{ deepLink: string; botUsername: string; code: string } | null>(null);
  const [busy, setBusy] = useState<null | "connect" | "verify" | "test" | "disconnect">(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run<T>(kind: NonNullable<typeof busy>, url: string, method: string) {
    setBusy(kind);
    setMessage(null);
    const res = await api<T>(url, { method });
    setBusy(null);
    return res;
  }

  return (
    <Card title="Telegram">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm", connected ? "bg-watch/15 text-watch" : "bg-secondary text-muted-foreground")}>
          {connected ? <CheckCircle2 className="size-4" /> : <CircleDashed className="size-4" />}
          {connected ? `Connected${username ? ` as @${username}` : ""}` : "Not connected"}
        </span>
        {health?.status === "unconfigured" && <span className="text-xs text-maybe">Bot token isn’t configured on the server.</span>}
        {health?.status === "error" && <span className="text-xs text-skip">Bot check failed: {health.lastErrorMessage}</span>}
      </div>

      {!connected && (
        <ol className="mt-5 space-y-3 text-sm">
          <Step n={1} text="Open the Telegram bot." >
            {link ? (
              <a href={link.deepLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan hover:underline">Open @{link.botUsername} <ExternalLink className="size-3.5" /></a>
            ) : (
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={async () => {
                const res = await run<{ deepLink: string; botUsername: string; code: string }>("connect", "/api/telegram/connect", "POST");
                if (res.ok) setLink(res.data); else setMessage({ ok: false, text: res.error });
              }}>{busy === "connect" && <Loader2 className="animate-spin" />} Get my connection link</Button>
            )}
          </Step>
          <Step n={2} text="Start a conversation — tap Start (this sends your one-time code)." />
          <Step n={3} text="Verify the chat. We read the chat ID from Telegram itself; you never type it." >
            <Button size="sm" disabled={!link || busy !== null} onClick={async () => {
              const res = await run<{ connected: boolean; message: string }>("verify", "/api/telegram/verify", "POST");
              const ok = res.ok && res.data.connected;
              setMessage({ ok, text: res.ok ? res.data.message : (res.data as { message?: string } | undefined)?.message ?? res.error });
              if (ok) { setConnected(true); router.refresh(); }
            }}>{busy === "verify" && <Loader2 className="animate-spin" />} Verify & connect</Button>
          </Step>
          <Step n={4} text="Connected — then send a test digest below." />
        </ol>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button disabled={!connected || busy !== null} onClick={async () => {
          const res = await run<{ ok: boolean; status: string; error: string | null; titles?: number }>("test", "/api/telegram/test", "POST");
          const data = res.data;
          if (res.ok && data?.ok) setMessage({ ok: true, text: `Test digest delivered — Telegram accepted it (${data.titles ?? 0} titles).` });
          else setMessage({ ok: false, text: data?.error ?? (res.ok ? "Delivery failed" : res.error) });
          router.refresh();
        }}>{busy === "test" ? <Loader2 className="animate-spin" /> : <Send />} Send Test Digest</Button>
        {connected && (
          <>
            <Button variant="ghost" disabled={busy !== null} onClick={() => { setConnected(false); setLink(null); }}>Reconnect</Button>
            <Button variant="ghost" className="text-skip" disabled={busy !== null} onClick={async () => {
              const res = await run("disconnect", "/api/telegram/connect", "DELETE");
              if (res.ok) { setConnected(false); setLink(null); toast.success("Telegram disconnected"); router.refresh(); } else toast.error(res.error);
            }}><Unplug /> Disconnect</Button>
          </>
        )}
      </div>
      {message && <p role="status" className={cn("mt-3 text-sm", message.ok ? "text-watch" : "text-skip")}>{message.text}</p>}
    </Card>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-sm">{v}</dd>
    </div>
  );
}

function Step({ n, text, children }: { n: number; text: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-xs">{n}</span>
      <div className="space-y-2">
        <p>{text}</p>
        {children}
      </div>
    </li>
  );
}

function Health({ label, item, loading }: { label: string; item?: IntegrationHealth; loading: boolean }) {
  const status = item?.status ?? "unknown";
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center gap-2">
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : status === "ok" ? <CheckCircle2 className="size-4 text-watch" /> : status === "error" ? <XCircle className="size-4 text-skip" /> : <CircleDashed className="size-4 text-maybe" />}
        <span className="font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {loading ? "Checking…" : status === "ok" ? `Live check passed ${item?.lastCheckedAt ? formatTimestamp(item.lastCheckedAt) : ""}` : status === "unconfigured" ? "Not configured" : status === "error" ? item?.lastErrorMessage ?? "Error" : "Not checked yet"}
      </p>
    </div>
  );
}
