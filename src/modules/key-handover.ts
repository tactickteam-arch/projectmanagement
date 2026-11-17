import type { ModuleDefinition } from "./types";

// Flow step 5 "Key received" — done by both Sangeetha and the store owner; RK accepts the handover.
// On acceptance the handover date becomes Day 0: department tracks are scheduled from it and every
// department is notified to start step 6. The 8 handover points are placeholders to confirm.
export const keyHandover: ModuleDefinition = {
  moduleType: "KEY_HANDOVER",
  displayName: "Key received",
  shortLabel: "5 Keys",
  step: 5,
  sortOrder: 5,
  summary: "8-point handover check; depends on landlord civil work being complete",
  doneBy: "BOTH",
  doneByLabel: "Sangeetha + store owner",
  editTeams: ["STORE_OWNER", "STATE_ADMIN"],
  approverTeam: "RK",
  approvalNote: "Handover accepted",
  requires: ["TOKEN_ADVANCE"],
  notes: ["Handover date starts the setup clock"],
  systemAction: "System notifies every department to start step 6",
  defaultStartOffsetDays: null,
  defaultDurationDays: null,
  minPhotos: 2,
  photoTag: "photo_handover",
  fields: [
    { key: "keyHandover", label: "Key handover", type: "task", owner: "State admin" },
    { key: "handoverDate", label: "Handover date", type: "date", required: true },
    { key: "receivedBy", label: "Keys received by", type: "text", required: true },
    { key: "premisesCondition", label: "Condition of premises", type: "select", options: ["Good", "Needs repair"] },
    { key: "repairNotes", label: "Repair notes", type: "longtext", showWhen: { key: "premisesCondition", equals: "Needs repair" } },
    {
      key: "handoverPoints",
      label: "8-point handover check",
      type: "checklist",
      mustTick: "ok",
      defaultItems: [
        "All keys received (shutter, doors, panels)",
        "Landlord civil work complete as agreed",
        "Flooring, walls and ceiling finished",
        "Main power supply and meter working",
        "Water supply and washroom working",
        "Shutter and locks working",
        "No leakage or seepage",
        "Meter readings recorded",
      ],
      itemFields: [
        { key: "itemName", label: "Point", type: "text" },
        { key: "ok", label: "OK", type: "yesno" },
        { key: "note", label: "Note", type: "text" },
      ],
    },
    { key: "handoverPhotos", label: "Photos at handover", type: "file", attachmentTag: "photo_handover" },
  ],
};
