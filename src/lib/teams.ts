/**
 * Sangeetha teams named in the New Outlet Launch SOP (v2). A user (SuperAdmin, Regional Manager or
 * Team member) can belong to several teams. Teams decide who fills in a step and who approves it
 * (module_templates.edit_teams / approver_team, editable in Settings → Steps & approvals).
 */
export const TEAMS = {
  LEADERSHIP: "Boss + CEO",
  RK: "RK",
  ACCOUNTS: "Accounts",
  HO: "Head office (HO)",
  LEGAL: "Legal",
  TAX: "Tax team",
  STATE_ADMIN: "State Admin",
  ASM: "ASM",
  SALES: "Sales head (SH · SL)",
  BH: "Business head (BH)",
  MARKETING: "Marketing",
  INTERIORS: "Interiors",
  BRAND_MANAGERS: "Brand managers",
  HR: "HR",
  PURCHASE: "Purchase · e-Com (CXO)",
  FINANCE_IT: "Consumer finance · IT · Admin",
} as const;

export type TeamKey = keyof typeof TEAMS;
export const TEAM_KEYS = Object.keys(TEAMS) as TeamKey[];

/** Extra rights kept in a user's teams list. They are not departments: they fill in and approve no step. */
export const PERMISSIONS = {
  STORE_CREATOR: "Can create new stores",
} as const;
export type PermissionKey = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];
export function isPermissionKey(k: string): k is PermissionKey {
  return k in PERMISSIONS;
}
/** The user's departments, without extra rights such as "Can create new stores". */
export function departmentsOf(keys: readonly string[]): string[] {
  return keys.filter((k) => !isPermissionKey(k));
}
/** Shown instead of a KYC value to users who may not see it. */
export const HIDDEN_VALUE = "•••• hidden";
/** Who creates a new store in the app: the people HQ marks "Can create new stores" (Manju and RK). */
export const STORE_CREATOR = "STORE_CREATOR";

/** Pseudo-team used in edit_teams: the store's assigned owner. */
export const STORE_OWNER_TEAM = "STORE_OWNER";

/** Teams that may see a landlord's KYC and bank details (MOU points 31–35). Decided 21 Nov 2026:
 * Accounts only (SOP slide 5 "Accounts verifies commercial terms, KYC"). Others who fill in step 1
 * can enter or replace the values but not read them back. */
export const SENSITIVE_VIEW_TEAMS: readonly string[] = ["ACCOUNTS"];

/** SOP slide 11: the weekly RAG tracker is circulated to State Admin, ASM, SH/BH, Legal, Marketing and HO. */
export const RAG_REPORT_TEAMS: readonly string[] = ["STATE_ADMIN", "ASM", "SALES", "BH", "LEGAL", "MARKETING", "HO"];

export function isTeamKey(k: string): k is TeamKey {
  return k in TEAMS;
}

export function teamLabel(k: string): string {
  if (k === STORE_OWNER_TEAM) return "Store owner";
  if (isPermissionKey(k)) return PERMISSIONS[k];
  return isTeamKey(k) ? TEAMS[k] : k;
}

export function teamsLabel(keys: readonly string[]): string {
  return keys.filter((k) => !isPermissionKey(k)).map(teamLabel).join(", ");
}
