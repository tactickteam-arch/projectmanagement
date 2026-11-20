"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  /** Count shown next to the label (e.g. approvals waiting). */
  badge?: number;
}

export function NavLinks({ items, variant, onNavigate }: { items: NavItem[]; variant: "sidebar" | "top" | "bottom" | "sheet"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = (i: NavItem) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/"));

  if (variant === "bottom") {
    return (
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active(i) ? "text-primary" : "text-muted-foreground")}
              aria-current={active(i) ? "page" : undefined}
            >
              {i.icon}
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          onClick={onNavigate}
          aria-current={active(i) ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            variant === "sidebar" &&
              (active(i) ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white"),
            variant === "top" && (active(i) ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"),
            variant === "sheet" && (active(i) ? "bg-accent text-foreground" : "text-foreground hover:bg-accent"),
          )}
        >
          {i.icon}
          {i.label}
          {!!i.badge && (
            <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground" aria-label={`${i.badge} waiting`}>
              {i.badge > 99 ? "99+" : i.badge}
            </span>
          )}
        </Link>
      ))}
    </>
  );
}
