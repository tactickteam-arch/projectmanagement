import { z } from "zod";
import type { ApprovalStatus, ModuleStatus } from "@/generated/prisma/enums";
import { acProblems, maskAadhaar, powerLoadProblems, preKeyProblems } from "@/lib/sop-rules";
import { isDone, type ModuleState } from "@/lib/status";
import { getModuleDefinition, MATERIAL_ORDERING, SIGN_BOARD } from "@/modules";
import type { FieldDef, SopCheck } from "@/modules/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Blank text is saved as "not filled in". */
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/** Builds a validator for store_modules.details from a template's field_schema. Every field may be
 * left empty while a step is in progress; `required` fields and tasks are checked on completion
 * (see completionErrors). Store-sourced and file fields are not part of the details. */
export function detailsSchema(fields: FieldDef[]): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    if (f.fromStore) continue;
    const s = fieldSchema(f);
    if (s) shape[f.key] = z.preprocess(blankToNull, s.nullable().optional());
  }
  return z.object(shape).strip() as unknown as z.ZodType<Record<string, unknown>>;
}

/** Validator for the values of an after-approval record (e.g. HO's payment). */
export function afterActionSchema(fields: FieldDef[]): z.ZodType<Record<string, unknown>> {
  return detailsSchema(fields);
}

function numberSchema(f: FieldDef) {
  let n = z.number({ error: `${f.label} must be a number` }).finite();
  if (f.min !== undefined) n = n.min(f.min, `${f.label} must be at least ${f.min}`);
  if (f.max !== undefined) n = n.max(f.max, `${f.label} must be at most ${f.max}`);
  return n;
}

