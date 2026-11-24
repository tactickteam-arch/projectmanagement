import { Bell, ClipboardCheck, Clock, IndianRupee, LayoutDashboard, ListTodo, Map, Plus, Settings, Store, TrafficCone } from "lucide-react";
import { can } from "@/lib/auth/permissions";
import { departmentsOf, teamsLabel } from "@/lib/teams";
import Link from "next/link";
import type { ReactNode } from "react";
import { ROLE_LABELS } from "@/lib/auth/access";
import type { CurrentUser } from "@/lib/auth/dal";
import { NavLinks, type NavItem } from "./nav-links";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { BuiltBy } from "./built-by";

function navFor(user: CurrentUser, approvals: { canApprove: boolean; count: number }): NavItem[] {
  if (user.role === "STORE_OWNER") {
    return [
      { href: "/owner", label: "My stores", icon: <Store className="size-4" /> },
      { href: "/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
    ];
  }
  const items: NavItem[] = [
    ...(departmentsOf(user.teams).length ? [{ href: "/tasks", label: "My tasks", icon: <ListTodo className="size-4" /> }] : []),
    { href: "/hq", label: "Dashboard", icon: <LayoutDashboard className="size-4" />, exact: true },
    ...(approvals.canApprove ? [{ href: "/hq/approvals", label: "Approvals", icon: <ClipboardCheck className="size-4" />, badge: approvals.count }] : []),
    { href: "/hq/reports/rag", label: "Weekly RAG", icon: <TrafficCone className="size-4" /> },
    { href: "/hq/reports/delays", label: "Delays report", icon: <Clock className="size-4" /> },
    { href: "/hq/reports/costs", label: "Cost report", icon: <IndianRupee className="size-4" /> },
    { href: "/hq/map", label: "Map view", icon: <Map className="size-4" /> },
  ];
  if (can.createStore(user)) items.push({ href: "/stores/new", label: "Add store", icon: <Plus className="size-4" /> });
  if (user.role === "SUPER_ADMIN") {
    items.push({ href: "/hq/settings", label: "Settings", icon: <Settings className="size-4" /> });
  }
  items.push({ href: "/notifications", label: "Notifications", icon: <Bell className="size-4" /> });
  return items;
}

function Brand({ dark }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground" aria-hidden>
        S
      </span>
      <span className="leading-tight">
        <span className={dark ? "block text-sm font-semibold text-white" : "block text-sm font-semibold"}>Sangeetha Mobiles</span>
        <span className={dark ? "block text-[11px] text-sidebar-foreground/70" : "block text-[11px] text-muted-foreground"}>Store Launch Tracker</span>
      </span>
    </Link>
  );
}

function Bellink({ unread }: { unread: number }) {
  return (
    <Link href="/notifications" className="relative grid size-9 place-items-center rounded-md hover:bg-accent" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

/** HQ: dark sidebar (desktop-first). Store owner: compact top bar + bottom tabs (mobile-first). */
export function AppShell({ user, unread, approvals, children }: { user: CurrentUser; unread: number; approvals: { canApprove: boolean; count: number }; children: ReactNode }) {
  const nav = navFor(user, approvals);
  const roleLabel =
    (user.role === "TEAM_MEMBER" && departmentsOf(user.teams).length
      ? teamsLabel(user.teams)
      : ROLE_LABELS[user.role] + (departmentsOf(user.teams).length ? ` · ${teamsLabel(user.teams)}` : "")) +
    ((user.role === "REGIONAL_MANAGER" || user.role === "TEAM_MEMBER") && user.regionStates.length ? ` · ${user.regionStates.join(", ")}` : "");

  if (user.role === "STORE_OWNER") {
    return (
      <div className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
            <Brand />
            <nav className="hidden items-center gap-1 md:flex">
              <NavLinks items={nav.filter((n) => n.href !== "/notifications")} variant="top" />
            </nav>
            <div className="flex items-center gap-1">
              <Bellink unread={unread} />
              <UserMenu name={user.name} roleLabel={roleLabel} />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-24 md:pb-10">
          {children}
          <div className="mt-10 flex justify-center">
            <BuiltBy />
          </div>
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
          <NavLinks items={nav} variant="bottom" />
        </nav>
      </div>
    );
  }

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-4 py-5">
          <Brand dark />
        </div>
        <nav className="flex-1 space-y-0.5 px-2" aria-label="Main">
          <NavLinks items={nav} variant="sidebar" />
        </nav>
        <div className="border-t border-sidebar-border px-4 py-3 text-xs text-sidebar-foreground/70">
          <p className="truncate font-medium text-sidebar-foreground">{user.name}</p>
          <p className="truncate">{roleLabel}</p>
          <BuiltBy dark className="mt-3" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <MobileNav items={nav} />
            <Brand />
          </div>
          <p className="hidden text-sm text-muted-foreground lg:block">{roleLabel}</p>
          <div className="flex items-center gap-1">
            <Bellink unread={unread} />
            <UserMenu name={user.name} roleLabel={roleLabel} />
          </div>
        </header>
        <main className="w-full flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
