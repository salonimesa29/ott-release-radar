"use client";
import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <p className="font-display text-4xl">Something went wrong</p>
      <p className="mt-3 text-muted-foreground">We couldn’t load this page. The details are in the server logs.</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
