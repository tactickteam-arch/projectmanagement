import { z } from "zod";
import type { ApprovalStatus, ModuleStatus } from "@/generated/prisma/enums";
import { getModuleDefinition } from "@/modules";
import type { FieldDef } from "@/modules/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Builds a validator for store_modules.details from a template's field_schema. Every field may be
 * left empty while a step is in progress; `required` fields and tasks are checked on completion
 * (see completionErrors). */
export function detailsSchema(fields: FieldDef[]): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    const s = fieldSchema(f);
    if (s) shape[f.key] = s.nullable().optional();
  }
  return z.object(shape).strip() as unknown as z.ZodType<Record<string, unknown>>;
}

function numberSchema(f: FieldDef) {
  let n = z.number({ error: `${f.label} must be a number` }).finite();
  if (f.min !== undefined) n = n.min(f.min, `${f.label} must be at least ${f.min}`);
  if (f.max !== undefined) n = n.max(f.max, `${f.label} must be at most ${f.max}`);
  return n;
}

function fieldSchema(f: FieldDef): z.ZodType | null {
  switch (f.type) {
    case "text":
    case "phone":
      return z.string().trim().max(200, `${f.label} is too long`);
    case "longtext":
      return z.string().trim().max(4000, `${f.label} is too long`);
    case "number":
    case "currency":
    case "percent":
      return numberSchema(f);
    case "date":
      return z.string().regex(DATE_RE, `${f.label} must be a date`);
    case "yesno":
    case "task":
      return z.boolean();
    case "select":
      return z.enum((f.options ?? []) as [string, ...string[]], { error: `Choose a valid ${f.label}` });
    case "multiselect": {
      const item = f.allowOther || !f.options?.length ? z.string().trim().min(1).max(100) : z.enum(f.options as [string, ...string[]]);
      return z.array(item).max(50);
    }
    case "checklist": {
      const row: Record<string, z.ZodType> = {};
      for (const sub of f.itemFields ?? []) {
        const s = fieldSchema(sub);
        if (s) row[sub.key] = s.nullable().optional();
      }
      return z.array(z.object(row).strip()).max(100);
    }
    case "file":
      return null; // files are attachments, not details
  }
}

export interface ModuleRuleInput {
  moduleType: string;
  current: { status: ModuleStatus; approvalStatus: ApprovalStatus };
  next: {
    status: ModuleStatus;
    blockerReason: string | null;
    actualStart: Date | null;
    actualEnd: Date | null;
    plannedStart: Date | null;
    plannedEnd: Date | null;
  };
  /** Display names of earlier steps that are not done yet (see missingPrerequisites). */
  missingPrerequisites: string[];
  photoCount: number;
  minPhotos: number;
  /** Field definitions and the details as they will be saved — checked when marking Completed. */
  fields?: FieldDef[];
  details?: Record<string, unknown>;
}

/** Steps that must be done before `moduleType` may start, and are not done yet. */
export function missingPrerequisites(
  moduleType: string,
  modules: readonly { moduleType: string; status: ModuleStatus; approvalStatus: ApprovalStatus }[],
): string[] {
  const def = getModuleDefinition(moduleType);
  if (!def) return [];
  return def.requires.filter((t) => {
    const m = modules.find((x) => x.moduleType === t);
    return !m || m.status !== "COMPLETED" || m.approvalStatus !== "APPROVED";
  });
}

/** Spec "Validation rules" plus the flow's order of steps. Returns field → message for every rule broken. */
export function checkModuleRules(i: ModuleRuleInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (i.current.status === "COMPLETED" && i.current.approvalStatus === "APPROVED") {
    errors.status = "This step is done and approved; it can no longer be edited.";
    return errors;
  }
  if (i.next.status !== "NOT_STARTED" && i.missingPrerequisites.length) {
    errors.status = `This step can start once ${joinNames(i.missingPrerequisites)} ${i.missingPrerequisites.length > 1 ? "are" : "is"} done.`;
  }
  if (i.next.status === "BLOCKED" && !i.next.blockerReason?.trim()) {
    errors.blockerReason = "Give a reason when the step is Blocked.";
  }
  if (i.next.status === "COMPLETED") {
    if (i.photoCount < i.minPhotos) {
      errors.photos = `Upload at least ${i.minPhotos} photo${i.minPhotos > 1 ? "s" : ""} before marking this step Completed (${i.photoCount} so far).`;
    }
    Object.assign(errors, completionErrors(i.fields ?? [], i.details ?? {}));
  }
  if (i.next.actualStart && i.next.actualEnd && i.next.actualEnd < i.next.actualStart) {
    errors.actualEnd = "Actual end date cannot be before the actual start date.";
  }
  if (i.next.plannedStart && i.next.plannedEnd && i.next.plannedEnd < i.next.plannedStart) {
    errors.plannedEnd = "Planned end date cannot be before the planned start date.";
  }
  return errors;
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** Before a step is Completed: every point (task) ticked, required fields filled, checklists cleared. */
export function completionErrors(fields: FieldDef[], details: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  const visible = (f: FieldDef) => !f.showWhen || details[f.showWhen.key] === f.showWhen.equals;
  const openTasks = fields.filter((f) => f.type === "task" && details[f.key] !== true);
  if (openTasks.length) {
    errors.tasks = `Tick every point before marking this step Completed (open: ${openTasks.map((t) => t.label).join("; ")}).`;
    for (const t of openTasks) errors[`details.${t.key}`] = "Not done yet";
  }
  for (const f of fields) {
    if (f.required && visible(f) && f.type !== "file" && isEmpty(details[f.key])) errors[`details.${f.key}`] = `${f.label} is required`;
    if (f.type === "checklist" && f.mustTick) {
      const rows = Array.isArray(details[f.key]) ? (details[f.key] as Record<string, unknown>[]) : [];
      const tickLabel = f.itemFields?.find((x) => x.key === f.mustTick)?.label ?? f.mustTick;
      if (rows.length === 0) errors[`details.${f.key}`] = `Fill in the ${f.label}.`;
      else if (rows.some((r) => r[f.mustTick as string] !== true)) {
        const open = rows.filter((r) => r[f.mustTick as string] !== true).length;
        errors[`details.${f.key}`] = `${open} item${open === 1 ? "" : "s"} of the ${f.label} not marked “${tickLabel}”.`;
      }
    }
  }
  return errors;
}

function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Approval state after a save. Marking Completed asks the approver team to review; a step without
 * an approver (Legal, department tracks) is done as soon as its team marks it Completed.
 */
export function approvalAfterSave(
  current: { status: ModuleStatus; approvalStatus: ApprovalStatus },
  nextStatus: ModuleStatus,
  hasApprover = true,
): { approvalStatus: ApprovalStatus; submitted: boolean; autoApproved: boolean } {
  if (nextStatus === "COMPLETED" && current.status !== "COMPLETED") {
    return hasApprover
      ? { approvalStatus: "PENDING", submitted: true, autoApproved: false }
      : { approvalStatus: "APPROVED", submitted: true, autoApproved: true };
  }
  return { approvalStatus: current.approvalStatus, submitted: false, autoApproved: false };
}

export function canBeApproved(m: { status: ModuleStatus; approvalStatus: ApprovalStatus }): boolean {
  return m.status === "COMPLETED" && m.approvalStatus === "PENDING";
}
