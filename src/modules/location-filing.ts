import { PATTERNS, SUPPLY_OPTIONS } from "@/lib/sop-rules";
import type { FieldDef, ModuleDefinition } from "./types";

const A = "A · Site & commercial (Sr. 1–14)";
const B = "B · Civil, sales & team (Sr. 15–28)";
const C = "C · Landlord KYC & statutory (Sr. 29–41)";

/** SOP slide 3: the 41-point MOU & site filing format (single master sheet). Every point is
 * mandatory for HO approval except those marked "(if applicable)". */
const SHEET: FieldDef[] = [
  { sr: 1, section: A, key: "branchName", label: "Branch name", type: "text", fromStore: "name" },
  { sr: 2, section: A, key: "branchCode", label: "Branch code", type: "text", fromStore: "storeCode" },
  { sr: 3, section: A, key: "branchEmail", label: "Branch email ID", type: "email", required: true },
  { sr: 4, section: A, key: "branchState", label: "Branch state", type: "text", fromStore: "state" },
  { sr: 5, section: A, key: "storeAddress", label: "Store address", type: "longtext", fromStore: "address" },
  { sr: 6, section: A, key: "storeSizeSqft", label: "Store size", type: "number", unit: "sq ft", fromStore: "carpetAreaSqft" },
  { sr: 7, section: A, key: "frontageSizeFt", label: "Store frontage size", type: "number", unit: "ft", min: 0, required: true },
  { sr: 8, section: A, key: "advanceAgreementTerms", label: "Advance & agreement terms", type: "longtext", required: true, help: "Token advance, security deposit, lock-in, tenure, yearly escalation." },
  { sr: 9, section: A, key: "monthlyRent", label: "Monthly rent", type: "currency", min: 0, required: true },
  { sr: 10, section: A, key: "rentFreePeriod", label: "Rent-free period", type: "text", required: true, help: "e.g. 45 days" },
  { sr: 11, section: A, key: "keyHandoverDate", label: "Key handover date (expected)", type: "date", required: true, help: "The T-7 work (sign board, material ordering) is planned back from this date." },
  { sr: 12, section: A, key: "statutoryAddress", label: "Store address (statutory)", type: "longtext", required: true, help: "Address as it will appear on the licences and GST registration." },
  { sr: 13, section: A, key: "previousShopDetails", label: "Previous shop details", type: "longtext", required: true },
  { sr: 14, section: A, key: "civilWorkRequired", label: "Any civil work required", type: "yesno", required: true },
  { section: A, key: "civilWorkRequiredDetails", label: "Civil work required — details", type: "longtext", required: true, showWhen: { key: "civilWorkRequired", equals: true } },

  { sr: 15, section: B, key: "civilWorkByLandlord", label: "Any civil work by landlord", type: "yesno", required: true },
  { section: B, key: "civilWorkByLandlordDetails", label: "Civil work by landlord — details", type: "longtext", required: true, showWhen: { key: "civilWorkByLandlord", equals: true } },
  { sr: 16, section: B, key: "shutterCondition", label: "Shutter condition", type: "select", options: ["Good", "Needs servicing", "Needs replacement"], required: true },
  { sr: 17, section: B, key: "shutterCentreLock", label: "Shutter centre lock status", type: "select", options: ["Installed & working", "Not working", "Not installed"], required: true },
  { sr: 18, section: B, key: "numberOfShutters", label: "No. of shutters", type: "number", min: 0, required: true },
  { sr: 19, section: B, key: "locationFinalisedBy", label: "Location finalised by", type: "text", required: true },
  { sr: 20, section: B, key: "brandingPermission", label: "Permission for branding", type: "yesno", required: true, help: "Landlord permits the external sign board and branding." },
  { sr: 21, section: B, key: "monthlySaleExpectation", label: "Sale expectation (monthly)", type: "currency", min: 0, required: true },
  { sr: 22, section: B, key: "accessoriesSaleExpectation", label: "Accessories sale expectation (monthly)", type: "currency", min: 0, required: true },
  { sr: 23, section: B, key: "salesHeadName", label: "Sales head name", type: "text", required: true },
  { sr: 24, section: B, key: "storeLead", label: "Name / contact (store lead)", type: "text", required: true },
  { sr: 25, section: B, key: "adminTeamContact", label: "Admin team contact", type: "text", required: true },
  { sr: 26, section: B, key: "landlordName", label: "Landlord name", type: "text", required: true },
  { sr: 27, section: B, key: "landlordAddress", label: "Landlord address", type: "longtext", required: true },
  { sr: 28, section: B, key: "landlordPhone1", label: "Landlord contact no. 1", type: "phone", pattern: PATTERNS.PHONE, required: true },

  { sr: 29, section: C, key: "landlordPhone2", label: "Landlord contact no. 2", type: "phone", pattern: PATTERNS.PHONE, required: true },
  { sr: 30, section: C, key: "landlordEmail", label: "Landlord mail ID", type: "email", required: true },
  { sr: 31, section: C, key: "landlordPan", label: "PAN no. of landlord", type: "text", pattern: PATTERNS.PAN, sensitive: true, required: true },
  { sr: 32, section: C, key: "landlordAadhaar", label: "Aadhaar card no. of landlord", type: "aadhaar", sensitive: true, required: true, help: "Only the last 4 digits are kept." },
  { sr: 33, section: C, key: "bankName", label: "Bank name", type: "text", sensitive: true, required: true },
  { sr: 34, section: C, key: "bankAccount", label: "Bank a/c no.", type: "text", pattern: PATTERNS.ACCOUNT, sensitive: true, required: true },
  { sr: 35, section: C, key: "ifsc", label: "IFSC code", type: "text", pattern: PATTERNS.IFSC, sensitive: true, required: true },
  { sr: 36, section: C, key: "mouCopy", label: "MOU copy (if applicable)", type: "file", attachmentTag: "mou_copy" },
  { sr: 37, section: C, key: "gstNumber", label: "GST no. (if applicable)", type: "text", pattern: PATTERNS.GSTIN },
  { sr: 38, section: C, key: "propertyTaxReceipt", label: "Property tax receipt", type: "file", attachmentTag: "property_tax", required: true },
  { sr: 39, section: C, key: "buildingPlan", label: "Building plan (sanctioned)", type: "file", attachmentTag: "building_plan", required: true },
  { sr: 40, section: C, key: "civilWorkDays", label: "Required days for civil work", type: "number", unit: "days", min: 0, required: true },
  { sr: 41, section: C, key: "powerCapacityKw", label: "Power capacity (sanctioned)", type: "number", unit: "kW", min: 0, required: true, help: "Must meet the slide 4 table for the store size." },
  { section: C, key: "powerSupply", label: "Power supply type", type: "select", options: SUPPLY_OPTIONS, required: true, help: "3-phase only — single-phase is not accepted." },
];

