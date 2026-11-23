import { DESIGN_APPROVER, SENSITIVE_VIEW_TEAMS, SITE_PHOTOS, STORE_CREATOR, STORE_OWNER_TEAM } from "@/lib/teams";
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
  /** Create a new store: the people marked "Can create new stores" (Manju and RK), and HQ as admin. */
  createStore: (u: AccessSubject) => u.role === "SUPER_ADMIN" || (u.role !== "STORE_OWNER" && inTeams(u, [STORE_CREATOR])),
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
  /** See a landlord's KYC and bank details: Accounts only. Everyone else (HQ included) sees them
   * hidden; the teams that fill in the step can still enter or replace them. */
  viewSensitive: (u: AccessSubject, s: StoreRef) => u.role !== "STORE_OWNER" && canViewStore(u, s) && inTeams(u, SENSITIVE_VIEW_TEAMS),
  /** Approve (lock) or unlock the final version of a design: Sumanth ("Approves final designs"), and HQ as admin. */
  approveDesign: (u: AccessSubject, s: StoreRef) =>
    u.role === "SUPER_ADMIN" || (u.role !== "STORE_OWNER" && canViewStore(u, s) && inTeams(u, [DESIGN_APPROVER])),
  /** Log a snag: anyone who can see the store (owner, staff, HQ). */
  raiseSnag: (u: AccessSubject, s: StoreRef) => canViewStore(u, s),
  /** Fix a snag (upload the "after" photo or video): the department it is assigned to, the store
   * owner, the person who logged it, and HQ. */
  fixSnag: (u: AccessSubject & { id: string }, s: StoreRef, snag: { team: string; raisedById: string }) =>
    u.role === "SUPER_ADMIN" ||
    (canViewStore(u, s) && (u.id === snag.raisedById || (u.role === "STORE_OWNER" ? s.ownerId === u.id : inTeams(u, [snag.team])))),
  /** Close a snag after seeing the fix (or send it back): the person who logged it, RK, and HQ. */
  closeSnag: (u: AccessSubject & { id: string }, s: StoreRef, snag: { raisedById: string }) =>
    u.role === "SUPER_ADMIN" || (canViewStore(u, s) && (u.id === snag.raisedById || (u.role !== "STORE_OWNER" && inTeams(u, ["RK"])))),
  /** Post daily site photos for a step: Manju ("Posts daily site photos"), the step's department, HQ. */
  postSitePhotos: (u: AccessSubject, s: StoreRef, step: StepRef) =>
    u.role === "SUPER_ADMIN" ||
    (canViewStore(u, s) && ((u.role !== "STORE_OWNER" && inTeams(u, [SITE_PHOTOS])) || can.editModule(u, s, step))),
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
