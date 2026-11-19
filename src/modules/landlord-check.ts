import { SUPPLY_OPTIONS } from "@/lib/sop-rules";
import type { FieldDef, ModuleDefinition } from "./types";

/** SOP slide 5: the mandatory 8 landlord points (agreed before the token advance, verified 100%
 * complete at the key handover). */
export const EIGHT_POINTS: readonly { key: string; label: string; help: string }[] = [
  { key: "pt1ShutterLocks", label: "1 · Shutter side & central lock", help: "Heavy-duty side locks and central locking mechanism installed & functional." },
  { key: "pt2ShutterPaint", label: "2 · Shutter Oxford Blue paint", help: "External & internal shutter painted uniformly in approved Oxford Blue." },
  { key: "pt3Walls", label: "3 · Walls painting (L104)", help: "All store walls finished in Cotton Wool White — shade code L104." },
  { key: "pt4Ceiling", label: "4 · Ceiling painting (8286)", help: "Entire ceiling area painted in Platinum Disc — shade code 8286." },
  { key: "pt5MainLine", label: "5 · Main power line (6-core)", help: "6 sq. mm 6-core copper main power line from the meter to the store's farthest end (3-phase)." },
  { key: "pt6ShutterService", label: "6 · Shutter service", help: "Complete shutter servicing, greasing, spring tension & smooth operation." },
  { key: "pt7AcLocation", label: "7 · AC indoor & outdoor location", help: "Feasible indoor & outdoor AC unit mounting spots finalised & approved (back-to-back where applicable)." },
  { key: "pt8LPatti", label: "8 · Shutter L-patti work", help: "Shutter L-patti / L-angle framing and bottom sealing work completed." },
];

export const eightPointTasks = (prefix: string, owner: string, section: string): FieldDef[] =>
  EIGHT_POINTS.map((p) => ({ key: `${prefix}${p.key}`, label: p.label, type: "task", owner, help: p.help, section }));

const POINTS = "The 8 landlord points (slide 5)";
const INFRA = "Landlord infrastructure (slide 4)";

// SOP stage 2 (slides 2, 4, 5): commercial terms, 3-phase kW load and the 8-point civil check,
// by State Admin + ASM (managed by Accounts); RK approves once all 8 points are cleared.
export const landlordCheck: ModuleDefinition = {
  moduleType: "LANDLORD_CHECK",
  displayName: "8-point landlord check",
  shortLabel: "2 Landlord",
  stage: 2,
  code: "2",
  group: "gate",
  sortOrder: 2,
  summary: "Commercial terms, 3-phase kW load & 8-point civil check",
  doneBy: "SANGEETHA",
  doneByLabel: "State Admin / ASM (managed by Accounts)",
  editTeams: ["STATE_ADMIN", "ASM", "ACCOUNTS"],
  approverTeam: "RK",
  approvalNote: "All 8 points cleared",
  requires: ["LOCATION_FILING"],
  notes: ["Golden rule 2: lock all 8 landlord points before the token advance."],
  checks: ["powerLoad"],
  scheduleAnchor: "created",
  defaultStartOffsetDays: 21,
  defaultDurationDays: 14,
  minPhotos: 0,
  fields: [
    { key: "commercialTerms", label: "Commercial terms agreed with the landlord", type: "task", owner: "State Admin / ASM", section: "Commercial terms" },
    ...eightPointTasks("", "State Admin / ASM", POINTS),
    { key: "flooring", label: "Finished flooring", type: "task", owner: "State Admin / ASM", section: INFRA, help: "Landlord delivers finished flooring." },
    {
      key: "powerSupply",
      label: "Power connection",
      type: "select",
      options: SUPPLY_OPTIONS,
      required: true,
      section: INFRA,
      help: "A dedicated 3-phase connection is mandatory for every store.",
      prefillFrom: { moduleType: "LOCATION_FILING", key: "powerSupply" },
    },
    {
      key: "sanctionedLoadKw",
      label: "Sanctioned load",
      type: "number",
      unit: "kW",
      min: 0,
      required: true,
      section: INFRA,
      prefillFrom: { moduleType: "LOCATION_FILING", key: "powerCapacityKw" },
    },
    { key: "civilWorkDueDate", label: "Landlord civil work to finish by", type: "date", section: INFRA, help: "3-phase line, painting, shutter work — before the key handover." },
    { key: "landlordConfirmation", label: "Written confirmation of the 8 points (landlord)", type: "file", attachmentTag: "landlord_confirmation", required: true, section: POINTS },
    { key: "premisesPhotos", label: "Premises photos (optional)", type: "file", attachmentTag: "photo_premises", section: POINTS },
  ],
};
