import { airConditioning } from "./air-conditioning";
import { electricalItWiring } from "./electrical-it-wiring";
import { externalSignage } from "./external-signage";
import { inshopBranding } from "./inshop-branding";
import { itWorks } from "./it-works";
import { keyHandover } from "./key-handover";
import { storeLocation } from "./store-location";
import { tokenAdvance } from "./token-advance";
import type { ModuleDefinition } from "./types";

export type { FieldDef, FieldType, ModuleDefinition } from "./types";

/**
 * Every store gets these, in display order: 7 setup modules + the Key Handover milestone.
 * The spec says "8 modules" but names 7 modules and calls Key Handover "a milestone, not a
 * full module" — see OPEN_QUESTIONS.md Q1. The milestone is excluded from progress,
 * approvals and "Ready for Launch".
 */
export const MODULE_DEFINITIONS: readonly ModuleDefinition[] = [
  storeLocation,
  tokenAdvance,
  keyHandover,
  externalSignage,
  electricalItWiring,
  airConditioning,
  itWorks,
  inshopBranding,
].sort((a, b) => a.sortOrder - b.sortOrder);

export const KEY_HANDOVER = "KEY_HANDOVER";
export const STORE_LOCATION = "STORE_LOCATION";
export const TOKEN_ADVANCE = "TOKEN_ADVANCE";

export const MILESTONE_TYPES: readonly string[] = MODULE_DEFINITIONS.filter((m) => m.phase === "milestone").map(
  (m) => m.moduleType,
);

/** The 7 setup modules that count toward progress and need HQ approval. */
export const SETUP_MODULE_TYPES: readonly string[] = MODULE_DEFINITIONS.filter((m) => m.phase !== "milestone").map(
  (m) => m.moduleType,
);

export const FITOUT_MODULE_TYPES: readonly string[] = MODULE_DEFINITIONS.filter((m) => m.phase === "fitout").map(
  (m) => m.moduleType,
);

export function isMilestone(moduleType: string): boolean {
  return MILESTONE_TYPES.includes(moduleType);
}

export function isFitout(moduleType: string): boolean {
  return FITOUT_MODULE_TYPES.includes(moduleType);
}

export function getModuleDefinition(moduleType: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find((m) => m.moduleType === moduleType);
}

/** Short labels for compact grids. */
export const MODULE_SHORT_LABELS: Record<string, string> = {
  STORE_LOCATION: "Location",
  TOKEN_ADVANCE: "Token",
  KEY_HANDOVER: "Keys",
  EXTERNAL_SIGNAGE: "Signage",
  ELECTRICAL_IT_WIRING: "Electrical",
  AIR_CONDITIONING: "AC",
  IT_WORKS: "IT",
  INSHOP_BRANDING: "Branding",
};
