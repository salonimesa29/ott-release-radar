"use client";
import { useState } from "react";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "https://image.tmdb.org/t/p";

/** TMDB image with a graceful fallback when the path is missing or the image fails to load. */
export function Poster({
  path,
  alt,
  size = "w500",
  sizes,
  className,
  priority,
  fallbackLabel,
}: {
  path: string | null;
  alt: string;
  size?: "w342" | "w500" | "w780" | "w1280" | "original";
  sizes: string;
  className?: string;
  priority?: boolean;
  fallbackLabel?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!path || failed) {
    return (
      <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_20%,#1d1830,#0c0c11_70%)] text-muted-foreground", className)}>
        <Clapperboard className="size-6 opacity-50" aria-hidden />
        {fallbackLabel && <span className="px-4 text-center font-display text-lg text-foreground/50">{fallbackLabel}</span>}
      </div>
    );
  }
  return (
    <Image
      src={`${BASE}/${size}${path}`}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