// SOP stage 1 (slides 2, 3, 10): site proposal + 41-point MOU sheet, approved by Boss + CEO (HO).
export const locationFiling: ModuleDefinition = {
  moduleType: "LOCATION_FILING",
  displayName: "Location filing",
  shortLabel: "1 Location",
  stage: 1,
  code: "1",
  group: "gate",
  sortOrder: 1,
  summary: "Site proposal + 41-point MOU sheet",
  doneBy: "BOTH",
  doneByLabel: "Store owner / ASM / SH / BH / State Admin",
  editTeams: ["STORE_OWNER", "ASM", "SALES", "BH", "STATE_ADMIN"],
  approverTeam: "LEADERSHIP",
  approvalNote: "Approval by Boss + CEO (HO)",
  requires: [],
  notes: ["Golden rule 1: complete the 41-point MOU sheet and verify the 3-phase kW load before leadership approval."],
  systemAction: "On approval the system intimates the internal teams",
  checks: ["powerLoad"],
  scheduleAnchor: "created",
  defaultStartOffsetDays: 0,
  defaultDurationDays: 21,
  minPhotos: 0,
  fields: [
    { key: "locationIdentified", label: "Location identification & finalisation", type: "task", owner: "ASM / SH / BH" },
    { key: "proposalToLeadership", label: "Commercial terms & proposal to leadership", type: "task", owner: "State Admin / SH" },
    ...SHEET,
    { key: "sitePhotos", label: "Site photos (optional)", type: "file", attachmentTag: "photo_site" },
  ],
};
