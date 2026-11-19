import type { ModuleDefinition } from "./types";

/** Shared settings of the 8 department tracks (slide 9): each department owns its track after the
 * key handover and marks it GREEN on completion. Scheduled from Day 0 (13-week chart, slide 10). */
function track(d: Pick<ModuleDefinition, "moduleType" | "displayName" | "shortLabel" | "sortOrder" | "doneByLabel" | "editTeams" | "approvalNote" | "defaultStartOffsetDays" | "defaultDurationDays" | "fields"> & Partial<ModuleDefinition>): ModuleDefinition {
  return {
    stage: 6,
    code: "6",
    group: "track",
    summary: "Department track — marked green on completion",
    doneBy: "SANGEETHA",
    approverTeam: null,
    requires: ["KEY_HANDOVER"],
    scheduleAnchor: "handover",
    minPhotos: 0,
    ...d,
  };
}

export const marketingTrack = track({
  moduleType: "MARKETING",
  displayName: "Marketing",
  shortLabel: "Mktg",
  sortOrder: 13,
  doneByLabel: "Marketing (support: ASM)",
  editTeams: ["MARKETING"],
  supportTeams: ["ASM"],
  approvalNote: "Marketing green",
  completeAfter: ["SIGN_BOARD", "SITE_BRANDING"],
  defaultStartOffsetDays: 0,
  defaultDurationDays: 35,
  fields: [
    { key: "launchCampaign", label: "Launch campaign", type: "task" },
    { key: "collaterals", label: "Collaterals", type: "task" },
    { key: "guestFinalisation", label: "Guest finalisation", type: "task" },
    { key: "launchGuest", label: "Launch guest", type: "text", required: true },
  ],
});

export const interiorsTrack = track({
  moduleType: "INTERIORS",
  displayName: "Interiors",
  shortLabel: "Interiors",
  sortOrder: 14,
  doneByLabel: "State Admin → HO → Marketing",
  editTeams: ["STATE_ADMIN", "INTERIORS"],
  supportTeams: ["MARKETING"],
  approvalNote: "Interiors green",
  completeAfter: ["INTERIORS_QUOTE", "MATERIAL_ORDERING", "SITE_FURNITURE", "SITE_ELECTRICAL", "SITE_AC"],
  defaultStartOffsetDays: 0,
  defaultDurationDays: 28,
  fields: [{ key: "poTracking", label: "PO tracking — all interior POs delivered & closed", type: "task" }],
});

export const brandPromotersTrack = track({
  moduleType: "BRAND_PROMOTERS",
  displayName: "Brand promoters",
  shortLabel: "Brands",
  sortOrder: 15,
  doneByLabel: "Brand managers (support: SH)",
  editTeams: ["BRAND_MANAGERS"],
  supportTeams: ["SALES"],
  approvalNote: "Brands green",
  defaultStartOffsetDays: 0,
  defaultDurationDays: 35,
  fields: [
    { key: "oemIntimation", label: "Intimation to OEM brands", type: "task" },
    { key: "demoFixtures", label: "Brand demo fixtures installed", type: "task" },
    { key: "promoterDeployment", label: "Promoters deployed", type: "task" },
    { key: "brandLaunchSupport", label: "Brand launch support confirmed", type: "task" },
    { key: "brands", label: "Brands", type: "multiselect", options: ["Apple", "Samsung", "Vivo", "Oppo", "Xiaomi", "OnePlus", "Realme", "Motorola"], allowOther: true, required: true },
    { key: "promoterCount", label: "No. of promoters", type: "number", min: 0, required: true },
  ],
});

export const hrTrack = track({
  moduleType: "HR",
  displayName: "Human resources",
  shortLabel: "HR",
  sortOrder: 16,
  doneByLabel: "HR with DM (support: ASM)",
  editTeams: ["HR"],
  supportTeams: ["ASM"],
  approvalNote: "HR green",
  defaultStartOffsetDays: 0,
  defaultDurationDays: 21,
  fields: [
    { key: "storeManager", label: "Store manager recruited", type: "task" },
    { key: "salesExecutives", label: "Sales executives recruited", type: "task" },
    { key: "supportStaff", label: "Support staff recruited", type: "task" },
    { key: "onboarding", label: "Onboarding & appointment done", type: "task" },
    { key: "storeManagerName", label: "Store manager name", type: "text", required: true },
    { key: "staffCount", label: "Total staff", type: "number", min: 0, required: true },
  ],
});

