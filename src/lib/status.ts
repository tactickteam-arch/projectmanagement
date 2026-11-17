import type { ApprovalStatus, ModuleStatus, OverallStatus } from "@/generated/prisma/enums";
import { KEY_HANDOVER, LANDLORD_CHECK, LOCATION_FILING, MODULE_TYPES, SETUP_TRACK_TYPES, TOKEN_ADVANCE } from "@/modules";

export interface ModuleState {
  moduleType: string;
  status: ModuleStatus;
  approvalStatus: ApprovalStatus;
}

export interface StoreState {
  overallStatus: OverallStatus | null;
  keyHandoverDate: Date | null;
  actualLaunchDate: Date | null;
}

/** Statuses only HQ can set; automatic updates never overwrite them. */
export const MANUAL_STATUSES: readonly OverallStatus[] = ["ON_HOLD", "DROPPED"];

/** A step is done (green) when Completed and approved. Steps without an approver are approved
 * automatically when the owning team marks them Completed. */
export function isApproved(m: ModuleState): boolean {
  return m.status === "COMPLETED" && m.approvalStatus === "APPROVED";
}
export const isDone = isApproved;

/** Only the steps of the current flow (rows of retired module types are ignored). */
export function flowModules<T extends ModuleState>(modules: T[]): T[] {
  return modules.filter((m) => MODULE_TYPES.includes(m.moduleType));
}

/**
 * Overall status, following the launch flow, checked from the furthest stage back:
 *   Launched (soft launch)  — actual launch date entered (step 7)
 *   Ready for Launch        — every step done: steps 1–5 and all department tracks green
 *   Store setup in progress — keys accepted and any department track started (step 6)
 *   Keys Received           — RK accepted the key handover (key handover date set, step 5)
 *   Token Paid              — Token advance approved by Accounts (step 3)
 *   Landlord check cleared  — 8-point landlord check approved by RK (step 2)
 *   Location approved       — Location filing approved by Boss + CEO (step 1)
 *   null                    — location filing still in progress
 * On Hold / Dropped are set manually by HQ and are kept as-is.
 */
export function computeOverallStatus(store: StoreState, modules: ModuleState[]): OverallStatus | null {
  if (store.overallStatus && MANUAL_STATUSES.includes(store.overallStatus)) {
    return store.overallStatus;
  }
  const byType = new Map(flowModules(modules).map((m) => [m.moduleType, m]));
  const done = (t: string) => {
    const m = byType.get(t);
    return m !== undefined && isApproved(m);
  };

  if (store.actualLaunchDate) return "LAUNCHED";
  if (MODULE_TYPES.every(done)) return "READY_FOR_LAUNCH";
  if (store.keyHandoverDate && SETUP_TRACK_TYPES.some((t) => (byType.get(t)?.status ?? "NOT_STARTED") !== "NOT_STARTED")) {
    return "FITOUT_IN_PROGRESS";
  }
  if (store.keyHandoverDate || done(KEY_HANDOVER)) return "KEYS_RECEIVED";
  if (done(TOKEN_ADVANCE)) return "TOKEN_PAID";
  if (done(LANDLORD_CHECK)) return "PREMISES_CLEARED";
  if (done(LOCATION_FILING)) return "LOCATION_FINALISED";
  return null;
}

/** Progress = steps done ÷ all steps × 100 (rounded). */
export function computeProgressPercent(modules: ModuleState[]): number {
  return Math.round((countApproved(modules) / MODULE_TYPES.length) * 100);
}

export function countApproved(modules: ModuleState[]): number {
  return flowModules(modules).filter(isApproved).length;
}

export const TOTAL_STEPS = MODULE_TYPES.length;

/** Spec: Overdue = planned end date has passed and status is not Completed. */
export function isOverdue(plannedEnd: Date | null, status: ModuleStatus, today: Date): boolean {
  return plannedEnd !== null && status !== "COMPLETED" && plannedEnd.getTime() < today.getTime();
}

export function daysOverdue(plannedEnd: Date | null, status: ModuleStatus, today: Date): number {
  if (!isOverdue(plannedEnd, status, today)) return 0;
  return Math.round((today.getTime() - (plannedEnd as Date).getTime()) / 86_400_000);
}

export const NO_STATUS_LABEL = "Location filing";

export const OVERALL_STATUS_LABELS: Record<OverallStatus, string> = {
  LOCATION_FINALISED: "Location approved",
  PREMISES_CLEARED: "Landlord check cleared",
  TOKEN_PAID: "Token paid",
  KEYS_RECEIVED: "Keys received",
  FITOUT_IN_PROGRESS: "Store setup in progress",
  READY_FOR_LAUNCH: "All departments green",
  LAUNCHED: "Soft launched",
  ON_HOLD: "On Hold",
  DROPPED: "Dropped",
};

export const OVERALL_STATUS_ORDER: OverallStatus[] = [
  "LOCATION_FINALISED",
  "PREMISES_CLEARED",
  "TOKEN_PAID",
  "KEYS_RECEIVED",
  "FITOUT_IN_PROGRESS",
  "READY_FOR_LAUNCH",
  "LAUNCHED",
  "ON_HOLD",
  "DROPPED",
];

export const MODULE_STATUS_LABELS: Record<ModuleStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
