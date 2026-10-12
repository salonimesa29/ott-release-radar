"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Loader2, Tv } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { api } from "@/lib/client-api";
import { languageLabel } from "@/config/taxonomy";
import { formatDay } from "@/lib/dates/ist";

type Result = { id: string; title: string; mediaType: "movie" | "tv"; language: string; platforms: string[]; latestDate: string | null };

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Debounced search against our own API.
  const onQuery = (value: string) => {
    setQ(value);
    setState(value.trim().length >= 2 ? "loading" : "idle");
    if (value.trim().length < 2) setResults([]);
  };

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      const res = await api<{ results: Result[] }>(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        setResults(res.data.results);
        setState("idle");
      } else setState("error");
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search titles" description="Search the release catalogue">
      <CommandInput placeholder="Search titles in the catalogue…" value={q} onValueChange={onQuery} />
      <CommandList>
        {state === "loading" && (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Searching…
          </div>
        )}
        {state === "error" && <p className="p-4 text-sm text-skip">Search failed. Try again.</p>}
        {state === "idle" && q.trim().length >= 2 && <CommandEmpty>No titles found in the catalogue.</CommandEmpty>}
        {state === "idle" && q.trim().length < 2 && <p className="p-4 text-sm text-muted-foreground">Type at least two characters.</p>}
        {results.length > 0 && (
          <CommandGroup heading="Titles">
            {results.map((r) => (
              <CommandItem
                key={r.id}
                value={`${r.title}-${r.id}`}
                onSelect={() => {
                  onOpenChange(false);
                  router.push(`/title/${r.id}`);
                }}
              >
                {r.mediaType === "movie" ? <Film /> : <Tv />}
                <span className="flex-1 truncate">{r.title}</span>
                <span className="text-xs text-muted-foreground">
                  {[languageLabel(r.language), r.platforms.join(", "), r.latestDate ? formatDay(r.latestDate) : null].filter(Boolean).join(" · ")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