export const stocksTrack = track({
  moduleType: "STOCKS",
  displayName: "Stocks & supply",
  shortLabel: "Stocks",
  sortOrder: 17,
  doneByLabel: "Purchase / e-Com (CXO)",
  editTeams: ["PURCHASE"],
  approvalNote: "Stocks green",
  defaultStartOffsetDays: 7,
  defaultDurationDays: 28,
  fields: [
    { key: "handsetOrder", label: "Initial handset assortment ordered", type: "task" },
    { key: "accessoriesOrder", label: "Accessories assortment ordered", type: "task" },
    { key: "dispatchTracking", label: "Dispatch tracked", type: "task" },
    { key: "stockArrival", label: "Physical stock arrived at the store", type: "task" },
    { key: "stockValue", label: "Opening stock value", type: "currency", min: 0, required: true },
    { key: "stockArrivedOn", label: "Stock arrived on", type: "date", required: true },
  ],
});

export const financeItTrack = track({
  moduleType: "FINANCE_IT",
  displayName: "Finance & IT",
  shortLabel: "Fin & IT",
  sortOrder: 18,
  doneByLabel: "Consumer finance / IT / Admin",
  editTeams: ["FINANCE_IT"],
  approvalNote: "Finance & IT green",
  defaultStartOffsetDays: 0,
  defaultDurationDays: 28,
  fields: [
    { key: "nbfcIntimation", label: "Intimation to NBFC finance companies", type: "task" },
    { key: "broadband", label: "Broadband connection", type: "task" },
    { key: "cctv", label: "CCTV connection", type: "task" },
    { key: "cugMobiles", label: "CUG mobile connections", type: "task" },
    { key: "decoration", label: "Decoration", type: "task" },
    { key: "stationery", label: "Stationery", type: "task" },
    { key: "apxBilling", label: "APX billing setup", type: "task" },
    { key: "nbfcPartners", label: "NBFC partners", type: "multiselect", options: ["Bajaj Finserv", "HDB Financial", "TVS Credit", "Home Credit", "IDFC First"], allowOther: true, required: true },
  ],
});

export const tradeLicenceTrack = track({
  moduleType: "TRADE_LICENCE",
  displayName: "Trade licence",
  shortLabel: "Licence",
  sortOrder: 19,
  doneByLabel: "Legal (support: State Admin)",
  editTeams: ["LEGAL"],
  supportTeams: ["STATE_ADMIN"],
  approvalNote: "Legal green",
  defaultStartOffsetDays: 0,
  defaultDurationDays: 28,
  fields: [
    { key: "municipalTradeLicence", label: "Final municipal trade licence obtained", type: "task" },
    { key: "seCertificate", label: "S&E certificate obtained", type: "task" },
    { key: "labourCompliance", label: "Labour compliance certificates obtained", type: "task" },
    { key: "displayed", label: "Certificates displayed at the store", type: "task" },
    { key: "displayPhotos", label: "Photo of the displayed certificates (optional)", type: "file", attachmentTag: "photo_licences" },
  ],
});

export const launchPlanningTrack = track({
  moduleType: "LAUNCH_PLANNING",
  displayName: "Launch planning",
  shortLabel: "Launch plan",
  sortOrder: 20,
  doneByLabel: "SH / SL (support: BH / ASM)",
  editTeams: ["SALES"],
  supportTeams: ["BH", "ASM"],
  approvalNote: "Launch plan green",
  defaultStartOffsetDays: 7,
  defaultDurationDays: 28,
  fields: [
    { key: "launchDateFinal", label: "Launch date finalised", type: "task" },
    { key: "launchOffers", label: "Launch offers finalised", type: "task" },
    { key: "salesTargets", label: "Store sales targets set", type: "task" },
    { key: "dataMining", label: "Local customer data mining calls", type: "task" },
    { key: "plannedLaunchDate", label: "Planned soft launch date", type: "date", required: true },
    { key: "monthlySalesTarget", label: "Monthly sales target", type: "currency", min: 0, required: true },
  ],
});

/** Slide 9 order. */
export const DEPARTMENT_TRACKS: readonly ModuleDefinition[] = [
  marketingTrack,
  interiorsTrack,
  brandPromotersTrack,
  hrTrack,
  stocksTrack,
  financeItTrack,
  tradeLicenceTrack,
  launchPlanningTrack,
];
