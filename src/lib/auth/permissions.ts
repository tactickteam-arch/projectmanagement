import { SENSITIVE_VIEW_TEAMS, STORE_OWNER_TEAM } from "@/lib/teams";
import { canViewStore, type AccessSubject } from "./access";

/**
 * What each role may do. Checked on the server for every mutation; the UI uses the same
 * functions only to decide which buttons to show.
 *
 * Steps follow the launch flow: each step has teams that fill it in (`editTeams`, where
 * "STORE_OWNER" means the store's owner) and optionally a team that approves it
 * (`approverTeam`, e.g. Boss + CEO, RK, Accounts). SuperAdmin (HQ) can do both on every step.
 */
type StoreRef = { ownerId: string; state: string };
type StepRef = { editTeams: readonly string[]; approverTeam: string | null };

const inTeams = (u: AccessSubject, teams: readonly string[]) => (u.teams ?? []).some((t) => teams.includes(t));

export const can = {
  viewStore: (u: AccessSubject, s: StoreRef) => canViewStore(u, s),
  createStore: (u: AccessSubject) => u.role === "SUPER_ADMIN" || u.role === "STORE_OWNER",
  editStoreMaster: (u: AccessSubject, s: StoreRef) =>
    u.role === "SUPER_ADMIN" || (u.role === "STORE_OWNER" && s.ownerId === u.id),
  /** Fill in a step: SuperAdmin; the store owner on owner steps; members of the step's teams. */
  editModule: (u: AccessSubject, s: StoreRef, step: StepRef) => {
    if (u.role === "SUPER_ADMIN") return true;
    if (u.role === "STORE_OWNER") return s.ownerId === u.id && step.editTeams.includes(STORE_OWNER_TEAM);
    return canViewStore(u, s) && inTeams(u, step.editTeams);
  },
  /** Approve or reject a step: SuperAdmin, or a member of the step's approver team. */
  approveModule: (u: AccessSubject, s: StoreRef, step: StepRef) => {
    if (u.role === "SUPER_ADMIN") return true;
    if (u.role === "STORE_OWNER" || !step.approverTeam) return false;
    return canViewStore(u, s) && inTeams(u, [step.approverTeam]);
  },
  /** See a landlord's KYC and bank details: HQ, Accounts, HO, Legal, Boss + CEO, and the teams that
   * fill in the step. Everyone else sees them hidden. */
  viewSensitive: (u: AccessSubject, s: StoreRef, step: StepRef) =>
    u.role === "SUPER_ADMIN" || (canViewStore(u, s) && inTeams(u, SENSITIVE_VIEW_TEAMS)) || can.editModule(u, s, step),
  /** Record something after approval (e.g. HO releases the advance, the APX PO number). */
  recordAfterApproval: (u: AccessSubject, s: StoreRef, teams: readonly string[]) =>
    u.role === "SUPER_ADMIN" || (u.role !== "STORE_OWNER" && canViewStore(u, s) && inTeams(u, teams)),
  comment: (u: AccessSubject, s: StoreRef) => canViewStore(u, s),
  overrideStatus: (u: AccessSubject) => u.role === "SUPER_ADMIN",
  assignStores: (u: AccessSubject) => u.role === "SUPER_ADMIN",
  manageUsers: (u: AccessSubject) => u.role === "SUPER_ADMIN",
  manageTemplates: (u: AccessSubject) => u.role === "SUPER_ADMIN",
  viewDashboard: (u: AccessSubject) => u.role !== "STORE_OWNER",
  viewReports: (u: AccessSubject) => u.role !== "STORE_OWNER",
};
