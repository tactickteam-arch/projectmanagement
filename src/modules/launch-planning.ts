import { setupTrack } from "./setup-track";

// Flow step 6 track "Launch planning" (SH · SL).
export const launchPlanning = setupTrack({
  moduleType: "LAUNCH_PLANNING",
  displayName: "Launch planning",
  shortLabel: "Launch plan",
  sortOrder: 17,
  doneByLabel: "SH · SL",
  editTeams: ["SALES"],
  defaultStartOffsetDays: 14,
  defaultDurationDays: 14,
  minPhotos: 0,
  fields: [
    { key: "finaliseLaunchDate", label: "Finalise launch date", type: "task" },
    { key: "launchOffer", label: "Launch offer", type: "task" },
    { key: "targetSetting", label: "Target setting", type: "task" },
    { key: "dataMiningCalls", label: "Data mining calls", type: "task" },
    { key: "plannedLaunchDate", label: "Planned soft launch date", type: "date" },
    { key: "launchOfferDetails", label: "Launch offer details", type: "longtext" },
    { key: "monthlyTarget", label: "First-month sales target", type: "currency", min: 0 },
    { key: "callsMade", label: "Data mining calls made", type: "number", min: 0 },
  ],
});
