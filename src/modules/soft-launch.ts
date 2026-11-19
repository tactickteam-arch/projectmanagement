import { DEPARTMENT_TRACKS } from "./tracks";
import type { ModuleDefinition } from "./types";

const AUDIT = "Pre-launch technical audit";
const OPS = "Operational readiness";
const RUN = "Soft launch execution";

// SOP stage 7 (slide 11): authorised ONLY when every Stage 6 track is GREEN. Final readiness audit
// and launch execution. State Admin & ASM drive ground execution.
export const softLaunch: ModuleDefinition = {
  moduleType: "SOFT_LAUNCH",
  displayName: "Soft launch",
  shortLabel: "7 Launch",
  stage: 7,
  code: "7",
  group: "launch",
  sortOrder: 21,
  summary: "All tracks verified green; readiness audit & launch execution",
  doneBy: "SANGEETHA",
  doneByLabel: "All departments + Ops (State Admin / ASM)",
  editTeams: ["STATE_ADMIN", "ASM"],
  approverTeam: null,
  approvalNote: "Gate: all departments green",
  requires: DEPARTMENT_TRACKS.map((t) => t.moduleType),
  systemAction: "Marking it done records the store's soft launch date",
  scheduleAnchor: "handover",
  defaultStartOffsetDays: 35,
  defaultDurationDays: 0,
  minPhotos: 0,
  fields: [
    { key: "auditPowerLoad", label: "3-phase kW load stable", type: "task", section: AUDIT },
    { key: "auditInternalCircuits", label: "2.5 sq mm 3-core internal circuits", type: "task", section: AUDIT },
    { key: "auditAcLines", label: "4 sq mm 4-core AC lines", type: "task", section: AUDIT },
    { key: "auditCooling", label: "HVAC cooling (1 ton / 150 sq ft)", type: "task", section: AUDIT },
    { key: "auditSignBoard", label: "Sign board completed", type: "task", section: AUDIT },
    { key: "opsApx", label: "APX billing live", type: "task", section: OPS },
    { key: "opsNbfc", label: "NBFC finance tie-ups active", type: "task", section: OPS },
    { key: "opsStock", label: "Stock inwarded", type: "task", section: OPS },
    { key: "opsStaff", label: "Trained staff + brand promoters deployed", type: "task", section: OPS },
    { key: "launchOps", label: "Soft launch operations executed", type: "task", section: RUN },
    { key: "customerOutreach", label: "Customer outreach done", type: "task", section: RUN },
    { key: "softLaunchDate", label: "Soft launch date", type: "date", required: true, section: RUN },
    { key: "day1Sales", label: "Day-1 sales", type: "currency", min: 0, required: true, section: RUN },
    { key: "launchPhotos", label: "Launch photos (optional)", type: "file", attachmentTag: "photo_launch", section: RUN },
  ],
};
