import { Suspense } from "react";
import PortalClient from "./PortalClient";

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="text-sm text-muted-foreground">Loading…</div>
        </main>
      }
    >
      <PortalClient />
    </Suspense>
  );
}
