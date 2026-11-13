import { ACTION_LABELS } from "@/lib/activity";
import { formatDateTime } from "@/lib/format";
import { OVERALL_STATUS_LABELS, MODULE_STATUS_LABELS } from "@/lib/status";

interface Entry {
  id: string;
  action: string;
  userName: string;
  createdAt: string;
  storeModuleId: string | null;
  oldValue: unknown;
  newValue: unknown;
}

const FIELD_LABELS: Record<string, string> = {
  status: "status",
  blockerReason: "blocker reason",
  plannedStart: "planned start",
  plannedEnd: "planned end",
  actualStart: "actual start",
  actualEnd: "actual end",
  vendorName: "vendor",
  vendorPhone: "vendor phone",
  estCost: "estimated cost",
  actualCost: "actual cost",
  remarks: "remarks",
  details: "module details",
  targetLaunchDate: "target launch",
  actualLaunchDate: "actual launch",
  keyHandoverDate: "key handover date",
  overallStatus: "overall status",
};

function fmt(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (key === "overallStatus") return OVERALL_STATUS_LABELS[v as keyof typeof OVERALL_STATUS_LABELS] ?? "Not yet finalised";
  if (key === "status") return MODULE_STATUS_LABELS[v as keyof typeof MODULE_STATUS_LABELS] ?? String(v);
  if (typeof v === "object") return "updated";
  return String(v).slice(0, 80);
}

function describe(e: Entry, moduleNames: Record<string, string>): string {
  const base = ACTION_LABELS[e.action] ?? e.action;
  const mod = e.storeModuleId ? moduleNames[e.storeModuleId] : null;
  const nv = (e.newValue ?? {}) as Record<string, unknown>;
  const ov = (e.oldValue ?? {}) as Record<string, unknown>;
  if (e.action === "module.updated" || e.action === "store.updated") {
    const parts = Object.keys(nv).map((k) =>
      k === "details" ? "module details" : `${FIELD_LABELS[k] ?? k}: ${fmt(k, ov[k])} → ${fmt(k, nv[k])}`,
    );
    return `${base}${mod ? ` · ${mod}` : ""} — ${parts.join("; ")}`;
  }
  if (e.action === "store.status_auto" || e.action === "store.status_override") {
    return `${base}: ${fmt("overallStatus", ov.overallStatus)} → ${fmt("overallStatus", nv.overallStatus)}`;
  }
  if (e.action === "module.rejected" || e.action === "module.approved") {
    return `${base}${mod ? ` · ${mod}` : ""}${nv.comment ? ` — “${String(nv.comment)}”` : ""}`;
  }
  if (e.action === "attachment.added" || e.action === "attachment.removed") {
    const v = e.action === "attachment.added" ? nv : ov;
    return `${base}${mod ? ` · ${mod}` : ""} — ${String(v.fileName ?? "")}`;
  }
  if (e.action === "comment.added") return `${base}${mod ? ` on ${mod}` : ""} — “${String(nv.text ?? "")}”`;
  if (e.action === "key_handover.recorded") return `${base} — ${String(nv.keyHandoverDate ?? "")}, received by ${String(nv.receivedBy ?? "")}`;
  return `${base}${mod ? ` · ${mod}` : ""}`;
}

/** Spec: "Activity log on every store: who changed what, and when". */
export function ActivityList({ entries, moduleNames }: { entries: Entry[]; moduleNames: Record<string, string> }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-muted-foreground/60" aria-hidden />
          <p className="text-sm">
            <span className="font-medium">{e.userName}</span> <span className="text-muted-foreground">{describe(e, moduleNames)}</span>
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}
