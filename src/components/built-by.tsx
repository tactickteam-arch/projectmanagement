import Image from "next/image";
import { cn } from "@/lib/utils";

/** "Built by tactick" — the Store Launch Tracker is a custom system made by Tactick for Sangeetha Mobiles. */
export function BuiltBy({ dark, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px]", dark ? "text-sidebar-foreground/60" : "text-muted-foreground", className)}>
      <span>Built by</span>
      <Image src={dark ? "/brand/tactick-on-dark.png" : "/brand/tactick.png"} alt="Tactick" width={81} height={14} className="h-3.5 w-auto" />
    </span>
  );
}
