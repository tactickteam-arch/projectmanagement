import type { ModuleDefinition } from "./types";

/** Shared settings of every step-6 department track: done by Sangeetha, starts once RK accepts the
 * key handover, scheduled from Day 0, and marked green by the department itself (no approval box). */
export function setupTrack(
  d: Pick<ModuleDefinition, "moduleType" | "displayName" | "shortLabel" | "sortOrder" | "doneByLabel" | "editTeams" | "defaultStartOffsetDays" | "defaultDurationDays" | "minPhotos" | "fields"> &
    Partial<Pick<ModuleDefinition, "photoTag" | "summary">>,
): ModuleDefinition {
  return {
    step: 6,
    summary: "Department track — marked green when done",
    doneBy: "SANGEETHA",
    approverTeam: null,
    approvalNote: "Department marks it green",
    requires: ["KEY_HANDOVER"],
    ...d,
  };
}
