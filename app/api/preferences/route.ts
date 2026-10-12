import { isAdmin } from "@/lib/auth";
import { GENRES, LANGUAGES, PLATFORMS } from "@/lib/constants";
import { savePreferences } from "@/lib/store";
import type { Preferences } from "@/lib/types";

export async function PUT(req: Request) {
  if (!isAdmin(req)) return Response.json({ error: "Wrong admin key" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Partial<Preferences> | null;
  const prefs: Preferences = {
    genres: (b?.genres ?? []).filter((g) => g in GENRES),
    languages: (b?.languages ?? []).filter((l) => LANGUAGES.some((x) => x.code === l)),
    platforms: (b?.platforms ?? []).filter((p) => PLATFORMS.includes(p)),
    windowDays: Math.min(14, Math.max(1, Math.round(Number(b?.windowDays) || 7))),
    telegramChatId: b?.telegramChatId?.toString().trim() || null,
  };
  if (!prefs.genres.length || !prefs.languages.length || !prefs.platforms.length) {
    return Response.json({ error: "Pick at least one genre, language and platform" }, { status: 400 });
  }
  await savePreferences(prefs);
  return Response.json(prefs);
}
