import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { listDigestHistory } from "@/lib/db/users";

export async function GET() {
  try {
    const { user, db } = await requireUser();
    return Response.json({ history: await listDigestHistory(db, user.id) });
  } catch (err) {
    return apiError(err);
  }
}
