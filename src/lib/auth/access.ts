import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

/** Minimal user fields needed for access decisions. */
export interface AccessSubject {
  id: string;
  role: Role;
  regionStates: string[];
  /** Teams (src/lib/teams.ts) — decide which steps the user fills in or approves. */
  teams?: string[];
}

/**
 * Spec "Users and roles" — which stores a user may see:
 *   SuperAdmin       → all stores
 *   Regional Manager → stores in their assigned states
 *   Store Owner      → only stores assigned to them
 *   Team member      → stores in their states, or all stores when no state is set
 *                      (department teams such as Accounts or Marketing work across India)
 * Every store query must be filtered through this.
 */
export function storeScope(user: AccessSubject): Prisma.StoreWhereInput {
  switch (user.role) {
    case "SUPER_ADMIN":
      return {};
    case "REGIONAL_MANAGER":
      return { state: { in: user.regionStates } };
    case "STORE_OWNER":
      return { ownerId: user.id };
    case "TEAM_MEMBER":
      return user.regionStates.length ? { state: { in: user.regionStates } } : {};
    default: {
      const exhaustive: never = user.role;
      throw new Error(`Unknown role ${String(exhaustive)}`);
    }
  }
}

/** Same rule for a single already-loaded store. */
export function canViewStore(user: AccessSubject, store: { ownerId: string; state: string }): boolean {
  switch (user.role) {
    case "SUPER_ADMIN":
      return true;
    case "REGIONAL_MANAGER":
      return user.regionStates.includes(store.state);
    case "STORE_OWNER":
      return store.ownerId === user.id;
    case "TEAM_MEMBER":
      return user.regionStates.length === 0 || user.regionStates.includes(store.state);
    default:
      return false;
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "SuperAdmin (HQ)",
  REGIONAL_MANAGER: "Regional Manager",
  STORE_OWNER: "Store Owner",
  TEAM_MEMBER: "Sangeetha team",
};
