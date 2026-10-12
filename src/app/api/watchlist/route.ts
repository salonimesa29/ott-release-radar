import type { WatchStatus } from "@/config/taxonomy";
import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { addFeedback, clearFeedback, getPreferences, removeWatchlist, upsertWatchlist } from "@/lib/db/users";
import { watchlistDeleteSchema, watchlistUpsertSchema } from "@/lib/validation/schemas";
import { getWatchlistItems } from "@/services/catalogue.service";

export async function GET() {
  try {
    const { user, db } = await requireUser();
    const prefs = await getPreferences(db, user.id);
    return Response.json({ items: await getWatchlistItems(db, user.id, prefs) });
  } catch (err) {
    return apiError(err);
  }
}

/** Add or change status. "Not interested" is also recorded as explicit feedback. */
export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser();
    const { titleId, status } = watchlistUpsertSchema.parse(await readJson(req));
    await upsertWatchlist(db, user.id, titleId, status as WatchStatus);
    if (status === "not_interested") await addFeedback(db, user.id, titleId, "not_interested");
    else await clearFeedback(db, user.id, titleId, "not_interested");
    return Response.json({ titleId, status });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, db } = await requireUser();
    const { titleId } = watchlistDeleteSchema.parse(await readJson(req));
    await removeWatchlist(db, user.id, titleId);
    await clearFeedback(db, user.id, titleId, "not_interested");
    return Response.json({ titleId, removed: true });
  } catch (err) {
    return apiError(err);
  }
}
