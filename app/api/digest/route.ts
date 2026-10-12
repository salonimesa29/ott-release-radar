import { isAdmin } from "@/lib/auth";
import { deliverDigest, generateDigest } from "@/lib/digest";

export const maxDuration = 60;

/** POST { action: "generate" } or { action: "send", id } */
export async function POST(req: Request) {
  if (!isAdmin(req)) return Response.json({ error: "Wrong admin key" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; id?: string };
  try {
    if (body.action === "send" && body.id) return Response.json(await deliverDigest(body.id));
    if (body.action === "generate") return Response.json(await generateDigest());
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
