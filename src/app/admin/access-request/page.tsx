"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AccessRequestRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/access-requests");
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-gray-900">Redirecting...</div>
        <div className="mt-2 text-sm text-gray-600">
          Sending you to Access Requests.
        </div>
      </div>
    </div>
  );
}
