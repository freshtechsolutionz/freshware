import { Suspense } from "react";
import HomeClient from "./HomeClient";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="text-sm text-muted-foreground">Loading…</div>
        </main>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
