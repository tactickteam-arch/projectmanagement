import { keyHandover } from "./key-handover";
import { landlordCheck } from "./landlord-check";
import { legalStatutory } from "./legal-statutory";
import { locationFiling } from "./location-filing";
import { interiorsQuote, materialOrdering, signBoard } from "./pre-key";
import { siteAc, siteBranding, siteElectrical, siteFurniture } from "./site-work";
import { softLaunch } from "./soft-launch";
import { tokenAdvance } from "./token-advance";
import { DEPARTMENT_TRACKS } from "./tracks";
import type { ModuleDefinition, StepGroup } from "./types";

export type { AfterAction, DoneBy, FieldDef, FieldType, ModuleDefinition, ScheduleAnchor, SopCheck, StepGroup, StoreSource } from "./types";

/**
 * Every store gets these steps (New Outlet Launch SOP v2):
 *   1 Location filing → 2 8-point landlord check → 3 Token advance → 5 Key handover,
 *   4 Legal & statutory alongside 3–5,
 *   before the keys (T-7): interiors quotation, 6·1 external sign board, material ordering,
 *   6 Store setup: on site in strict order 6·2 Furniture → 6·3 Electrical & IT → 6·4 AC →
 *     6·5 In-shop branding, and the eight department tracks, each marked green,
 *   7 Soft launch once every department is green.
 */
export const MODULE_DEFINITIONS: readonly ModuleDefinition[] = [
  locationFiling,
  landlordCheck,
  tokenAdvance,
  legalStatutory,
  interiorsQuote,
  signBoard,
  materialOrdering,
  keyHandover,
  siteFurniture,
  siteElectrical,
  siteAc,
  siteBranding,
  ...DEPARTMENT_TRACKS,
  softLaunch,
].sort((a, b) => a.sortOrder - b.sortOrder);

export const LOCATION_FILING = "LOCATION_FILING";
export const LANDLORD_CHECK = "LANDLORD_CHECK";
export const TOKEN_ADVANCE = "TOKEN_ADVANCE";
export const LEGAL_STATUTORY = "LEGAL_STATUTORY";
export const INTERIORS_QUOTE = "INTERIORS_QUOTE";
export const SIGN_BOARD = "SIGN_BOARD";
export const MATERIAL_ORDERING = "MATERIAL_ORDERING";
export const KEY_HANDOVER = "KEY_HANDOVER";
export const SOFT_LAUNCH = "SOFT_LAUNCH";

export const MODULE_TYPES: readonly string[] = MODULE_DEFINITIONS.map((m) => m.moduleType);

const ofGroup = (...g: StepGroup[]) => MODULE_DEFINITIONS.filter((m) => g.includes(m.group)).map((m) => m.moduleType);

/** Stage 6 on-site work after the keys, in strict order (6·2 – 6·5). */
export const SITE_TYPES: readonly string[] = ofGroup("site");
/** Stage 6 department tracks (slide 9), each marked green. */
export const SETUP_TRACK_TYPES: readonly string[] = ofGroup("track");
/** Before the keys: the quotation, and the T-7 work. */
export const PRE_KEY_TYPES: readonly string[] = ofGroup("prekey");
/** Scheduled from Day 0; their teams are notified when RK accepts the keys. */
export const AFTER_KEY_TYPES: readonly string[] = MODULE_DEFINITIONS.filter((m) => m.scheduleAnchor === "handover").map((m) => m.moduleType);

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

/** Columns of the dashboard grid: one per SOP stage (stage 6 split into on-site work and tracks). */
export const STAGE_COLUMNS: readonly { key: string; label: string; title: string; types: readonly string[] }[] = [
  { key: "1", label: "1 Location", title: "1 · Location filing (Boss + CEO)", types: [LOCATION_FILING] },
  { key: "2", label: "2 Landlord", title: "2 · 8-point landlord check (RK)", types: [LANDLORD_CHECK] },
  { key: "3", label: "3 Token", title: "3 · Token advance (Accounts, HO payment, APX PO)", types: [TOKEN_ADVANCE] },
  { key: "4", label: "4 Legal", title: "4 · Legal & statutory (parallel to 3–5)", types: [LEGAL_STATUTORY] },
  { key: "T7", label: "T-7", title: "Before keys: quotation, 6·1 sign board, materials", types: PRE_KEY_TYPES },
  { key: "5", label: "5 Keys", title: "5 · Key handover (RK)", types: [KEY_HANDOVER] },
  { key: "6S", label: "6 On site", title: "6 · On-site work 6·2 – 6·5", types: SITE_TYPES },
  { key: "6D", label: "6 Depts", title: "6 · Department tracks", types: SETUP_TRACK_TYPES },
  { key: "7", label: "7 Launch", title: "7 · Soft launch", types: [SOFT_LAUNCH] },
];
