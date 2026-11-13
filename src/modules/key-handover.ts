import type { ModuleDefinition } from "./types";

// Spec: "3. Key Handover (milestone, not a full module)". Photos at handover: minimum 2.
// The handover date itself is stored on stores.key_handover_date (it is Day 0 for fit-out).
export const keyHandover: ModuleDefinition = {
  moduleType: "KEY_HANDOVER",
  displayName: "Key Handover",
  sortOrder: 3,
  phase: "milestone",
  defaultStartOffsetDays: null,
  defaultDurationDays: null,
  minPhotos: 2,
  photoTag: "photo_handover",
  fields: [
    // The handover date itself is entered through the Key Handover form and stored on the store.
    { key: "receivedBy", label: "Received by", type: "text" },
    {
      key: "premisesCondition",
      label: "Condition of premises",
      type: "select",
      options: ["Good", "Needs repair"],
    },
    {
      key: "repairNotes",
      label: "Repair notes",
      type: "longtext",
      showWhen: { key: "premisesCondition", equals: "Needs repair" },
    },
    { key: "handoverPhotos", label: "Photos at handover", type: "file", attachmentTag: "photo_handover" },
  ],
};
