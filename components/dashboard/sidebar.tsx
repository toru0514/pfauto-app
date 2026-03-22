"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Briefcase, ExternalLink } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "商品一覧", icon: Package },
  { href: "/dashboard/jobs", label: "ジョブ一覧", icon: Briefcase },
];

export function Sidebar({ spreadsheetUrl }: { spreadsheetUrl: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-full w-52 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="border-b border-border px-4 py-4">
        <Link href="/dashboard" className="text-sm font-bold text-foreground">
          Sync Hub
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {spreadsheetUrl && (
        <div className="border-t border-border px-2 py-3">
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            スプレッドシート
          </a>
        </div>
      )}
    </aside>
  );
}
