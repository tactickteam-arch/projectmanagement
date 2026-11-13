"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  href: string | null;
}

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const unread = items.filter((i) => !i.isRead).length;

  async function markAll() {
    setBusy(true);
    await api("/api/notifications", { method: "PATCH", body: { all: true } }).catch(() => undefined);
    setBusy(false);
    router.refresh();
  }
  async function open(i: NotificationItem) {
    if (!i.isRead) await api("/api/notifications", { method: "PATCH", body: { ids: [i.id] } }).catch(() => undefined);
    if (i.href) router.push(i.href);
    router.refresh();
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed bg-card py-12 text-center">
        <Bell className="mb-2 size-8 text-muted-foreground" />
        <p className="font-medium">No notifications yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{unread} unread</p>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAll} disabled={busy}>
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        )}
      </div>
      <ul className="divide-y rounded-lg border bg-card">
        {items.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => open(i)} className={cn("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40", !i.isRead && "bg-primary/[0.04]")}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", i.isRead ? "bg-transparent" : "bg-primary")} aria-label={i.isRead ? undefined : "Unread"} />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", !i.isRead && "font-medium")}>{i.message}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(i.createdAt)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-center text-xs text-muted-foreground">
        In-app notifications only in this demo. E-mail and WhatsApp are planned for a later phase.{" "}
        <Link href="/" className="underline">
          Back home
        </Link>
      </p>
    </div>
  );
}
