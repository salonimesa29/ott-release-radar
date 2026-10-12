import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

export class AuthError extends Error {
  status = 401;
  constructor(message = "Please sign in again.") {
    super(message);
    this.name = "AuthError";
  }
}

/** Verifies the JWT (signature checked by Supabase) and returns the user, or null. */
export async function getSessionUser(): Promise<{ user: SessionUser; db: SupabaseClient } | null> {
  const db = await createUserClient();
  const { data, error } = await db.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  return { user: { id: sub, email: (data.claims.email as string | undefined) ?? null }, db };
}

/** For API routes: throws AuthError when signed out. */
export async function requireUser() {
  const session = await getSessionUser();
  if (!session) throw new AuthError();
  return session;
}

/** For pages: redirects to /login when signed out. */
export async function requirePageUser() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  return session;
}
