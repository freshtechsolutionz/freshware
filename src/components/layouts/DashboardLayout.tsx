"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";

type DashboardLayoutProps = {
  title?: string;
  backHref?: string;
  children: ReactNode;
};

export default function DashboardLayout({
  title,
  backHref,
  children,
}: DashboardLayoutProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center gap-4">
          {backHref && (
            <button
              onClick={() => router.push(backHref)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
          )}

          {title && (
            <h1 className="text-xl font-semibold text-gray-900">
              {title}
            </h1>
          )}
        </div>
      </div>

      {/* Page Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
