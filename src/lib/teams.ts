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

/** Pseudo-team used in edit_teams: the store's assigned owner. */
export const STORE_OWNER_TEAM = "STORE_OWNER";

/** Teams that may see a landlord's KYC and bank details (they verify or pay against them —
 * SOP slide 5 "Accounts verifies commercial terms, KYC"; HO releases payments). */
export const SENSITIVE_VIEW_TEAMS: readonly string[] = ["ACCOUNTS", "HO", "LEGAL", "LEADERSHIP"];

/** SOP slide 11: the weekly RAG tracker is circulated to State Admin, ASM, SH/BH, Legal, Marketing and HO. */
export const RAG_REPORT_TEAMS: readonly string[] = ["STATE_ADMIN", "ASM", "SALES", "BH", "LEGAL", "MARKETING", "HO"];

export function isTeamKey(k: string): k is TeamKey {
  return k in TEAMS;
}

export function teamLabel(k: string): string {
  if (k === STORE_OWNER_TEAM) return "Store owner";
  return isTeamKey(k) ? TEAMS[k] : k;
}

export function teamsLabel(keys: readonly string[]): string {
  return keys.map(teamLabel).join(", ");
}
