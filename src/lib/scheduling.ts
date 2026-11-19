import { getModuleDefinition } from "@/modules";
import type { ScheduleAnchor } from "@/modules/types";
import { addDays } from "./dates";

/** 13-week chart (slide 10): keys in week 8, soft launch in week 13 → 5 weeks after the keys. */
export const DEFAULT_TARGET_LAUNCH_OFFSET_DAYS = 35;
/** "13-week rollout framework": before the keys, target soft launch = store created + 13 weeks. */
export const ROLLOUT_WEEKS = 13;
/** Until the MOU sheet gives the expected key date (point 11), keys are planned for week 8. */
export const DEFAULT_EXPECTED_KEY_DAY = 49;

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

export function anchorOf(moduleType: string): ScheduleAnchor {
  return getModuleDefinition(moduleType)?.scheduleAnchor ?? "handover";
}

/**
 * Planned dates of the steps counted from one anchor: planned start = anchor + offset days,
 * planned end = start + duration days. Anchors: the store record (week 1), the expected key date
 * (T-7 work, negative offsets) or the accepted key handover (Day 0).
 */
export function planFrom(anchor: ScheduleAnchor, anchorDate: Date, templates: readonly ScheduleTemplate[]): PlannedDates[] {
  return templates
    .filter((t) => anchorOf(t.moduleType) === anchor && t.defaultStartOffsetDays !== null && t.defaultDurationDays !== null)
    .map((t) => {
      const plannedStart = addDays(anchorDate, t.defaultStartOffsetDays as number);
      return { moduleType: t.moduleType, plannedStart, plannedEnd: addDays(plannedStart, t.defaultDurationDays as number) };
    });
}

/** Steps scheduled from the key handover (Day 0): on-site work, department tracks, soft launch. */
export function planModulesFromHandover(handoverDate: Date, templates: readonly ScheduleTemplate[]): PlannedDates[] {
  return planFrom("handover", handoverDate, templates);
}

export function defaultTargetLaunch(handoverDate: Date, offsetDays = DEFAULT_TARGET_LAUNCH_OFFSET_DAYS): Date {
  return addDays(handoverDate, offsetDays);
}

/** Expected keys before the MOU sheet gives a date: created + 7 weeks (week 8). */
export function defaultExpectedKey(created: Date): Date {
  return addDays(created, DEFAULT_EXPECTED_KEY_DAY);
}

/** Target soft launch before the keys: created + 13 weeks. */
export function rolloutTarget(created: Date): Date {
  return addDays(created, ROLLOUT_WEEKS * 7);
}
