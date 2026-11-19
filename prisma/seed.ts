/**
 * Development / demo seed: fictional sample stores in different Indian states, each at a different
 * point of the New Outlet Launch SOP v2, plus one demo user per Sangeetha team, so every view can
 * be tried. Everything is clearly labelled "Demo"; people use the reserved .test e-mail domain.
 * Not Sangeetha business data.
 *
 * Re-running is safe: it removes previous demo stores (owned by *@sangeetha.test users) and their
 * files, then recreates them relative to today's date.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { ApprovalStatus, ModuleStatus, Prisma } from "../src/generated/prisma/client";
import { addDays, formatDateOnly, todayInIndia } from "../src/lib/dates";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { defaultExpectedKey, planFrom, rolloutTarget } from "../src/lib/scheduling";
import { acRequirement, requiredLoadKw, THREE_PHASE } from "../src/lib/sop-rules";
import { computeOverallStatus } from "../src/lib/status";
import { syncSteps } from "../src/lib/steps-sync";
import { teamLabel } from "../src/lib/teams";
import { getModuleDefinition } from "../src/modules";
import type { FieldDef } from "../src/modules/types";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data with NODE_ENV=production");
const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword || seedPassword.length < 8) throw new Error("SEED_PASSWORD must be set in .env (at least 8 characters)");

const prisma = createPrismaClient();
const today = todayInIndia();
const d = (days: number) => addDays(today, days);
const ymd = (x: Date) => formatDateOnly(x);
const ago = (days: number, hour = 11) => new Date(addDays(today, days).getTime() + (hour - 5.5) * 3600_000);

// ---------- people ----------
type Role = "SUPER_ADMIN" | "REGIONAL_MANAGER" | "STORE_OWNER" | "TEAM_MEMBER";
const USERS: { key: string; email: string; name: string; role: Role; regionStates: string[]; teams: string[] }[] = [
  { key: "hq", email: "hq.admin@sangeetha.test", name: "HQ Admin (demo)", role: "SUPER_ADMIN", regionStates: [], teams: [] },
  { key: "rm", email: "rm.south@sangeetha.test", name: "Kavya Nair (demo Regional Manager)", role: "REGIONAL_MANAGER", regionStates: ["KA", "KL", "TN", "TG"], teams: [] },
  { key: "arjun", email: "owner.arjun@sangeetha.test", name: "Arjun Rao (demo)", role: "STORE_OWNER", regionStates: [], teams: [] },
  { key: "meera", email: "owner.meera@sangeetha.test", name: "Meera Iyer (demo)", role: "STORE_OWNER", regionStates: [], teams: [] },
  { key: "rahul", email: "owner.rahul@sangeetha.test", name: "Rahul Deshmukh (demo)", role: "STORE_OWNER", regionStates: [], teams: [] },
  { key: "fatima", email: "owner.fatima@sangeetha.test", name: "Fatima Shaikh (demo)", role: "STORE_OWNER", regionStates: [], teams: [] },
  { key: "leadership", email: "leadership@sangeetha.test", name: "Leadership — Boss + CEO (demo)", role: "TEAM_MEMBER", regionStates: [], teams: ["LEADERSHIP"] },
  { key: "rk", email: "rk@sangeetha.test", name: "RK (demo)", role: "TEAM_MEMBER", regionStates: [], teams: ["RK"] },
  { key: "accounts", email: "accounts@sangeetha.test", name: "Priya Menon (demo Accounts)", role: "TEAM_MEMBER", regionStates: [], teams: ["ACCOUNTS"] },
  { key: "ho", email: "ho@sangeetha.test", name: "Ramesh Gupta (demo Head office)", role: "TEAM_MEMBER", regionStates: [], teams: ["HO"] },
  { key: "legal", email: "legal@sangeetha.test", name: "Suresh Babu (demo Legal & Tax)", role: "TEAM_MEMBER", regionStates: [], teams: ["LEGAL", "TAX"] },
  { key: "stateadmin", email: "stateadmin@sangeetha.test", name: "Naveen Kumar (demo State Admin)", role: "TEAM_MEMBER", regionStates: [], teams: ["STATE_ADMIN"] },
  { key: "asm", email: "asm@sangeetha.test", name: "Sanjay Pillai (demo ASM)", role: "TEAM_MEMBER", regionStates: [], teams: ["ASM"] },
  { key: "bh", email: "bh@sangeetha.test", name: "Anil Kapoor (demo Business head)", role: "TEAM_MEMBER", regionStates: [], teams: ["BH"] },
  { key: "sales", email: "sales@sangeetha.test", name: "Vikram Hegde (demo SH · SL)", role: "TEAM_MEMBER", regionStates: [], teams: ["SALES"] },
  { key: "marketing", email: "marketing@sangeetha.test", name: "Anita Shetty (demo Marketing)", role: "TEAM_MEMBER", regionStates: [], teams: ["MARKETING"] },
  { key: "interiors", email: "interiors@sangeetha.test", name: "Ravi Teja (demo Interiors)", role: "TEAM_MEMBER", regionStates: [], teams: ["INTERIORS"] },
  { key: "brands", email: "brands@sangeetha.test", name: "Deepa Rao (demo Brand managers)", role: "TEAM_MEMBER", regionStates: [], teams: ["BRAND_MANAGERS"] },
  { key: "hr", email: "hr@sangeetha.test", name: "Farhan Ali (demo HR)", role: "TEAM_MEMBER", regionStates: [], teams: ["HR"] },
  { key: "purchase", email: "purchase@sangeetha.test", name: "Gopal Krishnan (demo Purchase · e-Com)", role: "TEAM_MEMBER", regionStates: [], teams: ["PURCHASE"] },
  { key: "finit", email: "finance.it@sangeetha.test", name: "Lakshmi Das (demo Finance · IT · Admin)", role: "TEAM_MEMBER", regionStates: [], teams: ["FINANCE_IT"] },
];
type UserKey = string;

/** Demo user who works on each step ("owner" = the store owner) and who approves it. */
const EDITOR: Record<string, UserKey> = {
  LOCATION_FILING: "owner", LANDLORD_CHECK: "stateadmin", TOKEN_ADVANCE: "legal", LEGAL_STATUTORY: "legal", INTERIORS_QUOTE: "interiors",
  SIGN_BOARD: "marketing", MATERIAL_ORDERING: "interiors", KEY_HANDOVER: "stateadmin", SITE_FURNITURE: "interiors", SITE_ELECTRICAL: "interiors",
  SITE_AC: "interiors", SITE_BRANDING: "marketing", MARKETING: "marketing", INTERIORS: "interiors", BRAND_PROMOTERS: "brands", HR: "hr",
  STOCKS: "purchase", FINANCE_IT: "finit", TRADE_LICENCE: "legal", LAUNCH_PLANNING: "sales", SOFT_LAUNCH: "stateadmin",
};
const APPROVER: Record<string, UserKey> = { LOCATION_FILING: "leadership", LANDLORD_CHECK: "rk", TOKEN_ADVANCE: "accounts", INTERIORS_QUOTE: "leadership", KEY_HANDOVER: "rk" };

