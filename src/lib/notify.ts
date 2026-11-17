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

/**
 * Members of the given teams who can see the store (active SuperAdmins, Regional Managers and Team
 * members whose teams overlap, within their states). "STORE_OWNER" in the list adds the store's owner.
 */
export async function teamRecipients(tx: Tx, store: { state: string; ownerId: string }, teams: readonly string[]): Promise<string[]> {
  return (await teamRecipientsFor(tx, store, teams))(teams);
}

/**
 * Same as teamRecipients, but loads the members of all the given teams in one query and returns a
 * lookup for any subset of them — for sending several team notifications in one go.
 */
export async function teamRecipientsFor(
  tx: Tx,
  store: { state: string; ownerId: string },
  allTeams: readonly string[],
): Promise<(teams: readonly string[]) => string[]> {
  const real = [...new Set(allTeams.filter((t) => t !== "STORE_OWNER"))];
  const users = real.length
    ? await tx.user.findMany({
        where: {
          isActive: true,
          role: { in: ["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"] },
          teams: { hasSome: real },
          OR: [{ role: "SUPER_ADMIN" }, { regionStates: { has: store.state } }, { role: "TEAM_MEMBER", regionStates: { isEmpty: true } }],
        },
        select: { id: true, teams: true },
      })
    : [];
  return (teams) => [
    ...(teams.includes("STORE_OWNER") ? [store.ownerId] : []),
    ...users.filter((u) => u.teams.some((t) => teams.includes(t))).map((u) => u.id),
  ];
}
