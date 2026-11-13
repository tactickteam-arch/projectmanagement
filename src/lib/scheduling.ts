import { addDays } from "./dates";

/** Default target launch: days after key handover (spec placeholder, "Target launch 30"). */
export const DEFAULT_TARGET_LAUNCH_OFFSET_DAYS = 30;

export interface ScheduleTemplate {
  moduleType: string;
  defaultStartOffsetDays: number | null;
  defaultDurationDays: number | null;
}

export interface PlannedDates {
  moduleType: string;
  plannedStart: Date;
  plannedEnd: Date;
}

/**
 * Spec "Auto-scheduling on key handover": planned dates for each fit-out module come
 * from its default offset after the handover date (Day 0).
 * planned_end = planned_start + duration days (interpretation — see REQUIREMENTS.md Q-PLANNED-END).
 * Templates without offsets (Location, Token Advance, Key Handover) are not scheduled.
 */
export function planModulesFromHandover(handoverDate: Date, templates: readonly ScheduleTemplate[]): PlannedDates[] {
  return templates
    .filter((t) => t.defaultStartOffsetDays !== null && t.defaultDurationDays !== null)
    .map((t) => {
      const plannedStart = addDays(handoverDate, t.defaultStartOffsetDays as number);
      return {
        moduleType: t.moduleType,
        plannedStart,
        plannedEnd: addDays(plannedStart, t.defaultDurationDays as number),
      };
    });
}

export function defaultTargetLaunch(handoverDate: Date): Date {
  return addDays(handoverDate, DEFAULT_TARGET_LAUNCH_OFFSET_DAYS);
}