// ---------- step seeds ----------
type ModuleSeed = {
  status: ModuleStatus;
  approvalStatus?: ApprovalStatus;
  approvalComment?: string;
  blockerReason?: string;
  actualStart?: Date;
  actualEnd?: Date;
  vendorName?: string;
  estCost?: number;
  actualCost?: number;
  details?: Record<string, unknown>;
  /** Fill every required field and tick every point with demo values (default for Completed steps). */
  full?: boolean;
  /** Tick these points only (in-progress steps). */
  ticked?: string[];
  completedDaysAgo?: number;
  /** Token advance: HO payment and APX PO recorded. */
  paid?: boolean;
  apx?: boolean;
  comments?: { by: UserKey; text: string; daysAgo: number }[];
};
const done = (x: Omit<ModuleSeed, "status"> = {}): ModuleSeed => ({ status: "COMPLETED", approvalStatus: "APPROVED", full: true, ...x });
const pending = (x: Omit<ModuleSeed, "status" | "approvalStatus"> = {}): ModuleSeed => ({ status: "COMPLETED", approvalStatus: "PENDING", full: true, ...x });
const working = (x: Omit<ModuleSeed, "status"> = {}): ModuleSeed => ({ status: "IN_PROGRESS", ...x });

interface Ctx {
  store: StoreSeed;
  handover: Date | null;
  expected: Date;
}

