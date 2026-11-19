import type { ApprovalStatus, ModuleStatus, OverallStatus } from "@/generated/prisma/enums";
import { getModuleDefinition, KEY_HANDOVER, LANDLORD_CHECK, LOCATION_FILING, MODULE_TYPES, SETUP_TRACK_TYPES, SITE_TYPES, SOFT_LAUNCH, TOKEN_ADVANCE } from "@/modules";

export interface ModuleState {
  moduleType: string;
  status: ModuleStatus;
  approvalStatus: ApprovalStatus;
  /** Needed to see whether gating after-approval records exist (e.g. HO paid the token advance). */
  details?: unknown;
}

export interface StoreState {
  overallStatus: OverallStatus | null;
  keyHandoverDate: Date | null;
  actualLaunchDate: Date | null;
}

/** Statuses only HQ can set; automatic updates never overwrite them. */
export const MANUAL_STATUSES: readonly OverallStatus[] = ["ON_HOLD", "DROPPED"];

/** Completed and approved (a step without an approver is approved when its team marks it done). */
export function isApproved(m: ModuleState): boolean {
  return m.status === "COMPLETED" && m.approvalStatus === "APPROVED";
}

/** Keys of gating records still missing after approval (e.g. "payment" on the token advance). */
export function pendingGates(m: ModuleState): string[] {
  const def = getModuleDefinition(m.moduleType);
  const details = (m.details ?? {}) as Record<string, unknown>;
  return (def?.afterApproval ?? []).filter((a) => a.gate && !details[a.key]).map((a) => a.key);
}

/** Done (green): approved, with every gating record made. */
export function isDone(m: ModuleState): boolean {
  return isApproved(m) && pendingGates(m).length === 0;
}

/** Only the steps of the current flow (rows of retired module types are ignored). */
export function flowModules<T extends ModuleState>(modules: T[]): T[] {
  return modules.filter((m) => MODULE_TYPES.includes(m.moduleType));
}

/**
 * Overall status along the SOP stages, checked from the furthest back:
 *   Soft launched            — 7 · Soft launch done
 *   All departments green    — every Stage 6 track green (soft launch gate open)
 *   Store setup in progress  — keys accepted and on-site work or any department track started
 *   Keys received            — RK accepted the key handover (Day 0)
 *   Token paid               — Accounts approved and HO paid the token advance
 *   Landlord check cleared   — RK cleared all 8 landlord points
 *   Location approved        — Boss + CEO approved the location filing
 *   null                     — location filing in progress
 * On Hold / Dropped are set manually by HQ and are kept as-is.
 */
export function computeOverallStatus(store: StoreState, modules: ModuleState[]): OverallStatus | null {
  if (store.overallStatus && MANUAL_STATUSES.includes(store.overallStatus)) return store.overallStatus;
  const byType = new Map(flowModules(modules).map((m) => [m.moduleType, m]));
  const done = (t: string) => {
    const m = byType.get(t);
    return m !== undefined && isDone(m);
  };
  const started = (t: string) => (byType.get(t)?.status ?? "NOT_STARTED") !== "NOT_STARTED";

  if (store.actualLaunchDate || done(SOFT_LAUNCH)) return "LAUNCHED";
  if (SETUP_TRACK_TYPES.every(done)) return "READY_FOR_LAUNCH";
  if (store.keyHandoverDate && [...SITE_TYPES, ...SETUP_TRACK_TYPES].some(started)) return "FITOUT_IN_PROGRESS";
  if (store.keyHandoverDate || done(KEY_HANDOVER)) return "KEYS_RECEIVED";
  if (done(TOKEN_ADVANCE)) return "TOKEN_PAID";
  if (done(LANDLORD_CHECK)) return "PREMISES_CLEARED";
  if (done(LOCATION_FILING)) return "LOCATION_FINALISED";
  return null;
}

/** Progress = steps done ÷ all steps × 100 (rounded). */
export function computeProgressPercent(modules: ModuleState[]): number {
  return Math.round((countDone(modules) / MODULE_TYPES.length) * 100);
}

export function countDone(modules: ModuleState[]): number {
  return flowModules(modules).filter(isDone).length;
}

export const TOTAL_STEPS = MODULE_TYPES.length;

/** Overdue = planned end date has passed and the step is not Completed. */
export function isOverdue(plannedEnd: Date | null, status: ModuleStatus, today: Date): boolean {
  return plannedEnd !== null && status !== "COMPLETED" && plannedEnd.getTime() < today.getTime();
}

export function daysOverdue(plannedEnd: Date | null, status: ModuleStatus, today: Date): number {
  if (!isOverdue(plannedEnd, status, today)) return 0;
  return Math.round((today.getTime() - (plannedEnd as Date).getTime()) / 86_400_000);
}

/**
 * Weekly RAG (SOP slide 11), per step:
 *   Green — done, or on track.
 *   Amber — due within 3 days, should have started but has not, waiting for approval / a gating
 *           record, or overdue while still waiting on an earlier step.
 *   Red   — overdue (and not waiting on an earlier step), or blocked.
 *   null  — not reached yet (waiting on earlier steps, not due).
 */
export type Rag = "R" | "A" | "G";
export function stepRag(m: ModuleState & { plannedStart: Date | null; plannedEnd: Date | null }, waiting: boolean, today: Date): Rag | null {
  if (isDone(m)) return "G";
  if (m.status === "BLOCKED") return "R";
  const late = m.plannedEnd !== null && m.plannedEnd.getTime() < today.getTime();
  if (late) return waiting ? "A" : m.status === "COMPLETED" ? "A" : "R";
  if (m.status === "COMPLETED") return "A";
  if (waiting) return null;
  const dueSoon = m.plannedEnd !== null && m.plannedEnd.getTime() - today.getTime() <= 3 * 86_400_000;
  const lateStart = m.status === "NOT_STARTED" && m.plannedStart !== null && m.plannedStart.getTime() < today.getTime();
  if (dueSoon || lateStart) return "A";
  if (m.status === "NOT_STARTED" && m.plannedStart === null) return null;
  return "G";
}

export function worstRag(list: (Rag | null)[]): Rag | null {
  if (list.includes("R")) return "R";
  if (list.includes("A")) return "A";
  if (list.includes("G")) return "G";
  return null;
}

export const RAG_LABELS: Record<Rag, string> = { R: "Red", A: "Amber", G: "Green" };

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
