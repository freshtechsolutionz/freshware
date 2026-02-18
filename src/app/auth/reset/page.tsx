import { Suspense } from "react";
import ResetClient from "./ResetClient";

export default function ResetPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="text-sm text-gray-600">Loading reset…</div>
        </main>
      }
    >
      <ResetClient />
    </Suspense>
  );
}
