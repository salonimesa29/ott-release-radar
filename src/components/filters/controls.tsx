"use client";
import { useState } from "react";
import { Check, ChevronDown, Gem, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PROVIDER_LIST, type ProviderKey } from "@/config/providers";
import { GENRE_KEYS, GENRES, LANGUAGES, MOODS, type GenreKey, type MoodKey } from "@/config/taxonomy";
import { WATCH_TIME_OPTIONS, type QuickFilter, type WatchTime } from "@/lib/ranking/filters";
import { cn } from "@/lib/utils";

/** Three selectable platform chips; every selection filters the real data. */
export function PlatformToggles({ value, onChange }: { value: ProviderKey[]; onChange: (v: ProviderKey[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Streaming platforms">
      {PROVIDER_LIST.map((p) => {
        const on = value.includes(p.key);
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== p.key) : [...value, p.key])}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              on ? "border-white/20 bg-white/[0.07] text-foreground" : "border-border text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            <span className={cn("size-2 rounded-full transition", !on && "opacity-40")} style={{ background: p.color, boxShadow: on ? `0 0 10px ${p.color}` : undefined }} />
            {p.shortLabel}
            {on && <Check className="size-3.5 text-cyan" />}
          </button>
        );
      })}
    </div>
  );
}

/** Searchable multi-select with removable chips, Select all / Clear all. */
export function MultiSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  footer,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  placeholder: string;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (k: T) => onChange(value.includes(k) ? value.filter((v) => v !== k) : [...value, k]);
  const summary = value.length === 0 ? `Any ${label.toLowerCase()}` : value.length <= 2 ? value.map((v) => options.find((o) => o.key === v)?.label).join(", ") : `${value.length} ${label.toLowerCase()}`;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} aria-label={label} className="h-9 w-full justify-between gap-2 font-normal sm:w-56">
            <span className="truncate">{summary}</span>
            <ChevronDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <div className="flex justify-between border-b border-border px-2 py-1.5">
              <Button variant="ghost" size="xs" onClick={() => onChange(options.map((o) => o.key))}>Select all</Button>
              <Button variant="ghost" size="xs" onClick={() => onChange([])}>Clear all</Button>
            </div>
            <CommandList>
              <CommandEmpty>No match.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o.key} value={o.label} onSelect={() => toggle(o.key)}>
                    <Check className={cn(value.includes(o.key) ? "opacity-100 text-cyan" : "opacity-0")} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {footer && <div className="border-t border-border p-2">{footer}</div>}
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-violet/15 py-0.5 pl-2.5 pr-1 text-xs text-violet">
              {options.find((o) => o.key === v)?.label ?? v}
              <button type="button" onClick={() => toggle(v)} aria-label={`Remove ${v}`} className="rounded-full p-0.5 hover:bg-violet/25">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const GENRE_OPTIONS = GENRE_KEYS.map((k) => ({ key: k as GenreKey, label: GENRES[k].label }));
export const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ key: l.code, label: l.label }));

export function QuickFilterControl({ value, onChange }: { value: QuickFilter; onChange: (v: QuickFilter) => void }) {
  return (
    <ToggleGroup type="single" value={value} onValueChange={(v) => v && onChange(v as QuickFilter)} variant="outline" className="flex-wrap" aria-label="Quick filter">
      <ToggleGroupItem value="all" className="px-3">All New Releases</ToggleGroupItem>
      <ToggleGroupItem value="best" className="px-3">Best Matches</ToggleGroupItem>
      <ToggleGroupItem value="movies" className="px-3">Movies</ToggleGroupItem>
      <ToggleGroupItem value="series" className="px-3">Series</ToggleGroupItem>
    </ToggleGroup>
  );
}

export function WatchTimeSelect({ value, onChange }: { value: WatchTime; onChange: (v: WatchTime) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">What is your viewing mood tonight?</Label>
      <Select value={value} onValueChange={(v) => onChange(v as WatchTime)}>
        <SelectTrigger className="h-9 w-full sm:w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          {WATCH_TIME_OPTIONS.map((o) => (
            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function MoodSelect({ value, onChange }: { value: MoodKey | null; onChange: (v: MoodKey | null) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Mood (ranking signal)</Label>
      <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : (v as MoodKey))}>
        <SelectTrigger className="h-9 w-full sm:w-52"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No particular mood</SelectItem>
          {MOODS.map((m) => (
            <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function HiddenGemToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm" title="Fewer than 250 TMDB votes and below this week's median popularity">
      <Switch checked={value} onCheckedChange={onChange} aria-label="Show me hidden gems" />
      <Gem className={cn("size-4", value ? "text-cyan" : "text-muted-foreground")} />
      Show me hidden gems
    </label>
  );
}