export function fieldSchema(f: FieldDef): z.ZodType | null {
  switch (f.type) {
    case "text":
    case "phone": {
      const base = z.string().trim().max(200, `${f.label} is too long`);
      if (!f.pattern) return base;
      const re = new RegExp(f.pattern.regex);
      const msg = f.pattern.message;
      return f.type === "text"
        ? base.transform((v) => v.toUpperCase().replace(/\s+/g, "")).refine((v) => re.test(v), msg)
        : base.refine((v) => re.test(v), msg);
    }
    case "email":
      return z.string().trim().max(200).refine((v) => EMAIL_RE.test(v), `${f.label}: enter a valid email address`);
    case "aadhaar":
      return z
        .string()
        .trim()
        .transform((v, ctx) => {
          const masked = maskAadhaar(v);
          if (!masked) ctx.addIssue({ code: "custom", message: "Aadhaar number must be 12 digits" });
          return masked ?? "";
        });
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

type Sibling = Pick<ModuleState, "moduleType" | "status" | "approvalStatus" | "details">;

/** Steps that must be done before `moduleType` may start, and are not done yet. */
export function missingPrerequisites(moduleType: string, modules: readonly Sibling[]): string[] {
  return notDone(getModuleDefinition(moduleType)?.requires ?? [], modules);
}

/** Steps that must be done before `moduleType` can be marked Completed (e.g. the Interiors track
 * covers the on-site steps), and are not done yet. */
export function missingBeforeComplete(moduleType: string, modules: readonly Sibling[]): string[] {
  return notDone(getModuleDefinition(moduleType)?.completeAfter ?? [], modules);
}

function notDone(types: readonly string[], modules: readonly Sibling[]): string[] {
  return types.filter((t) => {
    const m = modules.find((x) => x.moduleType === t);
    return !m || !isDone(m);
  });
}

export interface SopContext {
  areaSqft: number | null;
  details: Record<string, unknown>;
  siblings: readonly (Sibling & { actualEnd: Date | null })[];
}

/** Automatic SOP checks (slides 4, 6, 8) as messages; empty = all clear. */
export function sopCheckErrors(checks: readonly SopCheck[] | undefined, ctx: SopContext): string[] {
  const out: string[] = [];
  for (const c of checks ?? []) {
    if (c === "powerLoad") {
      const kw = ctx.details.powerCapacityKw ?? ctx.details.sanctionedLoadKw;
      out.push(...powerLoadProblems(ctx.areaSqft, ctx.details.powerSupply, kw));
    } else if (c === "acSizing") {
      out.push(...acProblems(ctx.areaSqft, ctx.details.acType, ctx.details.acTonnage));
    } else if (c === "preKeyT7") {
      const state = (t: string) => {
        const m = ctx.siblings.find((s) => s.moduleType === t);
        return { done: !!m && isDone(m), completedOn: m?.actualEnd ? m.actualEnd.toISOString().slice(0, 10) : null };
      };
      const handover = typeof ctx.details.handoverDate === "string" ? ctx.details.handoverDate : null;
      out.push(...preKeyProblems(handover, state(SIGN_BOARD), state(MATERIAL_ORDERING)));
    }
  }
  return out;
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
  /** Display names of steps that must be done before this one is Completed. */
  missingBeforeComplete?: string[];
  photoCount: number;
  minPhotos: number;
  /** Field definitions and the details as they will be saved — checked when marking Completed. */
  fields?: FieldDef[];
  details?: Record<string, unknown>;
  /** Attachment tags uploaded to the step (required file fields), plus "final:<tag>" for each
   * design with an approved final version. */
  uploadedTags?: string[];
  /** Messages from sopCheckErrors, checked when marking Completed. */
  sopProblems?: string[];
  requireActualEnd?: boolean;
}

/** Validation rules plus the SOP's order of steps. Returns field → message for every rule broken. */
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
    const before = i.missingBeforeComplete ?? [];
    if (before.length && !errors.status) errors.status = `This step can be completed once ${joinNames(before)} ${before.length > 1 ? "are" : "is"} done.`;
    if (i.photoCount < i.minPhotos) {
      errors.photos = `Upload at least ${i.minPhotos} photo${i.minPhotos > 1 ? "s" : ""} before marking this step Completed (${i.photoCount} so far).`;
    }
    if (i.requireActualEnd && !i.next.actualEnd) errors.actualEnd = "Enter the actual end date (the date the work was finished).";
    Object.assign(errors, completionErrors(i.fields ?? [], i.details ?? {}, i.uploadedTags ?? []));
    if (i.sopProblems?.length) errors.sop = i.sopProblems.join(" ");
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

export const isVisible = (f: FieldDef, details: Record<string, unknown>) => !f.showWhen || details[f.showWhen.key] === f.showWhen.equals;

/** Before a step is Completed: every point (task) ticked, required fields filled and files
 * uploaded, checklists cleared. */
export function completionErrors(fields: FieldDef[], details: Record<string, unknown>, uploadedTags: readonly string[] = []): Record<string, string> {
  const errors: Record<string, string> = {};
  const openTasks = fields.filter((f) => f.type === "task" && details[f.key] !== true);
  if (openTasks.length) {
    errors.tasks = `Tick every point before marking this step Completed (open: ${openTasks.map((t) => t.label).join("; ")}).`;
    for (const t of openTasks) errors[`details.${t.key}`] = "Not done yet";
  }
  const missing: string[] = [];
  for (const f of fields) {
    if (!f.required || !isVisible(f, details)) continue;
    if (f.type === "file" && f.design) {
      const tag = f.attachmentTag ?? "document";
      if (!uploadedTags.includes(`final:${tag}`)) {
        errors[`file.${tag}`] = uploadedTags.includes(tag)
          ? `The final ${f.label.toLowerCase()} must be approved first (design approver)`
          : `Upload the ${f.label.toLowerCase()} and get the final version approved`;
        missing.push(f.label);
      }
    } else if (f.type === "file") {
      if (!uploadedTags.includes(f.attachmentTag ?? "document")) {
        errors[`file.${f.attachmentTag ?? "document"}`] = `Upload the ${f.label.toLowerCase()}`;
        missing.push(f.label);
      }
    } else if (isEmpty(details[f.key])) {
      errors[`details.${f.key}`] = f.fromStore ? `${f.label} is missing — add it under Store info` : `${f.label} is required`;
      missing.push(f.sr ? `${f.sr}. ${f.label}` : f.label);
    }
  }
  for (const f of fields) {
    if (f.type !== "checklist" || !f.mustTick) continue;
    const rows = Array.isArray(details[f.key]) ? (details[f.key] as Record<string, unknown>[]) : [];
    const tickLabel = f.itemFields?.find((x) => x.key === f.mustTick)?.label ?? f.mustTick;
    if (rows.length === 0) errors[`details.${f.key}`] = `Fill in the ${f.label}.`;
    else if (rows.some((r) => r[f.mustTick as string] !== true)) {
      const open = rows.filter((r) => r[f.mustTick as string] !== true).length;
      errors[`details.${f.key}`] = `${open} item${open === 1 ? "" : "s"} of the ${f.label} not marked “${tickLabel}”.`;
    }
  }
  if (missing.length) {
    errors.required = `Fill in every mandatory point before marking this step Completed — ${missing.length} missing: ${missing.slice(0, 8).join("; ")}${missing.length > 8 ? "; …" : ""}.`;
  }
  return errors;
}

function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Approval state after a save. Marking Completed asks the approver team to review; a step without
 * an approver (legal, on-site work, department tracks) is done as soon as its team marks it Completed.
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
