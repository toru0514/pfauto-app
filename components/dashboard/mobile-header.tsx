"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, Package, Briefcase, ImagePlus, TreePine, ExternalLink } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "商品一覧", icon: Package },
  { href: "/dashboard/jobs", label: "ジョブ一覧", icon: Briefcase },
  { href: "/dashboard/images/upload", label: "画像追加", icon: ImagePlus },
  { href: "/dashboard/woods", label: "木材一覧", icon: TreePine },
];

export function MobileHeader({ spreadsheetUrl }: { spreadsheetUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Fixed top bar */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <Link href="/dashboard" className="text-sm font-bold text-foreground">
          Sync Hub
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="メニューを開く"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          {/* Sidebar panel */}
          <aside className="absolute left-0 top-0 flex h-full w-52 flex-col border-r border-border bg-card">
            {/* Header with close button */}
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <Link href="/dashboard" className="text-sm font-bold text-foreground">
                Sync Hub
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="メニューを閉じる"
              >
                <X className="h-4 w-4" />
              </button>
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
        </div>
      )}
    </>
  );
}
