"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser client — anon key only, used for auth flows. Data access goes through API routes. */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
