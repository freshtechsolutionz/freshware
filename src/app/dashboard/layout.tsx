import { PageShell } from "@/components/PortalChrome";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      headerRight={
        <>
          <Link
            href="/"
            className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
          >
            Portal entry
          </Link>
          <Link
            href="/admin"
            className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
          >
            Admin
          </Link>
        </>
      }
    >
      <div className="pt-6">{children}</div>
    </PageShell>
  );
}
