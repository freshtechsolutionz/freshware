"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/opportunities", label: "Opportunities" },
  { href: "/dashboard/tasks", label: "Tasks" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-screen-sm items-center justify-around px-3 py-2">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                "rounded-full px-4 py-2 text-sm font-medium",
                active ? "bg-black text-white" : "text-gray-700",
              ].join(" ")}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}