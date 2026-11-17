import { brandPromoters } from "./brand-promoters";
import { financeIt } from "./finance-it";
import { hr } from "./hr";
import { interiors } from "./interiors";
import { keyHandover } from "./key-handover";
import { landlordCheck } from "./landlord-check";
import { launchPlanning } from "./launch-planning";
import { legalStatutory } from "./legal-statutory";
import { locationFiling } from "./location-filing";
import { marketing } from "./marketing";
import { stocks } from "./stocks";
import { tokenAdvance } from "./token-advance";
import { tradeLicence } from "./trade-licence";
import type { ModuleDefinition } from "./types";

export type { DoneBy, FieldDef, FieldType, ModuleDefinition } from "./types";

/**
 * Every store gets these steps, in display order (New outlet launch flow, Nov 2026):
 *   1 Location filing → 2 8-point landlord check → 3 Token advance → 5 Key received,
 *   with 4 Legal agreement and statutory running alongside 3–5,
 *   then 6 Store setup: eight department tracks in parallel,
 *   then 7 Soft launch (the store's actual launch date) once every step is done.
 */
export const MODULE_DEFINITIONS: readonly ModuleDefinition[] = [
  locationFiling,
  landlordCheck,
  tokenAdvance,
  legalStatutory,
  keyHandover,
  marketing,
  interiors,
  brandPromoters,
  hr,
  stocks,
  financeIt,
  tradeLicence,
  launchPlanning,
].sort((a, b) => a.sortOrder - b.sortOrder);

export const LOCATION_FILING = "LOCATION_FILING";
export const LANDLORD_CHECK = "LANDLORD_CHECK";
export const TOKEN_ADVANCE = "TOKEN_ADVANCE";
export const LEGAL_STATUTORY = "LEGAL_STATUTORY";
export const KEY_HANDOVER = "KEY_HANDOVER";

export const MODULE_TYPES: readonly string[] = MODULE_DEFINITIONS.map((m) => m.moduleType);

/** Steps 1–5 (before and at key handover). */
export const PRE_SETUP_TYPES: readonly string[] = MODULE_DEFINITIONS.filter((m) => m.step < 6).map((m) => m.moduleType);

/** Step 6: department tracks that run in parallel after the key handover. */
export const SETUP_TRACK_TYPES: readonly string[] = MODULE_DEFINITIONS.filter((m) => m.step === 6).map((m) => m.moduleType);

export function isSetupTrack(moduleType: string): boolean {
  return SETUP_TRACK_TYPES.includes(moduleType);
}

export function getModuleDefinition(moduleType: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find((m) => m.moduleType === moduleType);
}

/** Display order of a module type (unknown types last). */
export function moduleOrder(moduleType: string): number {
  return getModuleDefinition(moduleType)?.sortOrder ?? 999;
}

/** Short labels for compact grids and charts. */
export const MODULE_SHORT_LABELS: Record<string, string> = Object.fromEntries(MODULE_DEFINITIONS.map((m) => [m.moduleType, m.shortLabel]));
