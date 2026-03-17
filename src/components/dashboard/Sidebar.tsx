"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href?: string;
  label: string;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/meetings", label: "Meetings" },
  { href: "/dashboard/opportunities", label: "Opportunities" },
  { href: "/dashboard/contacts", label: "Contacts" },
  { href: "/dashboard/projects", label: "Projects" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/reports/projects-health", label: "Project Health" },
  { href: "/dashboard/companies", label: "Company Profiles" },
  { href: "/dashboard/lead-generator", label: "Lead Generator", soon: true },
  { href: "/dashboard/revenue", label: "Revenue" },
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
            const active = item.href ? pathname === item.href : false;

            if (item.soon) {
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground opacity-80"
                >
                  <span>{item.label}</span>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                    Soon
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
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