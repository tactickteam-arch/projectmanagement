/**
 * Config-driven step definitions, following the New Outlet Launch SOP v2 (11 slides). These files
 * are the defaults that seed the `module_templates` table. At runtime the table is the source of
 * truth for fields, schedule, photo minimums and who edits / approves a step (HQ can change those
 * in Settings); the flow structure (stage, prerequisites, gates, checks) comes from these files.
 */

export type FieldType =
  | "text"
  | "longtext"
  | "phone"
  | "email"
  | "number"
  | "currency" // INR
  | "percent"
  | "date"
  | "yesno"
  | "select"
  | "multiselect"
  | "aadhaar" // only the last 4 digits are kept (shown as XXXX XXXX 1234)
  | "file"
  | "task" // one point of the step, ticked when done; all must be ticked before the step is Completed
  | "checklist"; // repeatable rows with their own sub-fields

/** Store master values a step shows read-only (e.g. MOU point 1 "Branch name"). */
export type StoreSource = "name" | "storeCode" | "state" | "address" | "carpetAreaSqft";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Number on the SOP sheet (e.g. 41-point MOU "Sr. 11"). */
  sr?: number;
  /** Heading the field is grouped under on the form. */
  section?: string;
  /** Spec shown under the field (e.g. the SOP standard for a landlord point). */
  help?: string;
  /** Must be filled in before the step can be marked Completed. For file fields: a file with the
   * field's attachment tag must be uploaded. */
  required?: boolean;
  /** For task fields: who does this point, as written in the SOP (e.g. "State Admin / ASM"). */
  owner?: string;
  /** Unit shown next to number fields, e.g. "sq ft", "kW". */
  unit?: string;
  options?: string[];
  /** For multiselect: also allow free-text entries. */
  allowOther?: boolean;
  min?: number;
  max?: number;
  /** For text fields: format check, e.g. PAN or IFSC. */
  pattern?: { regex: string; message: string };
  /** Shown from the store record (read-only on the step). */
  fromStore?: StoreSource;
  /** KYC / bank data: hidden from teams that do not need it. */
  sensitive?: boolean;
  /** Pre-filled from another step's value when empty (e.g. sanctioned load from the MOU sheet). */
  prefillFrom?: { moduleType: string; key: string };
  /** For checklist: columns of each row. The first column is the item name. */
  itemFields?: FieldDef[];
  /** For checklist: rows pre-filled when the step is opened (editable in Settings → Checklists). */
  defaultItems?: string[];
  /** For checklist: key of a yes/no column that must be ticked on every row before Completed. */
  mustTick?: string;
  /** For file fields: attachment tag used when uploading. */
  attachmentTag?: string;
  /** Field is only shown when another field has a given value. */
  showWhen?: { key: string; equals: string | boolean };
}

/** Who does the step, as colour-coded on the flow. */
export type DoneBy = "STORE_OWNER" | "SANGEETHA" | "BOTH";

/** Where a step sits in the SOP flow (slide 2). */
export type StepGroup =
  | "gate" // stages 1, 2, 3, 5: sequential approval gates
  | "parallel" // stage 4: legal & statutory alongside 3–5
  | "prekey" // due at T-7 (one week before the keys)
  | "site" // stage 6: strict 5-step on-site order (6·2 – 6·5 after keys)
  | "track" // stage 6: department tracks, each marked green
  | "launch"; // stage 7

/** SOP rules checked automatically before a step can be completed. */
export type SopCheck =
  | "powerLoad" // slide 4: 3-phase only, sanctioned kW ≥ the table for the store size
  | "acSizing" // slide 8: split < 1,000 sq ft, cassette ≥ 1,000; min 1 ton / 150 sq ft
  | "preKeyT7"; // slide 6: sign board done and materials ordered ≥ 7 days before the keys

/** Something recorded after the step is approved, by another team (slide 5: HO pays the advance,
 * the PO is raised in APX). A `gate` record must exist before the step counts as done. */
export interface AfterAction {
  key: string;
  label: string;
  teams: string[];
  fields: FieldDef[];
  pendingText: string;
  doneText: string;
  gate?: boolean;
}

/** What a step's planned dates are counted from. */
export type ScheduleAnchor =
  | "created" // the store record (week 1 of the 13-week chart)
  | "expectedKey" // the expected key handover date (MOU point 11) — T-7 work
  | "handover"; // the accepted key handover (Day 0)

export interface ModuleDefinition {
  moduleType: string;
  displayName: string;
  /** Compact label for grids and charts. */
  shortLabel: string;
  /** SOP stage 1–7. */
  stage: number;
  /** Label shown in the step's circle, e.g. "1", "6·2", "T-7". */
  code: string;
  group: StepGroup;
  sortOrder: number;
  /** One line under the title. */
  summary: string;
  doneBy: DoneBy;
  /** Owners as written in the SOP (e.g. "State Admin + ASM (managed by Accounts)"). */
  doneByLabel: string;
  /** Default teams that fill in the step ("STORE_OWNER" = the store's owner). SuperAdmin can always edit. */
  editTeams: string[];
  /** Support teams named in the SOP: notified with the owners, not required to act. */
  supportTeams?: string[];
  /** Default approving team. null = the owning team marks the step done (green) itself. */
  approverTeam: string | null;
  /** Text in the approval box, e.g. "All 8 points cleared". */
  approvalNote: string;
  /** Steps that must be done before this one can start. */
  requires: string[];
  /** Steps that must be done before this one can be marked Completed (e.g. a department track
   * that covers on-site steps). */
  completeAfter?: string[];
  /** Extra lines shown on the step, e.g. SOP rules. */
  notes?: string[];
  /** What the system does when the step is done. */
  systemAction?: string;
  afterApproval?: AfterAction[];
  /** Values of an earlier step shown for review (e.g. Accounts verifies the MOU sheet's KYC). */
  reviewFrom?: { moduleType: string; keys: string[]; title: string };
  checks?: SopCheck[];
  /** The actual end date must be entered when completing (the T-7 rule is checked against it). */
  requireActualEnd?: boolean;
  scheduleAnchor: ScheduleAnchor;
  /** Planned start = anchor + offset days; planned end = start + duration days (13-week chart, slide 10). */
  defaultStartOffsetDays: number | null;
  defaultDurationDays: number | null;
  /** Minimum photos before the step can be marked Completed (0 = none). */
  minPhotos: number;
  /** Only photos with this attachment tag count toward minPhotos. */
  photoTag?: string;
  fields: FieldDef[];
}