/** Demo values for every required field of a step (valid for the SOP checks). */
function demoValues(moduleType: string, c: Ctx): Record<string, unknown> {
  const area = c.store.carpetAreaSqft;
  const keys = ymd(c.handover ?? c.expected);
  switch (moduleType) {
    case "LOCATION_FILING":
      return {
        branchEmail: `${c.store.code.toLowerCase()}@sangeetha.test`, frontageSizeFt: 22, advanceAgreementTerms: "Token ₹2,00,000 · deposit 10 months · lock-in 3 years · tenure 9 years · 5% yearly escalation (demo)",
        monthlyRent: c.store.rent, rentFreePeriod: "45 days", keyHandoverDate: keys, statutoryAddress: `Demo address, ${c.store.area}, ${c.store.city} ${c.store.pincode}`,
        previousShopDetails: "Garment showroom (demo)", civilWorkRequired: true, civilWorkRequiredDetails: "False ceiling and toilet repair (demo)", civilWorkByLandlord: true,
        civilWorkByLandlordDetails: "3-phase line, painting, shutter work as per the 8 points (demo)", shutterCondition: "Needs servicing", shutterCentreLock: "Installed & working",
        numberOfShutters: 2, locationFinalisedBy: "ASM + SH (demo)", brandingPermission: true, monthlySaleExpectation: 6_000_000, accessoriesSaleExpectation: 600_000,
        salesHeadName: "Vikram Hegde (demo)", storeLead: "Demo lead · 9876500001", adminTeamContact: "Naveen Kumar (demo) · 9876500002", landlordName: "Demo Landlord",
        landlordAddress: `Demo landlord address, ${c.store.city}`, landlordPhone1: "9876543210", landlordPhone2: "9876543211", landlordEmail: "landlord@sangeetha.test",
        landlordPan: "AAKPR4567Q", landlordAadhaar: "XXXX XXXX 4321", bankName: "Demo Bank", bankAccount: "123456789012", ifsc: "HDFC0001234", gstNumber: null,
        civilWorkDays: 30, powerCapacityKw: requiredLoadKw(area).kw, powerSupply: THREE_PHASE,
      };
    case "LANDLORD_CHECK":
      return { powerSupply: THREE_PHASE, sanctionedLoadKw: requiredLoadKw(area).kw, civilWorkDueDate: ymd(addDays(c.handover ?? c.expected, -10)) };
    case "TOKEN_ADVANCE":
      return { mouSignedOn: ymd(new Date(Math.min(addDays(c.expected, -21).getTime(), addDays(today, -3).getTime()))), tokenAmount: 200_000 };
    case "LEGAL_STATUTORY":
      return {
        agreementDate: ymd(new Date(Math.min(addDays(c.expected, -3).getTime(), addDays(today, -1).getTime()))), seLicenceNo: `DEMO/SE/${c.store.state}/0091`, tradeLicenceNo: `DEMO/TL/${c.store.state}/0551`, labourLicenceNo: `DEMO/LL/${c.store.state}/0032`,
        storeGstin: "29AAKPR4567Q1Z5", balanceDepositAmount: c.store.rent * 9, balanceDepositPaidOn: keys,
      };
    case "INTERIORS_QUOTE":
      return { quotationAmount: 1_250_000, quotationScope: "Furniture, electrical (2.5 sq mm), AC (4 sq mm), in-shop branding (demo)" };
    case "MATERIAL_ORDERING":
      return { orderReferences: "PO-DEMO-2207 (interior), PO-DEMO-2208 (electrical), PO-DEMO-2209 (IT), PO-DEMO-2210 (branding)" };
    case "KEY_HANDOVER":
      return { handoverDate: keys, keysReceivedBy: "State Admin + store owner (demo)" };
    case "SITE_AC": {
      const ac = acRequirement(area);
      return { acType: ac.type, acUnits: Math.ceil(ac.minTons / 2), acTonnage: ac.minTons };
    }
    case "MARKETING":
      return { launchGuest: "Demo local celebrity" };
    case "BRAND_PROMOTERS":
      return { brands: ["Samsung", "Apple", "Vivo", "Oppo"], promoterCount: 4 };
    case "HR":
      return { storeManagerName: "Demo Store Manager", staffCount: 8 };
    case "STOCKS":
      return { stockValue: 3_850_000, stockArrivedOn: ymd(addDays(c.handover ?? today, 30)) };
    case "FINANCE_IT":
      return { nbfcPartners: ["Bajaj Finserv", "HDB Financial"] };
    case "LAUNCH_PLANNING":
      return { plannedLaunchDate: ymd(addDays(c.handover ?? today, 35)), monthlySalesTarget: 6_000_000 };
    case "SOFT_LAUNCH":
      return { softLaunchDate: ymd(addDays(c.handover ?? today, 35)), day1Sales: 420_000 };
    default:
      return {};
  }
}

type StoreSeed = {
  code: string; name: string; state: string; city: string; area: string; pincode: string; lat: number; lng: number;
  storeType: "OWN" | "FRANCHISE"; carpetAreaSqft: number; floor: "GROUND" | "FIRST" | "OTHER"; owner: UserKey; rent: number;
  createdDaysAgo: number;
  /** Days ago RK accepted the key handover (Day 0). */
  handoverDaysAgo: number | null;
  /** Expected keys (MOU point 11), days from today, when the keys are not received yet. */
  expectedInDays?: number;
  modules: Partial<Record<string, ModuleSeed>>;
};

