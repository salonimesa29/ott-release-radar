import "server-only";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";
import { ConfigError } from "@/lib/env";

/** Consistent JSON errors: friendly message for users, details only in server logs. */
export function apiError(err: unknown): Response {
  if (err instanceof AuthError) return Response.json({ error: err.message }, { status: 401 });
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return Response.json({ error: `Invalid ${issue?.path.join(".") || "request"}: ${issue?.message}` }, { status: 400 });
  }
  if (err instanceof ConfigError) {
    console.error(err.message);
    return Response.json({ error: `The server is missing ${err.group} configuration.`, config: err.group }, { status: 503 });
  }
  console.error(err);
  return Response.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
