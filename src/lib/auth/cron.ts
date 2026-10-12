import { timingSafeEqual } from "node:crypto";

/** Constant-time check of "Authorization: Bearer <CRON_SECRET>". False when no secret is configured. */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  if (actual.length !== expected.length) {
    timingSafeEqual(expected, expected); // keep timing similar
    return false;
  }
  return timingSafeEqual(actual, expected);
}
