import type { ModuleDefinition } from "./types";

/** Shared settings of the on-site steps 6·2 – 6·5 (slide 7): strict sequential order after the
 * key handover, to prevent rework. Marked done by the owning team (no approval box). */
function site(d: Pick<ModuleDefinition, "moduleType" | "displayName" | "shortLabel" | "code" | "sortOrder" | "summary" | "doneByLabel" | "editTeams" | "requires" | "defaultStartOffsetDays" | "fields"> & Partial<ModuleDefinition>): ModuleDefinition {
  return {
    stage: 6,
    group: "site",
    doneBy: "SANGEETHA",
    approverTeam: null,
    approvalNote: "Strict 5-step order on site",
    scheduleAnchor: "handover",
    defaultDurationDays: 7,
    minPhotos: 0,
    ...d,
  };
}

export const siteFurniture = site({
  moduleType: "SITE_FURNITURE",
  displayName: "Furniture",
  shortLabel: "6·2 Furn.",
  code: "6·2",
  sortOrder: 9,
  summary: "Installed immediately after the key handover — phase 1 on site",
  doneByLabel: "Marketing & interior vendors",
  editTeams: ["MARKETING", "INTERIORS"],
  requires: ["KEY_HANDOVER"],
  defaultStartOffsetDays: 0,
  fields: [
    { key: "wallFixtures", label: "Store wall fixtures", type: "task" },
    { key: "displayCounters", label: "Display counters", type: "task" },
    { key: "cashCounter", label: "Cash counter", type: "task" },
    { key: "storageRacks", label: "Storage racks", type: "task" },
    { key: "brandFurniture", label: "Brand furniture", type: "task" },
    { key: "furniturePhotos", label: "Photos (optional)", type: "file", attachmentTag: "photo_furniture" },
  ],
});

export const siteElectrical = site({
  moduleType: "SITE_ELECTRICAL",
  displayName: "Electrical & IT cabling",
  shortLabel: "6·3 Elec.",
  code: "6·3",
  sortOrder: 10,
  summary: "2.5 sq mm 3-core internal wiring, DB/MCB, lighting, CCTV, LAN, APX — phase 2",
  doneByLabel: "State Admin / Interiors / IT",
  editTeams: ["STATE_ADMIN", "INTERIORS", "FINANCE_IT"],
  requires: ["SITE_FURNITURE"],
  defaultStartOffsetDays: 7,
  fields: [
    { key: "internalWiring", label: "Internal wiring — 2.5 sq mm 3-core copper", type: "task", help: "All internal lighting, counter and general power circuits (slide 8)." },
    { key: "dbMcb", label: "3-phase DB / MCB / ELCB dressing", type: "task", help: "Proper phase balancing and a dedicated MCB/ELCB per circuit (slide 8)." },
    { key: "lighting", label: "Lighting", type: "task" },
    { key: "cctv", label: "CCTV cabling", type: "task" },
    { key: "broadband", label: "Broadband cabling", type: "task" },
    { key: "lan", label: "LAN cabling", type: "task" },
    { key: "apxPoints", label: "APX point cabling", type: "task" },
    { key: "electricalPhotos", label: "Photos (optional)", type: "file", attachmentTag: "photo_electrical" },
  ],
});

export const siteAc = site({
  moduleType: "SITE_AC",
  displayName: "Air conditioning (AC)",
  shortLabel: "6·4 AC",
  code: "6·4",
  sortOrder: 11,
  summary: "4 sq mm 4-core AC cable; split < 1,000 sq ft, cassette ≥ 1,000; 1 ton / 150 sq ft — phase 3",
  doneByLabel: "State Admin / HVAC vendor",
  editTeams: ["STATE_ADMIN", "INTERIORS"],
  requires: ["SITE_ELECTRICAL"],
  checks: ["acSizing"],
  defaultStartOffsetDays: 14,
  fields: [
    { key: "acCable", label: "AC power cabling — 4 sq mm 4-core copper", type: "task", help: "All AC indoor/outdoor power feeds (slide 8)." },
    { key: "acInstalled", label: "AC units installed at the approved indoor & outdoor locations", type: "task" },
    { key: "acType", label: "AC type", type: "select", options: ["Split AC (back-to-back)", "Cassette AC"], required: true },
    { key: "acUnits", label: "No. of AC units", type: "number", min: 1, required: true },
    { key: "acTonnage", label: "Total tonnage", type: "number", unit: "ton", min: 0, required: true },
    { key: "acPhotos", label: "Photos (optional)", type: "file", attachmentTag: "photo_ac" },
  ],
});

export const siteBranding = site({
  moduleType: "SITE_BRANDING",
  displayName: "In-shop branding",
  shortLabel: "6·5 Brand.",
  code: "6·5",
  sortOrder: 12,
  summary: "After dust-free furniture, cabling & AC — phase 4",
  doneByLabel: "Marketing",
  editTeams: ["MARKETING"],
  requires: ["SITE_AC"],
  defaultStartOffsetDays: 21,
  fields: [
    { key: "wallGraphics", label: "Wall graphics", type: "task" },
    { key: "brandFascia", label: "Brand fascia", type: "task" },
    { key: "glowSigns", label: "Glow signs", type: "task" },
    { key: "promoVisuals", label: "Promotional visuals", type: "task" },
    { key: "launchCollaterals", label: "Launch collaterals", type: "task" },
    { key: "brandingPhotos", label: "Photos (optional)", type: "file", attachmentTag: "photo_branding" },
  ],
});
