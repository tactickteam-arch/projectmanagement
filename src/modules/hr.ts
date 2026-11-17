import { setupTrack } from "./setup-track";

// Flow step 6 track "HR" (HR, with DM).
export const hr = setupTrack({
  moduleType: "HR",
  displayName: "HR",
  shortLabel: "HR",
  sortOrder: 13,
  doneByLabel: "HR · with DM",
  editTeams: ["HR"],
  defaultStartOffsetDays: 0,
  defaultDurationDays: 21,
  minPhotos: 0,
  fields: [
    { key: "appointmentOfStaff", label: "Appointment of staff", type: "task" },
    { key: "staffRequired", label: "Staff required", type: "number", min: 0 },
    { key: "staffAppointed", label: "Staff appointed", type: "number", min: 0 },
    { key: "storeManagerName", label: "Store manager", type: "text" },
    { key: "trainingCompleted", label: "Induction training completed", type: "yesno" },
  ],
});
