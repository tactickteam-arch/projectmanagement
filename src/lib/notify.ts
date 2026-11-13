import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** In-app notifications (spec: in-app first; e-mail/WhatsApp later). */
export async function notifyUsers(
  tx: Tx,
  userIds: string[],
  n: { type: string; message: string; storeId?: string; storeModuleId?: string },
): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await tx.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      type: n.type,
      message: n.message,
      storeId: n.storeId ?? null,
      storeModuleId: n.storeModuleId ?? null,
    })),
  });
}

/** "HQ / Regional Manager" recipients for a store: active SuperAdmins + RMs covering its state. */
export async function hqRecipients(tx: Tx, storeState: string, opts: { includeRegional?: boolean } = {}): Promise<string[]> {
  const users = await tx.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: "SUPER_ADMIN" },
        ...(opts.includeRegional === false ? [] : [{ role: "REGIONAL_MANAGER" as const, regionStates: { has: storeState } }]),
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
