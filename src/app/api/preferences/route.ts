import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getPreferences, updatePreferences } from "@/lib/db/users";
import { preferencesUpdateSchema } from "@/lib/validation/schemas";
import type { Preferences } from "@/types/domain";

export async function GET() {
  try {
    const { user, db } = await requireUser();
    return Response.json(await getPreferences(db, user.id));
  } catch (err) {
    return apiError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const { user, db } = await requireUser();
    const patch = preferencesUpdateSchema.parse(await readJson(req)) as Partial<Preferences>;
    // User-scoped client: RLS + column grants mean only safe columns of the caller's own row change.
    return Response.json(await updatePreferences(db, user.id, patch));
  } catch (err) {
    return apiError(err);
  }
}
