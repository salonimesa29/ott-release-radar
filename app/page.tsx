import { Suspense } from "react";
import { connection } from "next/server";
import { DigestBoard } from "@/components/DigestBoard";
import { integrationStatus } from "@/lib/status";
import { listDigests } from "@/lib/store";

export default function Home() {
  return (
    <Suspense fallback={<p className="py-32 text-center text-muted">Loading…</p>}>
      <Latest />
    </Suspense>
  );
}

async function Latest() {
  await connection();
  const [latest] = await listDigests(1);
  return <DigestBoard digest={latest ?? null} status={integrationStatus()} />;
}
