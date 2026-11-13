/**
 * Config-driven module definitions (spec: "one definition file per module").
 * These files are the defaults that seed the `module_templates` table; at runtime
 * the table is the source of truth so HQ can edit templates in Settings (Phase 5).
 *
 * `required` is deliberately false everywhere: the spec does not say which
 * module-specific fields are mandatory (see REQUIREMENTS.md Q-REQUIRED-FIELDS).
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
  | "checklist"; // repeatable rows with their own sub-fields

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Unit shown next to number fields, e.g. "ft", "kW", "Mbps". */
  unit?: string;
  options?: string[];
  /** For multiselect: also allow free-text entries. */
  allowOther?: boolean;
  min?: number;
  max?: number;
  /** For checklist: columns of each row. */
  itemFields?: FieldDef[];
  /** For checklist: rows pre-filled when the module is created. */
  defaultItems?: string[];
  /** For file fields: attachment tag used when uploading. */
  attachmentTag?: string;
  /** Field is only shown/required when another field has a given value. */
  showWhen?: { key: string; equals: string | boolean };
}

export interface ModuleDefinition {
  moduleType: string;
  displayName: string;
  sortOrder: number;
  /** "sequential" = before key handover; "milestone" = key handover; "fitout" = parallel after handover. */
  phase: "sequential" | "milestone" | "fitout";
  /** Days after key handover (placeholders in spec, to confirm with Sangeetha). */
  defaultStartOffsetDays: number | null;
  defaultDurationDays: number | null;
  /** Minimum photos before the module can be marked Completed. */
  minPhotos: number;
  /** Only photos with this attachment tag count toward minPhotos (e.g. final store photos). */
  photoTag?: string;
  fields: FieldDef[];
}
