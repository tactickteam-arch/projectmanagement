import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** Spec "Activity log on every store: who changed what, and when". */
export async function logActivity(
  tx: Tx,
  entry: {
    userId: string | null;
    storeId: string;
    storeModuleId?: string | null;
    action: string;
    oldValue?: Prisma.InputJsonValue | null;
    newValue?: Prisma.InputJsonValue | null;
  },
): Promise<void> {
  await tx.activityLog.create({
    data: {
      userId: entry.userId,
      storeId: entry.storeId,
      storeModuleId: entry.storeModuleId ?? null,
      action: entry.action,
      oldValue: entry.oldValue ?? undefined,
      newValue: entry.newValue ?? undefined,
    },
  });
}

/** Returns only the keys whose values changed, as {old, new} JSON-safe objects. */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { oldValue: Prisma.InputJsonObject; newValue: Prisma.InputJsonObject } | null {
  const oldValue: Record<string, Prisma.InputJsonValue | null> = {};
  const newValue: Record<string, Prisma.InputJsonValue | null> = {};
  for (const key of Object.keys(after)) {
    const a = normalise(before[key]);
    const b = normalise(after[key]);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      oldValue[key] = a;
      newValue[key] = b;
    }
  }
  return Object.keys(newValue).length ? { oldValue, newValue } : null;
}

function normalise(v: unknown): Prisma.InputJsonValue | null {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && v !== null && "toNumber" in v && typeof (v as { toNumber: unknown }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return v as Prisma.InputJsonValue;
}

export const ACTION_LABELS: Record<string, string> = {
  "store.created": "Created the store",
  "store.updated": "Updated store details",
  "store.status_override": "Changed overall status",
  "store.status_auto": "Overall status updated",
  "store.owner_changed": "Changed store owner",
  "key_handover.recorded": "Recorded key handover",
  "key_handover.accepted": "Handover accepted — setup clock started, departments notified",
  "module.updated": "Updated step",
  "module.done": "Marked step done (green)",
  "module.approved": "Approved step",
  "module.rejected": "Sent step back",
  "module.after_approval": "Recorded after approval",
  "attachment.added": "Uploaded a file",
  "attachment.removed": "Removed a file",
  "comment.added": "Commented",
};
