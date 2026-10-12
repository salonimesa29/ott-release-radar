import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ createUserClient: vi.fn(), createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => supabase);
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { apiError } from "@/lib/api";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { AuthError, requirePageUser, requireUser } from "@/lib/auth/session";
import { ConfigError } from "@/lib/env";
import { preferencesUpdateSchema } from "@/lib/validation/schemas";

const SECRET = "fixture-cron-secret-0123456789abcdef";

describe("cron authorization", () => {
  it("accepts the correct bearer secret", () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("rejects a wrong secret of the same or different length", () => {
    const sameLength = SECRET.slice(0, -1) + (SECRET.endsWith("f") ? "e" : "f");
    expect(isAuthorizedCron(`Bearer ${sameLength}`, SECRET)).toBe(false);
    expect(isAuthorizedCron(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorizedCron(SECRET, SECRET)).toBe(false); // missing "Bearer "
    expect(isAuthorizedCron(`bearer ${SECRET}`, SECRET)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isAuthorizedCron(null, SECRET)).toBe(false);
    expect(isAuthorizedCron("", SECRET)).toBe(false);
  });

  it("rejects everything when the server secret is missing or too short", () => {
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer short", "short")).toBe(false);
  });
});

describe("authentication and access control", () => {
  beforeEach(() => {
    supabase.createUserClient.mockReset();
  });

  const parse = async (res: Response) => ({ status: res.status, body: (await res.json()) as Record<string, unknown> });

  it("AuthError maps to 401", async () => {
    const { status, body } = await parse(apiError(new AuthError()));
    expect(status).toBe(401);
    expect(body.error).toBe("Please sign in again.");
  });

  it("ZodError maps to 400 with the offending field", async () => {
    const result = preferencesUpdateSchema.safeParse({ languages: [] });
    expect(result.success).toBe(false);
    const { status, body } = await parse(apiError(result.error));
    expect(status).toBe(400);
    expect(body.error).toMatch(/^Invalid languages: /);
  });

  it("ConfigError maps to 503 without leaking which variables are missing", async () => {
    const err = new ConfigError("supabase", ["SUPABASE_SERVICE_ROLE_KEY (Invalid input)"]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await parse(apiError(err));
    expect(status).toBe(503);
    expect(body).toEqual({ error: "The server is missing supabase configuration.", config: "supabase" });
    expect(JSON.stringify(body)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(spy).toHaveBeenCalledWith(err.message); // details go to server logs only
  });

  it("unknown errors map to a generic 500 and are logged server-side", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("relation user_preferences password=hunter2 does not exist");
    const { status, body } = await parse(apiError(err));
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Something went wrong on our side. Please try again." });
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(spy).toHaveBeenCalledWith(err);
  });

  it("non-Error throwables are also handled generically", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await parse(apiError("string thrown"))).status).toBe(500);
  });

  it("requireUser throws AuthError when there is no verified session", async () => {
    supabase.createUserClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: null, error: null }) } });
    await expect(requireUser()).rejects.toBeInstanceOf(AuthError);
  });

  it("requireUser throws AuthError when JWT verification fails", async () => {
    supabase.createUserClient.mockResolvedValue({
      auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } }, error: new Error("invalid JWT") }) },
    });
    await expect(requireUser()).rejects.toBeInstanceOf(AuthError);
  });

  it("requireUser returns the verified user id from the token's subject", async () => {
    const db = { auth: { getClaims: async () => ({ data: { claims: { sub: "user-1", email: "fixture@example.test" } }, error: null }) } };
    supabase.createUserClient.mockResolvedValue(db);
    const session = await requireUser();
    expect(session.user).toEqual({ id: "user-1", email: "fixture@example.test" });
    expect(session.db).toBe(db);
  });

  it("requirePageUser redirects signed-out visitors to /login", async () => {
    supabase.createUserClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: null, error: null }) } });
    await expect(requirePageUser()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});

