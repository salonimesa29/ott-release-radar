import { connection } from "next/server";
import { isCron } from "@/lib/auth";
import { deliverDigest, generateDigest } from "@/lib/digest";

export const maxDuration = 60;

/** Vercel Cron: every Friday 18:00 IST (12:30 UTC). */
export async function GET(req: Request) {
  await connection();
  if (!isCron(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const digest = await deliverDigest((await generateDigest()).id);
  return Response.json({ id: digest.id, items: digest.items.length, sent: digest.sent, error: digest.telegramError });
}
