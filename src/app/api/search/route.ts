import { PROVIDERS } from "@/config/providers";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { searchTitles } from "@/lib/db/catalogue";
import { searchQuerySchema } from "@/lib/validation/schemas";

/** Title search over the stored catalogue. No API keys reach the browser. */
export async function GET(req: Request) {
  try {
    const { db } = await requireUser();
    const { q } = searchQuerySchema.parse({ q: new URL(req.url).searchParams.get("q") ?? "" });
    const results = await searchTitles(db, q);
    return Response.json({
      results: results.map(({ title, releases }) => ({
        id: title.id,
        title: title.title,
        mediaType: title.mediaType,
        posterPath: title.posterPath,
        language: title.originalLanguage,
        platforms: [...new Set(releases.map((r) => PROVIDERS[r.providerKey].shortLabel))],
        latestDate: releases.map((r) => r.streamingReleaseDate).filter(Boolean).sort().at(-1) ?? null,
      })),
    });
  } catch (err) {
    return apiError(err);
  }
}
