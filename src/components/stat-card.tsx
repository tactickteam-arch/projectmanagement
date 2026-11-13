import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "danger" | "warning" | "success";
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-lg border bg-card p-4 shadow-xs transition-colors",
        href && "hover:border-foreground/20",
        tone === "danger" && "border-l-4 border-l-status-blocked",
        tone === "warning" && "border-l-4 border-l-status-progress",
        tone === "success" && "border-l-4 border-l-status-completed",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        {icon && <span aria-hidden>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
