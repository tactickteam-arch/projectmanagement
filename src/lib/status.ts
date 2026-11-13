import type { ApprovalStatus, ModuleStatus, OverallStatus } from "@/generated/prisma/enums";
import { FITOUT_MODULE_TYPES, SETUP_MODULE_TYPES, STORE_LOCATION, TOKEN_ADVANCE } from "@/modules";

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

export function isApproved(m: ModuleState): boolean {
  return m.status === "COMPLETED" && m.approvalStatus === "APPROVED";
}

/** Setup modules only (Key Handover milestone excluded). */
export function setupModules<T extends ModuleState>(modules: T[]): T[] {
  return modules.filter((m) => SETUP_MODULE_TYPES.includes(m.moduleType));
}

/**
 * Spec "Overall status rules", checked from the furthest stage back:
 *   Launched            — actual launch date entered
 *   Ready for Launch    — all modules approved (the 7 setup modules)
 *   Fit-out in Progress — any fit-out module started (status other than Not Started)
 *   Keys Received       — key handover date entered
 *   Token Paid          — Token Advance Completed
 *   Location Finalised  — Store Location approved by HQ
 *   null                — none of the above yet (OPEN_QUESTIONS.md)
 * On Hold / Dropped are set manually by HQ and are kept as-is.
 */
export function computeOverallStatus(store: StoreState, modules: ModuleState[]): OverallStatus | null {
  if (store.overallStatus && MANUAL_STATUSES.includes(store.overallStatus)) {
    return store.overallStatus;
  }
  const byType = new Map(modules.map((m) => [m.moduleType, m]));
  const setup = setupModules(modules);

  if (store.actualLaunchDate) return "LAUNCHED";
  if (setup.length === SETUP_MODULE_TYPES.length && setup.every(isApproved)) return "READY_FOR_LAUNCH";
  if (FITOUT_MODULE_TYPES.some((t) => (byType.get(t)?.status ?? "NOT_STARTED") !== "NOT_STARTED")) {
    return "FITOUT_IN_PROGRESS";
  }
  if (store.keyHandoverDate) return "KEYS_RECEIVED";
  if (byType.get(TOKEN_ADVANCE)?.status === "COMPLETED") return "TOKEN_PAID";
  const location = byType.get(STORE_LOCATION);
  if (location && isApproved(location)) return "LOCATION_FINALISED";
  return null;
}

/** Spec: Overall progress = approved modules ÷ total modules × 100 (7 setup modules; rounded). */
export function computeProgressPercent(modules: ModuleState[]): number {
  const setup = setupModules(modules);
  if (setup.length === 0) return 0;
  return Math.round((setup.filter(isApproved).length / SETUP_MODULE_TYPES.length) * 100);
}

export function countApproved(modules: ModuleState[]): number {
  return setupModules(modules).filter(isApproved).length;
}

/** Spec: Overdue = planned end date has passed and status is not Completed. */
export function isOverdue(plannedEnd: Date | null, status: ModuleStatus, today: Date): boolean {
  return plannedEnd !== null && status !== "COMPLETED" && plannedEnd.getTime() < today.getTime();
}

export function daysOverdue(plannedEnd: Date | null, status: ModuleStatus, today: Date): number {
  if (!isOverdue(plannedEnd, status, today)) return 0;
  return Math.round((today.getTime() - (plannedEnd as Date).getTime()) / 86_400_000);
}

export const OVERALL_STATUS_LABELS: Record<OverallStatus, string> = {
  LOCATION_FINALISED: "Location Finalised",
  TOKEN_PAID: "Token Paid",
  KEYS_RECEIVED: "Keys Received",
  FITOUT_IN_PROGRESS: "Fit-out in Progress",
  READY_FOR_LAUNCH: "Ready for Launch",
  LAUNCHED: "Launched",
  ON_HOLD: "On Hold",
  DROPPED: "Dropped",
};

export const OVERALL_STATUS_ORDER: OverallStatus[] = [
  "LOCATION_FINALISED",
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
