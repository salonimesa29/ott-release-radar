"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DISCOVERY_MODES, GENRE_KEYS, GENRES, LANGUAGES, MOODS, type GenreKey, type MoodKey } from "@/config/taxonomy";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import type { MediaType, Preferences } from "@/types/domain";
import { PlatformToggles } from "@/components/filters/controls";

const DEFAULTS: Pick<Preferences, "genres" | "languages" | "platforms" | "contentTypes" | "runtime" | "dubbed" | "popularity" | "genreExploration" | "discoveryMode" | "mood" | "useFeedback"> = {
  genres: ["thriller", "science_fiction", "indie_drama"],
  languages: ["hi", "en", "ta"],
  platforms: ["netflix", "prime_video", "hotstar"],
  contentTypes: ["movie", "tv"],
  runtime: "any",
  dubbed: "no_preference",
  popularity: "balanced",
  genreExploration: "familiar",
  discoveryMode: "balanced",
  mood: null,
  useFeedback: true,
};

const editable = (p: Preferences) => ({
  genres: p.genres,
  languages: p.languages,
  platforms: p.platforms,
  contentTypes: p.contentTypes,
  runtime: p.runtime,
  dubbed: p.dubbed,
  popularity: p.popularity,
  genreExploration: p.genreExploration,
  discoveryMode: p.discoveryMode,
  mood: p.mood,
  useFeedback: p.useFeedback,
});

export function PreferencesForm({ initial }: { initial: Preferences }) {
  const router = useRouter();
  const [saved, setSaved] = useState(editable(initial));
  const [p, setP] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const set = (patch: Partial<typeof p>) => setP((x) => ({ ...x, ...patch }));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await api<Preferences>("/api/preferences", { method: "PUT", body: p });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setSaved(editable(res.data));
    setP(editable(res.data));
    toast.success("Preferences saved");
    router.refresh();
  }

  return (
    <div className="space-y-10 pt-8">
      <Section title="Genres" hint="Titles must match at least one (in “Stick to my taste” mode).">
        <Chips options={GENRE_KEYS.map((k) => ({ key: k, label: GENRES[k].label }))} value={p.genres} onToggle={(k) => set({ genres: toggle(p.genres, k as GenreKey) })} />
      </Section>
      <Section title="Languages" hint="Original language of the title. Required.">
        <Chips options={LANGUAGES.map((l) => ({ key: l.code, label: l.label }))} value={p.languages} onToggle={(k) => set({ languages: toggle(p.languages, k) })} />
      </Section>
      <Section title="Platforms you subscribe to" hint="Required.">
        <PlatformToggles value={p.platforms} onChange={(platforms) => set({ platforms })} />
      </Section>

      <Section title="Personalisation strength">
        <ToggleGroup type="single" variant="outline" value={p.discoveryMode} onValueChange={(v) => v && set({ discoveryMode: v as Preferences["discoveryMode"] })} className="flex-wrap">
          {DISCOVERY_MODES.map((d) => <ToggleGroupItem key={d.key} value={d.key} className="px-4">{d.label}</ToggleGroupItem>)}
        </ToggleGroup>
        <p className="mt-2 text-xs text-muted-foreground">
          {p.discoveryMode === "stick" && "Only strong genre and language matches make your digest."}
          {p.discoveryMode === "balanced" && "Genre matches plus anything Gemini rates 70+ for you."}
          {p.discoveryMode === "surprise" && "More variety in genre and mood — your platforms and languages still apply."}
        </p>
      </Section>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <p className="text-sm font-medium">Optional</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <Segment label="Movies or series" value={p.contentTypes.length === 2 ? "both" : p.contentTypes[0]} options={[["both", "Both"], ["movie", "Movies"], ["tv", "Series"]]} onChange={(v) => set({ contentTypes: v === "both" ? ["movie", "tv"] : [v as MediaType] })} />
          <Segment label="Preferred runtime" value={p.runtime} options={[["any", "Any"], ["under_60", "< 1h"], ["under_120", "< 2h"], ["over_120", "2h+"]]} onChange={(v) => set({ runtime: v as Preferences["runtime"] })} />
          <Segment label="Original vs dubbed" value={p.dubbed} options={[["no_preference", "No preference"], ["original_only", "Original only"], ["dubbed_ok", "Dubbed is fine"]]} onChange={(v) => set({ dubbed: v as Preferences["dubbed"] })} />
          <Segment label="Popular vs hidden gems" value={p.popularity} options={[["popular", "Popular"], ["balanced", "Balanced"], ["hidden_gems", "Hidden gems"]]} onChange={(v) => set({ popularity: v as Preferences["popularity"] })} />
          <Segment label="Familiar vs new genres" value={p.genreExploration} options={[["familiar", "Familiar"], ["open", "Open to new"]]} onChange={(v) => set({ genreExploration: v as Preferences["genreExploration"] })} />
          <Segment label="Default mood" value={p.mood ?? "none"} options={[["none", "None"], ...MOODS.map((m) => [m.key, m.label] as [string, string])]} onChange={(v) => set({ mood: v === "none" ? null : (v as MoodKey) })} />
        </div>
        <label className="mt-6 flex items-center gap-3 text-sm">
          <Switch checked={p.useFeedback} onCheckedChange={(useFeedback) => set({ useFeedback })} />
          Use my “Not interested” feedback to personalise rankings
        </label>
      </div>

      {error && <p className="text-sm text-skip">{error}</p>}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/90 p-3 backdrop-blur">
        <Button onClick={save} disabled={!dirty || saving} size="lg" className="h-10 px-5">
          {saving && <Loader2 className="animate-spin" />} Save Preferences
        </Button>
        <Button variant="ghost" onClick={() => setP(saved)} disabled={!dirty || saving}>Cancel Changes</Button>
        <Button variant="ghost" onClick={() => set(DEFAULTS)} disabled={saving} className="ml-auto text-muted-foreground">Reset to Defaults</Button>
        {dirty && <span className="w-full text-xs text-maybe sm:w-auto">Unsaved changes</span>}
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl">{title}</h2>
      {hint && <p className="mb-3 text-xs text-muted-foreground">{hint}</p>}
      <div className={cn(!hint && "mt-3")}>{children}</div>
    </section>
  );
}

function Chips({ options, value, onToggle }: { options: { key: string; label: string }[]; value: string[]; onToggle: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.key);
        return (
          <button key={o.key} type="button" aria-pressed={on} onClick={() => onToggle(o.key)} className={cn("h-9 rounded-full border px-4 text-sm transition focus-visible:outline-2 focus-visible:outline-ring", on ? "border-violet/60 bg-violet/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Segment({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <ToggleGroup type="single" size="sm" variant="outline" value={value} onValueChange={(v) => v && onChange(v)} className="flex-wrap justify-start">
        {options.map(([k, l]) => <ToggleGroupItem key={k} value={k} className="px-2.5 text-xs">{l}</ToggleGroupItem>)}
      </ToggleGroup>
    </div>
  );
}