/** Steps 1–5 done and the pre-key work finished a week before the keys. */
const UP_TO_KEYS = (keysDaysAgo: number): Partial<Record<string, ModuleSeed>> => ({
  LOCATION_FILING: done(),
  LANDLORD_CHECK: done(),
  TOKEN_ADVANCE: done({ paid: true, apx: true, actualCost: 200_000 }),
  LEGAL_STATUTORY: done({ estCost: 600_000, actualCost: 600_000 }),
  INTERIORS_QUOTE: done({ vendorName: "Demo Interiors", estCost: 1_250_000 }),
  SIGN_BOARD: done({ vendorName: "Demo Signage Co.", estCost: 280_000, actualCost: 265_000, actualEnd: d(-keysDaysAgo - 9) }),
  MATERIAL_ORDERING: done({ actualEnd: d(-keysDaysAgo - 8) }),
  KEY_HANDOVER: done(),
});
const SITE_DONE: Partial<Record<string, ModuleSeed>> = { SITE_FURNITURE: done(), SITE_ELECTRICAL: done(), SITE_AC: done(), SITE_BRANDING: done() };
const TRACKS_DONE: Partial<Record<string, ModuleSeed>> = {
  MARKETING: done(), INTERIORS: done({ actualCost: 1_260_000 }), BRAND_PROMOTERS: done(), HR: done(), STOCKS: done({ actualCost: 3_850_000 }), FINANCE_IT: done(), TRADE_LICENCE: done(), LAUNCH_PLANNING: done(),
};

