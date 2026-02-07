import { PageShell } from "@/components/PortalChrome";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      headerRight={
        <>
          <Link
            href="/dashboard"
            className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
          >
            Dashboard
          </Link>
          <Link
            href="/"
            className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
          >
            Portal entry
          </Link>
        </>
      }
    >
      <div className="pt-6">{children}</div>
    </PageShell>
  );
}
