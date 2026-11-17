/**
 * Sangeetha teams from the new-outlet launch flow. A user (SuperAdmin, Regional Manager or
 * Team member) can belong to several teams. Teams decide who fills in a step and who approves it
 * (module_templates.edit_teams / approver_team, editable in Settings → Steps & approvals).
 */
export const TEAMS = {
  LEADERSHIP: "Boss + CEO",
  RK: "RK",
  ACCOUNTS: "Accounts",
  LEGAL: "Legal",
  TAX: "Tax team",
  STATE_ADMIN: "State admin",
  MARKETING: "Marketing",
  INTERIORS: "Interiors",
  BRAND_MANAGERS: "Brand managers",
  HR: "HR",
  PURCHASE: "Purchase · e-com",
  FINANCE_IT: "Consumer finance · IT · Admin",
  SALES: "Sales heads (SH · SL)",
} as const;

export type TeamKey = keyof typeof TEAMS;
export const TEAM_KEYS = Object.keys(TEAMS) as TeamKey[];

/** Pseudo-team used in edit_teams: the store's assigned owner. */
export const STORE_OWNER_TEAM = "STORE_OWNER";

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
