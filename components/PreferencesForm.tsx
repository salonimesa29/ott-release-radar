"use client";
import { useState } from "react";
import { GENRES, LANGUAGES, PLATFORMS } from "@/lib/constants";
import type { Preferences } from "@/lib/types";
import { adminFetch } from "./admin";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function PreferencesForm({ initial }: { initial: Preferences }) {
  const [p, setP] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await adminFetch("/api/preferences", "PUT", p);
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(res.ok ? "Saved. The next digest will use these." : body.error ?? "Could not save");
  }

  return (
    <div className="mt-10 space-y-10">
      <Group title="Genres">
        {Object.keys(GENRES).map((g) => (
          <Chip key={g} on={p.genres.includes(g)} onClick={() => setP({ ...p, genres: toggle(p.genres, g) })}>
            {g}
          </Chip>
        ))}
      </Group>
      <Group title="Languages">
        {LANGUAGES.map((l) => (
          <Chip key={l.code} on={p.languages.includes(l.code)} onClick={() => setP({ ...p, languages: toggle(p.languages, l.code) })}>
            {l.label}
          </Chip>
        ))}
      </Group>
      <Group title="Platforms">
        {PLATFORMS.map((pl) => (
          <Chip key={pl} on={p.platforms.includes(pl)} onClick={() => setP({ ...p, platforms: toggle(p.platforms, pl) })}>
            {pl}
          </Chip>
        ))}
      </Group>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted">Look back (days)</span>
          <input
            type="number"
            min={1}
            max={14}
            value={p.windowDays}
            onChange={(e) => setP({ ...p, windowDays: Number(e.target.value) })}
            className="mt-2 w-full rounded-xl border border-line bg-panel px-4 py-3 outline-none focus:border-gold/60"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted">Telegram chat ID</span>
          <input
            value={p.telegramChatId ?? ""}
            placeholder="Uses TELEGRAM_CHAT_ID if empty"
            onChange={(e) => setP({ ...p, telegramChatId: e.target.value })}
            className="mt-2 w-full rounded-xl border border-line bg-panel px-4 py-3 outline-none placeholder:text-muted/60 focus:border-gold/60"
          />
        </label>
      </div>

      <div className="flex items-center gap-4 border-t border-line pt-8">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-text px-6 py-2.5 text-sm font-medium text-ink transition hover:bg-gold-soft disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        {msg && <span className="text-sm text-gold-soft">{msg}</span>}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-xs uppercase tracking-widest text-muted">{title}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-4 py-2 text-sm transition ${
        on ? "bg-gold text-ink" : "border border-line text-muted hover:border-gold/40 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
