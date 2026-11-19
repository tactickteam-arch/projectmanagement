import { eightPointTasks } from "./landlord-check";
import type { ModuleDefinition } from "./types";

// SOP stage 5 (slide 6): key handover by Sangeetha + store owner. T-7: teams formally informed,
// external sign board completed and all materials ordered. 8-point handover audit by State Admin +
// store owner. RK approves the handover; the handover date (Day 0) starts the setup clock and the
// system notifies every Stage 6 department.
export const keyHandover: ModuleDefinition = {
  moduleType: "KEY_HANDOVER",
  displayName: "Key handover",
  shortLabel: "5 Keys",
  stage: 5,
  code: "5",
  group: "gate",
  sortOrder: 8,
  summary: "8-point handover audit; sign board & materials done one week before",
  doneBy: "BOTH",
  doneByLabel: "Sangeetha + store owner",
  editTeams: ["STATE_ADMIN", "STORE_OWNER"],
  approverTeam: "RK",
  approvalNote: "Handover accepted — starts the setup clock",
  requires: ["TOKEN_ADVANCE"],
  notes: ["No key handover without the sign board completed one week before and RK sign-off (zero-exception gate)."],
  systemAction: "Day 0: the system notifies every Stage 6 department to start",
  checks: ["preKeyT7"],
  scheduleAnchor: "expectedKey",
  defaultStartOffsetDays: -7,
  defaultDurationDays: 7,
  minPhotos: 0,
  fields: [
    { key: "civilWorkComplete", label: "Landlord civil work 100% complete", type: "task", owner: "State Admin + store owner", section: "8-point handover audit" },
    ...eightPointTasks("ho_", "State Admin + store owner", "8-point handover audit"),
    { key: "handoverDate", label: "Key handover date (Day 0)", type: "date", required: true, section: "Handover" },
    { key: "keysReceivedBy", label: "Keys received by", type: "text", required: true, section: "Handover" },
    { key: "handoverPhotos", label: "Handover photos (optional)", type: "file", attachmentTag: "photo_handover", section: "Handover" },
  ],
};
