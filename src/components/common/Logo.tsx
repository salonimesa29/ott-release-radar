import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <defs>
        <linearGradient id="radar-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b6cff" />
          <stop offset="1" stopColor="#4fd8eb" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="none" stroke="url(#radar-g)" strokeOpacity=".35" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="url(#radar-g)" strokeOpacity=".6" strokeWidth="1.5" />
      <path d="M16 16 L27 8" stroke="url(#radar-g)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.6" fill="#f4f2ee" />
      <circle cx="23.5" cy="10.8" r="1.8" fill="#4fd8eb" />
    </svg>
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <span className="leading-none">
          <span className="block font-display text-[1.35rem] tracking-tight">Release Radar</span>
          <span className="block text-[10px] uppercase tracking-[0.22em] text-muted-foreground">OTT · India</span>
        </span>
      )}
    </span>
  );
}
