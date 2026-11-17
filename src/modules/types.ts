/**
 * Config-driven step definitions, following the "New outlet launch: user flow" (Nov 2026).
 * These files are the defaults that seed the `module_templates` table. At runtime the table is
 * the source of truth for fields, schedule, photo minimums and who edits / approves a step
 * (HQ can change those in Settings); the flow structure (step number, prerequisites, notes)
 * comes from these files.
 */

export type FieldType =
  | "text"
  | "longtext"
  | "phone"
  | "number"
  | "currency" // INR
  | "percent"
  | "date"
  | "yesno"
  | "select"
  | "multiselect"
  | "file"
  | "task" // one point of the step, ticked when done; all must be ticked before the step is Completed
  | "checklist"; // repeatable rows with their own sub-fields

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Must be filled in before the step can be marked Completed. */
  required?: boolean;
  /** For task fields: who does this point, as written in the flow (e.g. "ASM · SH"). */
  owner?: string;
  /** Unit shown next to number fields, e.g. "ft", "kW", "Mbps". */
  unit?: string;
  options?: string[];
  /** For multiselect: also allow free-text entries. */
  allowOther?: boolean;
  min?: number;
  max?: number;
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

/** Who does the step, as colour-coded in the flow legend. */
export type DoneBy = "STORE_OWNER" | "SANGEETHA" | "BOTH";

export interface ModuleDefinition {
  moduleType: string;
  displayName: string;
  /** Compact label for grids and charts. */
  shortLabel: string;
  /** Step in the flow: 1–5 before keys (4 runs alongside 3–5), 6 = department tracks in parallel. */
  step: number;
  sortOrder: number;
  /** One line under the title, e.g. "Find and propose the site". */
  summary: string;
  doneBy: DoneBy;
  /** Who does it, as written in the flow (e.g. "Sangeetha, managed by Accounts"). */
  doneByLabel: string;
  /** Default teams that fill in the step ("STORE_OWNER" = the store's owner). SuperAdmin can always edit. */
  editTeams: string[];
  /** Default approving team. null = the owning team marks the step done (green) itself. */
  approverTeam: string | null;
  /** Text in the approval box of the flow, e.g. "All 8 points cleared". */
  approvalNote: string;
  /** Steps that must be done before this one can start. */
  requires: string[];
  /** Extra lines shown in the flow, e.g. "Handover date starts the setup clock". */
  notes?: string[];
  /** What the system does when the step is done, e.g. notify every department. */
  systemAction?: string;
  /** A value recorded after approval (e.g. the APX purchase order). */
  afterApproval?: { key: string; label: string; teams: string[]; pendingText: string; doneText: string };
  /** Days after key handover (Day 0). Placeholders to confirm with Sangeetha. */
  defaultStartOffsetDays: number | null;
  defaultDurationDays: number | null;
  /** Minimum photos before the step can be marked Completed (0 = none). */
  minPhotos: number;
  /** Only photos with this attachment tag count toward minPhotos. */
  photoTag?: string;
  fields: FieldDef[];
}
