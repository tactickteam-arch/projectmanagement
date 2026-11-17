import type { ModuleDefinition } from "./types";

// Flow step 2 "8-point landlord check" — Sangeetha, managed by Accounts; RK approves once all 8 points are cleared.
// The flow names two of the eight points (commercial terms, civil work by landlord). The other six
// default items are placeholders to confirm with Sangeetha; HQ can edit the list in Settings → Checklists.
export const landlordCheck: ModuleDefinition = {
  moduleType: "LANDLORD_CHECK",
  displayName: "8-point landlord check",
  shortLabel: "2 Landlord",
  step: 2,
  sortOrder: 2,
  summary: "Terms and readiness of the landlord's premises",
  doneBy: "SANGEETHA",
  doneByLabel: "Sangeetha, managed by Accounts",
  editTeams: ["ACCOUNTS", "STATE_ADMIN"],
  approverTeam: "RK",
  approvalNote: "All 8 points cleared",
  requires: ["LOCATION_FILING"],
  defaultStartOffsetDays: null,
  defaultDurationDays: null,
  minPhotos: 1,
  fields: [
    { key: "commercialTerms", label: "Commercial terms", type: "task", owner: "State admin" },
    { key: "civilWorkByLandlord", label: "Civil work by landlord", type: "task", owner: "State admin · ASM" },
    {
      key: "landlordPoints",
      label: "8-point landlord check",
      type: "checklist",
      mustTick: "cleared",
      defaultItems: [
        "Commercial terms agreed (rent, deposit, lock-in)",
        "Civil work by landlord complete",
        "Title and ownership documents verified",
        "Electrical load sanctioned",
        "Water supply and washroom",
        "Rolling shutter and frontage",
        "Signage permission from landlord",
        "Building / society NOC",
      ],
      itemFields: [
        { key: "itemName", label: "Point", type: "text" },
        { key: "cleared", label: "Cleared", type: "yesno" },
        { key: "note", label: "Note", type: "text" },
      ],
    },
    { key: "premisesPhotos", label: "Premises photos", type: "file", attachmentTag: "photo_premises" },
  ],
};