const STORES: StoreSeed[] = [
  {
    code: "SGM-KA-BLR-0001", name: "Demo Store – Jayanagar", state: "KA", city: "Bengaluru", area: "Jayanagar 4th Block", pincode: "560011",
    lat: 12.925, lng: 77.5938, storeType: "OWN", carpetAreaSqft: 1500, floor: "GROUND", owner: "arjun", rent: 165_000, createdDaysAgo: 80, handoverDaysAgo: 18,
    modules: {
      ...UP_TO_KEYS(18),
      SITE_FURNITURE: done(),
      SITE_ELECTRICAL: done(),
      SITE_AC: working({ actualStart: d(-3), ticked: ["acCable"], details: { acType: "Cassette AC", acUnits: 5, acTonnage: 10 } }),
      MARKETING: working({ actualStart: d(-15), ticked: ["launchCampaign"] }),
      INTERIORS: working({ actualStart: d(-18) }),
      BRAND_PROMOTERS: working({ actualStart: d(-9), ticked: ["oemIntimation", "demoFixtures"] }),
      HR: {
        status: "BLOCKED", actualStart: d(-17), blockerReason: "Selected store manager withdrew; second round of interviews this week.", ticked: ["salesExecutives", "supportStaff"],
        comments: [{ by: "hr", text: "Two candidates shortlisted; DM to interview on Thursday.", daysAgo: 1 }],
      },
      STOCKS: working({ actualStart: d(-3), ticked: ["handsetOrder"] }),
      FINANCE_IT: working({
        actualStart: d(-14), ticked: ["nbfcIntimation", "cugMobiles"],
        comments: [{ by: "finit", text: "Broadband provider waiting for landlord permission to lay fibre through the common duct.", daysAgo: 2 }],
      }),
      TRADE_LICENCE: working({ actualStart: d(-12), ticked: ["seCertificate"] }),
      LAUNCH_PLANNING: working({ actualStart: d(-8), ticked: ["launchDateFinal"] }),
    },
  },
  {
    code: "SGM-TN-CHE-0002", name: "Demo Store – T. Nagar", state: "TN", city: "Chennai", area: "T. Nagar", pincode: "600017",
    lat: 13.0418, lng: 80.2341, storeType: "FRANCHISE", carpetAreaSqft: 1200, floor: "GROUND", owner: "meera", rent: 140_000, createdDaysAgo: 30, handoverDaysAgo: null, expectedInDays: 24,
    modules: {
      LOCATION_FILING: done(),
      LANDLORD_CHECK: done(),
      TOKEN_ADVANCE: pending({ completedDaysAgo: 1 }),
      LEGAL_STATUTORY: working({ actualStart: d(-6), ticked: ["agreementSigned"], details: { agreementDate: ymd(d(-6)) } }),
      INTERIORS_QUOTE: done({ vendorName: "Demo Interiors", estCost: 1_100_000 }),
    },
  },
  {
    code: "SGM-TG-HYD-0003", name: "Demo Store – Kukatpally", state: "TG", city: "Hyderabad", area: "Kukatpally", pincode: "500072",
    lat: 17.4849, lng: 78.4138, storeType: "FRANCHISE", carpetAreaSqft: 1100, floor: "FIRST", owner: "meera", rent: 120_000, createdDaysAgo: 95, handoverDaysAgo: 34,
    modules: { ...UP_TO_KEYS(34), ...SITE_DONE, ...TRACKS_DONE },
  },
  {
    code: "SGM-MH-PUN-0004", name: "Demo Store – Kothrud", state: "MH", city: "Pune", area: "Kothrud", pincode: "411038",
    lat: 18.5074, lng: 73.8077, storeType: "OWN", carpetAreaSqft: 1300, floor: "GROUND", owner: "rahul", rent: 130_000, createdDaysAgo: 100, handoverDaysAgo: 40,
    modules: { ...UP_TO_KEYS(40), ...SITE_DONE, ...TRACKS_DONE, SOFT_LAUNCH: done({ completedDaysAgo: 4, details: { softLaunchDate: ymd(d(-5)), day1Sales: 420_000 } }) },
  },
  {
    code: "SGM-KL-KOC-0005", name: "Demo Store – Edappally", state: "KL", city: "Kochi", area: "Edappally", pincode: "682024",
    lat: 10.0261, lng: 76.3083, storeType: "OWN", carpetAreaSqft: 900, floor: "GROUND", owner: "arjun", rent: 85_000, createdDaysAgo: 21, handoverDaysAgo: null, expectedInDays: 35,
    modules: {
      LOCATION_FILING: done(),
      LANDLORD_CHECK: {
        status: "IN_PROGRESS", approvalStatus: "REJECTED", actualStart: d(-10),
        approvalComment: "Point 5 not agreed: the landlord offers a 4-core cable; the SOP needs 6 sq mm 6-core from the meter. Re-submit after the landlord confirms in writing.",
        ticked: ["commercialTerms", "pt1ShutterLocks", "pt2ShutterPaint", "pt3Walls", "pt4Ceiling", "pt6ShutterService", "pt7AcLocation", "pt8LPatti"],
        details: { powerSupply: THREE_PHASE, sanctionedLoadKw: 15 },
        comments: [
          { by: "rk", text: "Point 5 not agreed: the landlord offers a 4-core cable; the SOP needs 6 sq mm 6-core from the meter.", daysAgo: 3 },
          { by: "stateadmin", text: "Landlord agreed on the phone to change the cable; written confirmation expected Monday.", daysAgo: 2 },
        ],
      },
      INTERIORS_QUOTE: working({ actualStart: d(-5), ticked: ["quotationCollected"], details: { quotationAmount: 850_000 } }),
    },
  },
  {
    code: "SGM-WB-KOL-0006", name: "Demo Store – Salt Lake", state: "WB", city: "Kolkata", area: "Salt Lake Sector V", pincode: "700091",
    lat: 22.5726, lng: 88.4339, storeType: "FRANCHISE", carpetAreaSqft: 1000, floor: "GROUND", owner: "fatima", rent: 120_000, createdDaysAgo: 52, handoverDaysAgo: 1,
    modules: { ...UP_TO_KEYS(1), LEGAL_STATUTORY: working({ actualStart: d(-14), ticked: ["agreementSigned", "seLicence", "gstRegistration"] }) },
  },
  {
    code: "SGM-GJ-AMD-0007", name: "Demo Store – Vastrapur", state: "GJ", city: "Ahmedabad", area: "Vastrapur", pincode: "380015",
    lat: 23.0395, lng: 72.5293, storeType: "OWN", carpetAreaSqft: 1400, floor: "GROUND", owner: "rahul", rent: 130_000, createdDaysAgo: 50, handoverDaysAgo: null, expectedInDays: -1,
    modules: {
      ...UP_TO_KEYS(-1),
      SIGN_BOARD: done({ vendorName: "Demo Signage Co.", actualEnd: d(-9) }),
      MATERIAL_ORDERING: done({ actualEnd: d(-10) }),
      LEGAL_STATUTORY: working({ actualStart: d(-20), ticked: ["agreementSigned", "seLicence", "tradeLicence", "labourLicence", "gstRegistration"] }),
      KEY_HANDOVER: pending({ completedDaysAgo: 0, details: { handoverDate: ymd(d(-1)), keysReceivedBy: "Rahul Deshmukh + Naveen Kumar (demo)" } }),
    },
  },
  {
    code: "SGM-UP-LKO-0008", name: "Demo Store – Gomti Nagar", state: "UP", city: "Lucknow", area: "Gomti Nagar", pincode: "226010",
    lat: 26.8467, lng: 80.9462, storeType: "OWN", carpetAreaSqft: 1100, floor: "FIRST", owner: "arjun", rent: 95_000, createdDaysAgo: 6, handoverDaysAgo: null, expectedInDays: 45,
    modules: { LOCATION_FILING: pending({ completedDaysAgo: 1, actualStart: d(-5) }), INTERIORS_QUOTE: working({ actualStart: d(-3) }) },
  },
  {
    code: "SGM-TN-CHE-0009", name: "Demo Store – Anna Nagar", state: "TN", city: "Chennai", area: "Anna Nagar", pincode: "600040",
    lat: 13.085, lng: 80.2101, storeType: "OWN", carpetAreaSqft: 800, floor: "GROUND", owner: "meera", rent: 90_000, createdDaysAgo: 44, handoverDaysAgo: null, expectedInDays: 6,
    modules: {
      LOCATION_FILING: done(),
      LANDLORD_CHECK: done(),
      TOKEN_ADVANCE: done({ completedDaysAgo: 2, paid: false, apx: true }),
      LEGAL_STATUTORY: working({ actualStart: d(-8), ticked: ["agreementSigned"] }),
      INTERIORS_QUOTE: done({ vendorName: "Demo Interiors", estCost: 800_000 }),
    },
  },
];

