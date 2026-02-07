"use client";

import Link from "next/link";

type PortalBrand = {
  productName: string;
  portalLabel: string;
  supportEmail: string;
};

const brand: PortalBrand = {
  productName: "Freshware",
  portalLabel: "Client & Team Portal",
  supportEmail: "support@freshware.io",
};

export function PortalHeader(props: { right?: React.ReactNode }) {
  return (
    <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-black text-white flex items-center justify-center font-semibold">
          F
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{brand.productName}</div>
          <div className="text-sm text-gray-600">{brand.portalLabel}</div>
        </div>
      </Link>

      <nav className="flex items-center gap-3">{props.right}</nav>
    </header>
  );
}

export function PortalFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-6 pb-10 pt-10 text-sm text-gray-600">
      <div className="rounded-3xl border bg-white p-6 shadow-sm flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">Powered by Freshware</div>
          <div className="mt-1 text-sm text-gray-600">Data-driven by design.</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={`mailto:${brand.supportEmail}`}
            className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Support
          </a>
          <Link
            href="/request-access"
            className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
          >
            Request access
          </Link>
        </div>
      </div>
      <div className="mt-6 text-xs text-gray-500">© {new Date().getFullYear()} Freshware. All rights reserved.</div>
    </footer>
  );
}

export function PageShell(props: { children: React.ReactNode; headerRight?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
      <PortalHeader right={props.headerRight} />
      <main className="mx-auto max-w-6xl px-6 pb-16">{props.children}</main>
      <PortalFooter />
    </div>
  );
}
