import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { updateProfile } from "@/lib/db/users";
import { profileUpdateSchema } from "@/lib/validation/schemas";

export async function PATCH(req: Request) {
  try {
    const { user, db } = await requireUser();
    const { displayName } = profileUpdateSchema.parse(await readJson(req));
    await updateProfile(db, user.id, displayName);
    return Response.json({ displayName });
  } catch (err) {
    return apiError(err);
  }
}