// ---------- sample files ----------
function sampleSvg(storeName: string, label: string, hue: number): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},35%,78%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},30%,58%)"/></linearGradient></defs>
<rect width="800" height="600" fill="url(#g)"/>
<rect x="60" y="380" width="680" height="150" rx="10" fill="rgba(255,255,255,0.85)"/>
<text x="90" y="440" font-family="Arial, sans-serif" font-size="36" font-weight="700" fill="#1f2937">${label.replace(/&/g, "&amp;")}</text>
<text x="90" y="490" font-family="Arial, sans-serif" font-size="24" fill="#4b5563">${storeName.replace(/&/g, "&amp;")} · SAMPLE FILE (demo data)</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

async function main() {
  // 1. SOP step templates from src/modules (defaults; resets HQ's Settings changes).
  await syncSteps(prisma, { reset: true });
  const templates = await prisma.moduleTemplate.findMany({ orderBy: { sortOrder: "asc" } });

  // 2. Remove previous demo data (stores owned by demo users) and their files.
  const oldStores = await prisma.store.findMany({ where: { owner: { email: { endsWith: "@sangeetha.test" } } }, select: { id: true } });
  for (const s of oldStores) await prisma.fileBlob.deleteMany({ where: { key: { startsWith: `${s.id}/` } } });
  await prisma.store.deleteMany({ where: { id: { in: oldStores.map((s) => s.id) } } });
  await prisma.notification.deleteMany({ where: { user: { email: { endsWith: "@sangeetha.test" } } } });
  await prisma.activityLog.deleteMany({ where: { storeId: null, user: { email: { endsWith: "@sangeetha.test" } } } });
  await prisma.appSetting.deleteMany({ where: { key: { in: ["last_overdue_check", "last_rag_week"] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@sangeetha.test", notIn: USERS.map((u) => u.email) }, ownedStores: { none: {} }, comments: { none: {} } } });

  // 3. Users
  const passwordHash = await bcrypt.hash(seedPassword as string, 12);
  const ids = {} as Record<UserKey, string>;
  for (const u of USERS) {
    const { key, ...data } = u;
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { ...data, passwordHash },
      update: { name: u.name, role: u.role, regionStates: u.regionStates, teams: u.teams, passwordHash, isActive: true },
    });
    ids[key] = user.id;
  }
  const note = (userKey: UserKey, n: { type: string; message: string; storeId: string; storeModuleId?: string; createdAt: Date }) =>
    prisma.notification.create({ data: { userId: ids[userKey], ...n } });

  // 4. Stores, steps, files, comments, activity
  let hue = 10;
  for (const s of STORES) {
    const handover = s.handoverDaysAgo !== null ? d(-s.handoverDaysAgo) : null;
    const createdDay = d(-s.createdDaysAgo);
    const expected = handover ?? (s.expectedInDays !== undefined ? d(s.expectedInDays) : defaultExpectedKey(createdDay));
    const ctx: Ctx = { store: s, handover, expected };
    const launched = s.modules.SOFT_LAUNCH?.status === "COMPLETED" ? (s.modules.SOFT_LAUNCH.details?.softLaunchDate as string) : null;
    const created = ago(-s.createdDaysAgo, 10);
    const store = await prisma.store.create({
      data: {
        storeCode: s.code, name: s.name, state: s.state, city: s.city, area: s.area, pincode: s.pincode,
        address: `Demo address, ${s.area}, ${s.city} ${s.pincode}`, lat: s.lat, lng: s.lng, storeType: s.storeType,
        carpetAreaSqft: s.carpetAreaSqft, floor: s.floor, ownerId: ids[s.owner], keyHandoverDate: handover, expectedKeyDate: expected,
        preKeyNotifiedFor: s.expectedInDays !== undefined && s.expectedInDays <= 7 ? null : handover ? expected : null,
        targetLaunchDate: handover ? addDays(handover, 35) : rolloutTarget(createdDay),
        actualLaunchDate: launched ? new Date(`${launched}T00:00:00Z`) : null,
        createdAt: created,
      },
    });
    await prisma.activityLog.create({ data: { storeId: store.id, userId: ids[s.owner], action: "store.created", newValue: { storeCode: s.code, name: s.name }, createdAt: created } });

    const plan = [...planFrom("created", createdDay, templates), ...planFrom("expectedKey", expected, templates), ...(handover ? planFrom("handover", handover, templates) : [])];
    for (const t of templates) {
      const m: ModuleSeed = s.modules[t.moduleType] ?? { status: "NOT_STARTED" };
      const def = getModuleDefinition(t.moduleType);
      const fields = t.fieldSchema as unknown as FieldDef[];
      const p = plan.find((x) => x.moduleType === t.moduleType);
      const editorKey = EDITOR[t.moduleType] === "owner" ? s.owner : (EDITOR[t.moduleType] ?? "hq");
      const approverKey = t.approverTeam ? (APPROVER[t.moduleType] ?? "hq") : editorKey;
      const isDoneLike = m.status === "COMPLETED";
      const actualStart = m.actualStart ?? (isDoneLike && p ? p.plannedStart : undefined);
      const actualEnd = m.actualEnd ?? (isDoneLike && p ? (p.plannedEnd < today ? p.plannedEnd : today) : undefined);
      const decided = m.approvalStatus === "APPROVED" || m.approvalStatus === "REJECTED";
      const completedAt = isDoneLike ? ago(-(m.completedDaysAgo ?? Math.max(1, Math.round((today.getTime() - (actualEnd ?? today).getTime()) / 864e5))), 16) : null;
      const approvedAt = m.approvalStatus === "REJECTED" ? ago(-3, 15) : m.approvalStatus === "APPROVED" && completedAt ? new Date(Math.min(Date.now(), completedAt.getTime() + (t.approverTeam ? 4 * 3600_000 : 0))) : null;

      const details: Record<string, unknown> = {};
      if (m.full) {
        Object.assign(details, demoValues(t.moduleType, ctx));
        for (const f of fields) if (f.type === "task") details[f.key] = true;
      }
      for (const k of m.ticked ?? []) details[k] = true;
      Object.assign(details, m.details ?? {});
      for (const f of fields) {
        if (!f.fromStore) continue;
        details[f.key] = f.fromStore === "state" ? s.state : f.fromStore === "carpetAreaSqft" ? s.carpetAreaSqft : f.fromStore === "storeCode" ? s.code : f.fromStore === "name" ? s.name : store.address;
      }
      if (t.moduleType === "TOKEN_ADVANCE" && (m.paid || m.apx)) {
        if (m.paid) details.payment = { paidAmount: 200_000, paidOn: ymd(addDays(approvedAt ?? today, 0)), paymentMode: "NEFT", utr: "DEMO-UTR-000123", recordedBy: "Ramesh Gupta (demo Head office)", recordedAt: (approvedAt ?? new Date()).toISOString() };
        if (m.apx) details.apxPo = { apxPoNumber: "APX-DEMO-4410", recordedBy: "Priya Menon (demo Accounts)", recordedAt: (approvedAt ?? new Date()).toISOString() };
      }

      const mod = await prisma.storeModule.create({
        data: {
          storeId: store.id, moduleType: t.moduleType, status: m.status, approvalStatus: m.approvalStatus ?? "PENDING",
          approvalComment: m.approvalComment ?? null, approvedById: decided ? ids[approverKey] : null, approvedAt,
          blockerReason: m.blockerReason ?? null, plannedStart: p?.plannedStart ?? null, plannedEnd: p?.plannedEnd ?? null,
          actualStart: actualStart ?? (m.status !== "NOT_STARTED" ? d(-3) : null), actualEnd: actualEnd ?? null, vendorName: m.vendorName ?? null,
          estCost: m.estCost ?? null, actualCost: m.actualCost ?? null, details: details as Prisma.InputJsonObject,
          completedAt, updatedById: ids[editorKey],
        },
      });

      // Sample files for the required documents of completed steps.
      if (isDoneLike) {
        for (const f of fields.filter((x) => x.type === "file" && x.required)) {
          const key = `${store.id}/${mod.id}/${randomUUID()}.svg`;
          await prisma.fileBlob.create({ data: { key, data: new Uint8Array(sampleSvg(s.name, f.label, hue)) } });
          await prisma.attachment.create({
            data: { storeModuleId: mod.id, fileUrl: key, fileType: "image/svg+xml", fileName: `sample-${f.attachmentTag}.svg`, sizeBytes: 1200, tag: f.attachmentTag ?? "document", uploadedById: ids[editorKey], uploadedAt: completedAt ?? ago(-1) },
          });
          hue = (hue + 23) % 360;
        }
      }

      if (completedAt) {
        await prisma.activityLog.create({ data: { storeId: store.id, storeModuleId: mod.id, userId: ids[editorKey], action: "module.updated", oldValue: { status: "IN_PROGRESS" }, newValue: { status: "COMPLETED" }, createdAt: completedAt } });
      }
      if (decided && t.approverTeam) {
        await prisma.activityLog.create({
          data: { storeId: store.id, storeModuleId: mod.id, userId: ids[approverKey], action: m.approvalStatus === "APPROVED" ? "module.approved" : "module.rejected", newValue: { comment: m.approvalComment ?? null, as: teamLabel(t.approverTeam) }, createdAt: approvedAt ?? ago(-5) },
        });
      } else if (m.approvalStatus === "APPROVED" && completedAt) {
        await prisma.activityLog.create({ data: { storeId: store.id, storeModuleId: mod.id, userId: ids[editorKey], action: "module.done", createdAt: completedAt } });
      }
      if (t.moduleType === "KEY_HANDOVER" && handover && m.approvalStatus === "APPROVED") {
        await prisma.activityLog.create({ data: { storeId: store.id, storeModuleId: mod.id, userId: ids.rk, action: "key_handover.accepted", newValue: { keyHandoverDate: ymd(handover) }, createdAt: ago(-(s.handoverDaysAgo as number), 17) } });
      }
      for (const c of m.comments ?? []) {
        await prisma.comment.create({ data: { storeModuleId: mod.id, userId: ids[c.by], text: c.text, createdAt: ago(-c.daysAgo, 14) } });
      }

      // Notifications as the app would have sent them.
      const base = { storeId: store.id, storeModuleId: mod.id };
      if (m.status === "BLOCKED") await note("hq", { ...base, type: "module_blocked", message: `${s.name}: ${t.displayName} is Blocked — ${m.blockerReason}`, createdAt: ago(-2) });
      if (m.status === "COMPLETED" && m.approvalStatus === "PENDING" && t.approverTeam) {
        for (const who of [approverKey, "hq"]) {
          await note(who, { ...base, type: "module_completed", message: `${s.name}: ${t.displayName} marked Completed — waiting for ${teamLabel(t.approverTeam)} approval.`, createdAt: completedAt ?? ago(-1) });
        }
      }
      if (m.approvalStatus === "REJECTED") {
        await note(editorKey, { ...base, type: "module_rejected", message: `${s.name}: ${t.displayName} was sent back by ${teamLabel(t.approverTeam ?? "")} — ${m.approvalComment}`, createdAt: ago(-3, 15) });
      }
      if (s.handoverDaysAgo !== null && s.handoverDaysAgo <= 2 && def?.scheduleAnchor === "handover" && m.status === "NOT_STARTED" && t.moduleType !== "SOFT_LAUNCH" && p) {
        await note(editorKey, { ...base, type: "setup_start", message: `${s.name}: keys received (Day 0). ${def.code !== "6" ? `${def.code} ` : ""}${t.displayName}, planned ${ymd(p.plannedStart)} – ${ymd(p.plannedEnd)}.`, createdAt: ago(-s.handoverDaysAgo, 18) });
      }
      if (t.moduleType === "TOKEN_ADVANCE" && m.approvalStatus === "APPROVED" && !m.paid) {
        await note("ho", { ...base, type: "after_approval", message: `${s.name}: Token advance approved — next: HO releases the token advance to the landlord. Record it in the tracker.`, createdAt: approvedAt ?? ago(-1) });
      }
    }

    const modules = await prisma.storeModule.findMany({ where: { storeId: store.id } });
    const overallStatus = computeOverallStatus({ overallStatus: null, keyHandoverDate: store.keyHandoverDate, actualLaunchDate: store.actualLaunchDate }, modules);
    await prisma.store.update({ where: { id: store.id }, data: { overallStatus } });
    console.log(`${s.code.padEnd(16)} ${s.city.padEnd(10)} → ${overallStatus ?? "(location filing)"}`);
  }
  console.log(`\nSeeded ${templates.length} SOP steps, ${USERS.length} demo users, ${STORES.length} demo stores.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
