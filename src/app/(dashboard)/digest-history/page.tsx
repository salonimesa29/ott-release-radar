import type { Metadata } from "next";
import { DigestHistoryView } from "@/components/digest/DigestHistoryView";
import { requirePageUser } from "@/lib/auth/session";
import { listDigestHistory, lastSuccessfulDelivery } from "@/lib/db/users";

export const metadata: Metadata = { title: "Digest History" };

export default async function DigestHistoryPage() {
  const { user, db } = await requirePageUser();
  const [history, last] = await Promise.all([listDigestHistory(db, user.id), lastSuccessfulDelivery(db, user.id)]);
  return <DigestHistoryView history={history} lastDelivery={last} />;
}
