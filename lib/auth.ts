import "server-only";

/** If ADMIN_KEY is set, mutating requests from the UI must send it as x-admin-key. */
export function isAdmin(req: Request) {
  const key = process.env.ADMIN_KEY;
  return !key || req.headers.get("x-admin-key") === key;
}

export function isCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}
