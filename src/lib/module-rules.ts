import { z } from "zod";
import type { ApprovalStatus, ModuleStatus } from "@/generated/prisma/enums";
import { isFitout, isMilestone } from "@/modules";
import type { FieldDef } from "@/modules/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Builds a validator for store_modules.details from a template's field_schema. All fields
 * optional (the spec does not mark module-specific fields mandatory — OPEN_QUESTIONS.md). */
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
  storeHasKeyHandover: boolean;
  photoCount: number;
  minPhotos: number;
}

/** Spec "Validation rules". Returns field → message for every rule broken. */
export function checkModuleRules(i: ModuleRuleInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (isMilestone(i.moduleType)) {
    errors.status = "Key Handover is recorded through the Key Handover form.";
    return errors;
  }
  if (i.current.status === "COMPLETED" && i.current.approvalStatus === "APPROVED") {
    errors.status = "This module is approved by HQ and can no longer be edited.";
    return errors;
  }
  if (isFitout(i.moduleType) && i.next.status !== "NOT_STARTED" && !i.storeHasKeyHandover) {
    errors.status = "Fit-out modules cannot start before the key handover date is entered.";
  }
  if (i.next.status === "BLOCKED" && !i.next.blockerReason?.trim()) {
    errors.blockerReason = "Give a reason when the module is Blocked.";
  }
  if (i.next.status === "COMPLETED" && i.photoCount < i.minPhotos) {
    errors.photos = `Upload at least ${i.minPhotos} photo${i.minPhotos > 1 ? "s" : ""} before marking this module Completed (${i.photoCount} so far).`;
  }
  if (i.next.actualStart && i.next.actualEnd && i.next.actualEnd < i.next.actualStart) {
    errors.actualEnd = "Actual end date cannot be before the actual start date.";
  }
  if (i.next.plannedStart && i.next.plannedEnd && i.next.plannedEnd < i.next.plannedStart) {
    errors.plannedEnd = "Planned end date cannot be before the planned start date.";
  }
  return errors;
}

/** Approval state after an owner saves the module. Marking Completed (again) asks HQ to review. */
export function approvalAfterSave(
  current: { status: ModuleStatus; approvalStatus: ApprovalStatus },
  nextStatus: ModuleStatus,
): { approvalStatus: ApprovalStatus; submitted: boolean } {
  if (nextStatus === "COMPLETED" && current.status !== "COMPLETED") return { approvalStatus: "PENDING", submitted: true };
  return { approvalStatus: current.approvalStatus, submitted: false };
}

export function canBeApproved(m: { moduleType: string; status: ModuleStatus; approvalStatus: ApprovalStatus }): boolean {
  return !isMilestone(m.moduleType) && m.status === "COMPLETED" && m.approvalStatus === "PENDING";
}
