import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/db/users";
import { getCatalogue } from "@/services/catalogue.service";

/** Current release window for the signed-in user (stored data + cached AI only). */
export async function GET() {
  try {
    const { user, db } = await requireUser();
    const prefs = await getPreferences(db, user.id);
    return Response.json({ ...(await getCatalogue(db, user.id, prefs)), preferences: prefs });
  } catch (err) {
    return apiError(err);
  }
}
