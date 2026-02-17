"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sales-pipeline", label: "Sales Pipeline" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/contacts", label: "Contacts" },
  { href: "/meetings", label: "Meetings" },
  { href: "/discovery-sessions", label: "Discovery Sessions" },
  { href: "/proposals", label: "Proposals" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "Tasks" },
  { href: "/activities", label: "Activities" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 py-8">
      <div className="rounded-xl border bg-white p-3">
        <div className="px-3 pb-2 pt-1 text-xs font-semibold tracking-wide text-muted-foreground">
          Navigation
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-muted" : "hover:bg-muted/60",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
