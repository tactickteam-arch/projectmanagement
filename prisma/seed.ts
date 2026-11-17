/**
 * Development / demo seed (spec instruction 4): fictional sample stores in different Indian
 * states, each at a different point of the new-outlet launch flow, plus one demo user per
 * Sangeetha team (Boss + CEO, RK, Accounts, Legal, departments), so every view can be tried. Everything is clearly labelled "Demo";
 * people use the reserved .test e-mail domain. Not Sangeetha business data.
 *
 * Re-running is safe: it removes previous demo stores (owned by *@sangeetha.test users) and
 * their files, then recreates them relative to today's date.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { ApprovalStatus, ModuleStatus, Prisma } from "../src/generated/prisma/client";
import { addDays, todayInIndia } from "../src/lib/dates";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { planModulesFromHandover } from "../src/lib/scheduling";
import { computeOverallStatus } from "../src/lib/status";
import { syncSteps } from "../src/lib/steps-sync";
import { getModuleDefinition } from "../src/modules";
import type { FieldDef } from "../src/modules/types";
import { teamLabel } from "../src/lib/teams";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data with NODE_ENV=production");
const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword || seedPassword.length < 8) throw new Error("SEED_PASSWORD must be set in .env (at least 8 characters)");

const prisma = createPrismaClient();
const today = todayInIndia();
const d = (days: number) => addDays(today, days);
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
  { key: "legal", email: "legal@sangeetha.test", name: "Suresh Babu (demo Legal & Tax)", role: "TEAM_MEMBER", regionStates: [], teams: ["LEGAL", "TAX"] },
  { key: "stateadmin", email: "stateadmin@sangeetha.test", name: "Naveen Kumar (demo State admin)", role: "TEAM_MEMBER", regionStates: [], teams: ["STATE_ADMIN"] },
  { key: "marketing", email: "marketing@sangeetha.test", name: "Anita Shetty (demo Marketing)", role: "TEAM_MEMBER", regionStates: [], teams: ["MARKETING"] },
  { key: "interiors", email: "interiors@sangeetha.test", name: "Ravi Teja (demo Interiors)", role: "TEAM_MEMBER", regionStates: [], teams: ["INTERIORS"] },
  { key: "brands", email: "brands@sangeetha.test", name: "Deepa Rao (demo Brand managers)", role: "TEAM_MEMBER", regionStates: [], teams: ["BRAND_MANAGERS"] },
  { key: "hr", email: "hr@sangeetha.test", name: "Farhan Ali (demo HR)", role: "TEAM_MEMBER", regionStates: [], teams: ["HR"] },
  { key: "purchase", email: "purchase@sangeetha.test", name: "Gopal Krishnan (demo Purchase · e-com)", role: "TEAM_MEMBER", regionStates: [], teams: ["PURCHASE"] },
  { key: "finit", email: "finance.it@sangeetha.test", name: "Lakshmi Das (demo Finance & IT)", role: "TEAM_MEMBER", regionStates: [], teams: ["FINANCE_IT"] },
  { key: "sales", email: "sales@sangeetha.test", name: "Vikram Hegde (demo SH · SL)", role: "TEAM_MEMBER", regionStates: [], teams: ["SALES"] },
];
type UserKey = string;

/** Demo user who works on each step, and who approves it (steps without an approver: the same user). */
const EDITOR: Record<string, UserKey | "owner"> = {
  LOCATION_FILING: "owner", LANDLORD_CHECK: "accounts", TOKEN_ADVANCE: "accounts", LEGAL_STATUTORY: "legal", KEY_HANDOVER: "owner",
  MARKETING: "marketing", INTERIORS: "interiors", BRAND_PROMOTERS: "brands", HR: "hr", STOCKS: "purchase", FINANCE_IT: "finit", TRADE_LICENCE: "legal", LAUNCH_PLANNING: "sales",
};
const APPROVER: Record<string, UserKey> = { LOCATION_FILING: "leadership", LANDLORD_CHECK: "rk", TOKEN_ADVANCE: "accounts", KEY_HANDOVER: "rk" };

// ---------- step seeds ----------
type ModuleSeed = {
  status: ModuleStatus;
  approvalStatus?: ApprovalStatus;
  approvalComment?: string;
  blockerReason?: string;
  actualStart?: Date;
  actualEnd?: Date;
  vendorName?: string;
  vendorPhone?: string;
  estCost?: number;
  actualCost?: number;
  remarks?: string;
  details?: Prisma.InputJsonObject;
  /** Tick every point and checklist row (default for done steps). */
  allTicked?: boolean;
  completedDaysAgo?: number;
  photos?: number; // generated sample photos (defaults to the step minimum when Completed)
  comments?: { by: UserKey; text: string; daysAgo: number }[];
};

const done = (x: Omit<ModuleSeed, "status" | "approvalStatus"> = {}): ModuleSeed => ({ status: "COMPLETED", approvalStatus: "APPROVED", allTicked: true, ...x });
const pending = (x: Omit<ModuleSeed, "status" | "approvalStatus"> = {}): ModuleSeed => ({ status: "COMPLETED", approvalStatus: "PENDING", allTicked: true, ...x });
const working = (x: Omit<ModuleSeed, "status"> = {}): ModuleSeed => ({ status: "IN_PROGRESS", ...x });

/** Points (task fields) ticked, by key. */
const ticked = (...keys: string[]): Prisma.InputJsonObject => Object.fromEntries(keys.map((k) => [k, true]));

function tickAll(moduleType: string, details: Record<string, unknown>): Record<string, unknown> {
  const fields: FieldDef[] = getModuleDefinition(moduleType)?.fields ?? [];
  const out: Record<string, unknown> = { ...details };
  for (const f of fields) {
    if (f.type === "task") out[f.key] = true;
    if (f.type === "checklist" && !Array.isArray(out[f.key])) {
      out[f.key] = (f.defaultItems ?? []).map((n) => ({ ...Object.fromEntries((f.itemFields ?? []).map((c, i) => [c.key, i === 0 ? n : c.type === "yesno" ? c.key === f.mustTick : c.type === "number" ? 2 : null])) }));
    }
  }
  return out;
}

const LOCATION = (rent: number, footfall: number, x: Partial<ModuleSeed> = {}) =>
  done({
    details: {
      landlordName: "Demo Landlord", landlordPhone: "9000000000", monthlyRent: rent, securityDeposit: rent * 10, lockInMonths: 36,
      leaseTenureYears: 9, yearlyEscalationPct: 5, frontageWidthFt: 24, footfallRating: footfall, nearbyCompetitors: ["Demo competitor A", "Demo competitor B"],
    },
    ...x,
  });
const LANDLORD = (x: Partial<ModuleSeed> = {}) => done({ estCost: 0, ...x });
const TOKEN = (amount: number, x: Partial<ModuleSeed> = {}) =>
  done({ estCost: amount, actualCost: amount, details: { amount, paymentMode: "NEFT", utrOrChequeNo: "DEMO-UTR-000123", apxPoNumber: "APX-DEMO-4410" }, ...x });
const LEGAL = (x: Partial<ModuleSeed> = {}) =>
  done({
    estCost: 600_000, actualCost: 600_000,
    details: { rentAgreementStatus: "Registered", rentFreeFitoutDays: 30, shopEstablishmentNo: "DEMO/SE/2026/0091", gstin: "29DEMOX1234Z1Z5", balanceDepositAmount: 600_000 },
    ...x,
  });
const HANDOVER = (handover: Date | null, x: Partial<ModuleSeed> = {}) =>
  done({ details: { handoverDate: handover ? handover.toISOString().slice(0, 10) : null, receivedBy: "Store owner (demo)", premisesCondition: "Good" }, ...x });
const TRACKS_DONE = (): Partial<Record<string, ModuleSeed>> => ({
  MARKETING: done({ vendorName: "Demo Signage Co.", estCost: 280_000, actualCost: 265_000, details: { boardType: "LED", boardWidthFt: 24, boardHeightFt: 4, launchGuest: "Demo local celebrity" } }),
  INTERIORS: done({ vendorName: "Demo Interiors", estCost: 1_200_000, actualCost: 1_260_000, details: { quotationAmount: 1_250_000, poNumber: "PO-DEMO-2210", poAmount: 1_260_000, sanctionedLoadKw: 25, acUnits: 4, acTonnage: 8, brandCounters: ["Samsung", "Apple", "Vivo"] } }),
  BRAND_PROMOTERS: done({ details: { brandsIntimated: ["Samsung", "Apple", "Vivo", "Oppo"], promotersDeployed: 4 } }),
  HR: done({ details: { staffRequired: 8, staffAppointed: 8, storeManagerName: "Demo Store Manager", trainingCompleted: true } }),
  STOCKS: done({ estCost: 4_000_000, actualCost: 3_850_000, details: { stockValue: 3_850_000 } }),
  FINANCE_IT: done({ vendorName: "Demo IT Services", estCost: 180_000, actualCost: 196_500, details: { nbfcPartners: ["Bajaj Finserv", "HDB Financial"], cugNumbers: 8, internetProvider: "Demo ISP", speedMbps: 200, cctvCameras: 8, apxStoreCode: "APX-DEMO" } }),
  TRADE_LICENCE: done({ estCost: 15_000, actualCost: 15_000, details: { licenceNumber: "DEMO/TL/2026/551" } }),
  LAUNCH_PLANNING: done({ details: { launchOfferDetails: "Demo launch offer: free screen guard with every phone", monthlyTarget: 6_000_000, callsMade: 450 } }),
});

type StoreSeed = {
  code: string; name: string; state: string; city: string; area: string; pincode: string; lat: number; lng: number;
  storeType: "OWN" | "FRANCHISE"; carpetAreaSqft: number; floor: "GROUND" | "FIRST" | "OTHER"; owner: UserKey;
  createdDaysAgo: number;
  /** Days ago RK accepted the key handover (sets Day 0). */
  handoverDaysAgo: number | null;
  targetLaunch?: Date | null;
  launchedDaysAgo?: number;
  modules: Partial<Record<string, ModuleSeed>>;
};

const ALL_DONE = (handover: Date): Partial<Record<string, ModuleSeed>> => ({
  LOCATION_FILING: LOCATION(150_000, 4),
  LANDLORD_CHECK: LANDLORD(),
  TOKEN_ADVANCE: TOKEN(500_000),
  LEGAL_STATUTORY: LEGAL(),
  KEY_HANDOVER: HANDOVER(handover),
  ...TRACKS_DONE(),
});

const STORES: StoreSeed[] = [
  {
    code: "SGM-KA-BLR-0001", name: "Demo Store – Jayanagar", state: "KA", city: "Bengaluru", area: "Jayanagar 4th Block", pincode: "560011",
    lat: 12.925, lng: 77.5938, storeType: "OWN", carpetAreaSqft: 1500, floor: "GROUND", owner: "arjun", createdDaysAgo: 80, handoverDaysAgo: 25,
    modules: {
      LOCATION_FILING: LOCATION(165_000, 5),
      LANDLORD_CHECK: LANDLORD(),
      TOKEN_ADVANCE: TOKEN(600_000),
      LEGAL_STATUTORY: LEGAL(),
      KEY_HANDOVER: HANDOVER(d(-25)),
      MARKETING: working({ vendorName: "Demo Signage Co.", estCost: 280_000, actualStart: d(-22), details: { ...ticked("externalSignage", "campaignAndCollaterals"), boardType: "LED", boardWidthFt: 24, boardHeightFt: 4 } }),
      INTERIORS: done({ vendorName: "Demo Interiors", estCost: 1_200_000, actualCost: 1_320_000, actualStart: d(-25), actualEnd: d(-6), details: { quotationAmount: 1_250_000, poNumber: "PO-DEMO-2207", poAmount: 1_320_000, acUnits: 4, acTonnage: 8 } }),
      BRAND_PROMOTERS: working({ actualStart: d(-9), details: { ...ticked("intimationToBrands", "demoFixtures"), brandsIntimated: ["Samsung", "Apple", "Vivo"] } }),
      HR: {
        status: "BLOCKED", actualStart: d(-24), blockerReason: "Selected store manager withdrew; second round of interviews this week.",
        details: { staffRequired: 8, staffAppointed: 5 },
        comments: [{ by: "hr", text: "Two candidates shortlisted; DM to interview on Thursday.", daysAgo: 1 }],
      },
      STOCKS: working({ actualStart: d(-3), details: { orderDate: d(-3).toISOString().slice(0, 10), stockValue: 4_200_000 } }),
      FINANCE_IT: working({
        vendorName: "Demo ISP", estCost: 180_000, actualStart: d(-20), details: { ...ticked("nbfcIntimation", "cugConnections"), nbfcPartners: ["Bajaj Finserv"], cugNumbers: 6 },
        comments: [{ by: "finit", text: "Broadband provider waiting for landlord permission to lay fibre through the common duct.", daysAgo: 2 }],
      }),
      TRADE_LICENCE: working({ actualStart: d(-18), details: { licenceNumber: null } }),
      LAUNCH_PLANNING: working({ actualStart: d(-8), details: { ...ticked("finaliseLaunchDate"), plannedLaunchDate: d(8).toISOString().slice(0, 10) } }),
    },
  },
  {
    code: "SGM-TN-CHE-0002", name: "Demo Store – T. Nagar", state: "TN", city: "Chennai", area: "T. Nagar", pincode: "600017",
    lat: 13.0418, lng: 80.2341, storeType: "FRANCHISE", carpetAreaSqft: 1200, floor: "GROUND", owner: "meera", createdDaysAgo: 30, handoverDaysAgo: null, targetLaunch: d(55),
    modules: {
      LOCATION_FILING: LOCATION(140_000, 5),
      LANDLORD_CHECK: LANDLORD(),
      TOKEN_ADVANCE: pending({ estCost: 500_000, actualCost: 500_000, actualStart: d(-8), actualEnd: d(-5), completedDaysAgo: 2, details: { amount: 500_000, paymentDate: d(-5).toISOString().slice(0, 10), paymentMode: "RTGS", utrOrChequeNo: "DEMO-UTR-778812" } }),
      LEGAL_STATUTORY: working({ actualStart: d(-6), details: { ...ticked("signingOfAgreement"), rentAgreementStatus: "Signed", agreementDate: d(-6).toISOString().slice(0, 10) } }),
    },
  },
  {
    code: "SGM-TG-HYD-0003", name: "Demo Store – Kukatpally", state: "TG", city: "Hyderabad", area: "Kukatpally", pincode: "500072",
    lat: 17.4849, lng: 78.4138, storeType: "FRANCHISE", carpetAreaSqft: 1100, floor: "FIRST", owner: "meera", createdDaysAgo: 100, handoverDaysAgo: 34,
    modules: ALL_DONE(d(-34)),
  },
  {
    code: "SGM-MH-PUN-0004", name: "Demo Store – Kothrud", state: "MH", city: "Pune", area: "Kothrud", pincode: "411038",
    lat: 18.5074, lng: 73.8077, storeType: "OWN", carpetAreaSqft: 1300, floor: "GROUND", owner: "rahul", createdDaysAgo: 120, handoverDaysAgo: 45, launchedDaysAgo: 5,
    modules: ALL_DONE(d(-45)),
  },
  {
    code: "SGM-KL-KOC-0005", name: "Demo Store – Edappally", state: "KL", city: "Kochi", area: "Edappally", pincode: "682024",
    lat: 10.0261, lng: 76.3083, storeType: "OWN", carpetAreaSqft: 900, floor: "GROUND", owner: "arjun", createdDaysAgo: 21, handoverDaysAgo: null,
    modules: {
      LOCATION_FILING: LOCATION(85_000, 4),
      LANDLORD_CHECK: {
        status: "IN_PROGRESS", approvalStatus: "REJECTED", actualStart: d(-10),
        approvalComment: "Civil work by landlord is not complete — flooring and rolling shutter still pending. Re-submit after the site visit.",
        details: { ...ticked("commercialTerms") }, allTicked: false,
        comments: [
          { by: "rk", text: "Civil work by landlord is not complete — flooring and rolling shutter still pending. Re-submit after the site visit.", daysAgo: 3 },
          { by: "accounts", text: "Landlord has committed to finish flooring by Saturday. Will re-check on Monday.", daysAgo: 2 },
        ],
      },
    },
  },
  {
    code: "SGM-WB-KOL-0006", name: "Demo Store – Salt Lake", state: "WB", city: "Kolkata", area: "Salt Lake Sector V", pincode: "700091",
    lat: 22.5726, lng: 88.4339, storeType: "FRANCHISE", carpetAreaSqft: 1000, floor: "GROUND", owner: "fatima", createdDaysAgo: 45, handoverDaysAgo: 1,
    modules: {
      LOCATION_FILING: LOCATION(120_000, 4),
      LANDLORD_CHECK: LANDLORD(),
      TOKEN_ADVANCE: TOKEN(450_000),
      LEGAL_STATUTORY: working({ actualStart: d(-12), details: { ...ticked("signingOfAgreement", "licences"), rentAgreementStatus: "Registered", shopEstablishmentNo: "DEMO/SE/WB/0042" } }),
      KEY_HANDOVER: HANDOVER(d(-1)),
    },
  },
  {
    code: "SGM-GJ-AMD-0007", name: "Demo Store – Vastrapur", state: "GJ", city: "Ahmedabad", area: "Vastrapur", pincode: "380015",
    lat: 23.0395, lng: 72.5293, storeType: "OWN", carpetAreaSqft: 1400, floor: "GROUND", owner: "rahul", createdDaysAgo: 55, handoverDaysAgo: null,
    modules: {
      LOCATION_FILING: LOCATION(130_000, 4),
      LANDLORD_CHECK: LANDLORD(),
      TOKEN_ADVANCE: TOKEN(550_000, { details: { amount: 550_000, paymentMode: "NEFT", utrOrChequeNo: "DEMO-UTR-551177" } }),
      LEGAL_STATUTORY: LEGAL(),
      KEY_HANDOVER: pending({ completedDaysAgo: 1, details: { handoverDate: d(-2).toISOString().slice(0, 10), receivedBy: "Rahul Deshmukh (demo)", premisesCondition: "Good" } }),
    },
  },
  {
    code: "SGM-UP-LKO-0008", name: "Demo Store – Gomti Nagar", state: "UP", city: "Lucknow", area: "Gomti Nagar", pincode: "226010",
    lat: 26.8467, lng: 80.9462, storeType: "OWN", carpetAreaSqft: 1100, floor: "FIRST", owner: "arjun", createdDaysAgo: 6, handoverDaysAgo: null,
    modules: {
      LOCATION_FILING: pending({ completedDaysAgo: 1, actualStart: d(-5), details: { landlordName: "Demo Landlord", monthlyRent: 95_000, frontageWidthFt: 18, footfallRating: 3 } }),
    },
  },
];

// ---------- sample photos ----------
const LABELS: Record<string, string> = {
  LOCATION_FILING: "Frontage", LANDLORD_CHECK: "Premises", KEY_HANDOVER: "Handover", MARKETING: "Sign board", INTERIORS: "Interiors",
  BRAND_PROMOTERS: "Brand counter", FINANCE_IT: "Billing counter",
};
function samplePhotoSvg(storeName: string, label: string, n: number, hue: number): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},35%,78%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},30%,58%)"/></linearGradient></defs>
<rect width="800" height="600" fill="url(#g)"/>
<rect x="60" y="380" width="680" height="150" rx="10" fill="rgba(255,255,255,0.85)"/>
<text x="90" y="440" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#1f2937">${label} — photo ${n}</text>
<text x="90" y="490" font-family="Arial, sans-serif" font-size="26" fill="#4b5563">${storeName.replace(/&/g, "&amp;")} · SAMPLE PHOTO (demo data)</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

async function main() {
  // 1. Launch-flow step templates from src/modules (defaults; resets HQ's Settings changes).
  await syncSteps(prisma, { reset: true });
  const templates = await prisma.moduleTemplate.findMany({ orderBy: { sortOrder: "asc" } });

  // 2. Remove previous demo data (stores owned by demo users) and their files.
  const oldStores = await prisma.store.findMany({ where: { owner: { email: { endsWith: "@sangeetha.test" } } }, select: { id: true } });
  for (const s of oldStores) await prisma.fileBlob.deleteMany({ where: { key: { startsWith: `${s.id}/` } } });
  await prisma.store.deleteMany({ where: { id: { in: oldStores.map((s) => s.id) } } });
  await prisma.notification.deleteMany({ where: { user: { email: { endsWith: "@sangeetha.test" } } } });
  await prisma.activityLog.deleteMany({ where: { storeId: null, user: { email: { endsWith: "@sangeetha.test" } } } });
  await prisma.appSetting.deleteMany({ where: { key: "last_overdue_check" } });
  // Earlier demo accounts that are no longer part of the demo set.
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
  const note = (userKey: UserKey, n: { type: string; message: string; storeId: string; storeModuleId: string; createdAt: Date }) =>
    prisma.notification.create({ data: { userId: ids[userKey], ...n } });

  // 4. Stores, steps, photos, comments, activity
  let hue = 10;
  for (const s of STORES) {
    const handover = s.handoverDaysAgo !== null ? d(-s.handoverDaysAgo) : null;
    const created = ago(-s.createdDaysAgo, 10);
    const store = await prisma.store.create({
      data: {
        storeCode: s.code, name: s.name, state: s.state, city: s.city, area: s.area, pincode: s.pincode,
        address: `Demo address, ${s.area}, ${s.city} ${s.pincode}`, lat: s.lat, lng: s.lng, storeType: s.storeType,
        carpetAreaSqft: s.carpetAreaSqft, floor: s.floor, ownerId: ids[s.owner], keyHandoverDate: handover,
        targetLaunchDate: s.targetLaunch ?? (handover ? addDays(handover, 30) : null),
        actualLaunchDate: s.launchedDaysAgo !== undefined ? d(-s.launchedDaysAgo) : null,
        createdAt: created,
      },
    });
    await prisma.activityLog.create({ data: { storeId: store.id, userId: ids[s.owner], action: "store.created", newValue: { storeCode: s.code, name: s.name }, createdAt: created } });

    const plan = handover ? planModulesFromHandover(handover, templates) : [];
    for (const t of templates) {
      const m: ModuleSeed = s.modules[t.moduleType] ?? { status: "NOT_STARTED" };
      const p = plan.find((x) => x.moduleType === t.moduleType);
      const editorKey = EDITOR[t.moduleType] === "owner" ? s.owner : (EDITOR[t.moduleType] ?? "hq");
      const approverKey = t.approverTeam ? (APPROVER[t.moduleType] ?? "hq") : editorKey;
      // Done tracks without explicit dates finish within their planned window.
      const actualStart = m.actualStart ?? (m.status === "COMPLETED" && p ? p.plannedStart : undefined);
      const actualEnd = m.actualEnd ?? (m.status === "COMPLETED" && p ? addDays(p.plannedEnd, -1) : undefined);
      const decided = m.approvalStatus === "APPROVED" || m.approvalStatus === "REJECTED";
      const completedAt =
        m.status === "COMPLETED"
          ? ago(-(m.completedDaysAgo ?? (actualEnd ? Math.max(1, -Math.round((actualEnd.getTime() - today.getTime()) / 864e5)) : (s.handoverDaysAgo ?? 0) + 10)), 16)
          : null;
      const approvedAt = m.approvalStatus === "REJECTED" ? ago(-3, 15) : m.approvalStatus === "APPROVED" && completedAt ? new Date(completedAt.getTime() + (t.approverTeam ? 864e5 : 0)) : null;
      const details = (m.allTicked ? tickAll(t.moduleType, (m.details ?? {}) as Record<string, unknown>) : (m.details ?? {})) as Prisma.InputJsonObject;

      const mod = await prisma.storeModule.create({
        data: {
          storeId: store.id, moduleType: t.moduleType, status: m.status, approvalStatus: m.approvalStatus ?? "PENDING",
          approvalComment: m.approvalComment ?? null, approvedById: decided ? ids[approverKey] : null, approvedAt,
          blockerReason: m.blockerReason ?? null, plannedStart: p?.plannedStart ?? null, plannedEnd: p?.plannedEnd ?? null,
          actualStart: actualStart ?? null, actualEnd: actualEnd ?? null, vendorName: m.vendorName ?? null, vendorPhone: m.vendorPhone ?? null,
          estCost: m.estCost ?? null, actualCost: m.actualCost ?? null, remarks: m.remarks ?? null, details,
          completedAt, updatedById: ids[editorKey],
        },
      });

      // Sample photos so Completed steps satisfy the photo rule.
      const photoCount = m.photos ?? (m.status === "COMPLETED" ? t.minPhotos : 0);
      const photoField = (t.fieldSchema as unknown as FieldDef[]).find((f) => f.type === "file" && f.attachmentTag?.startsWith("photo"));
      for (let n = 1; n <= photoCount; n++) {
        const key = `${store.id}/${mod.id}/${randomUUID()}.svg`;
        const label = LABELS[t.moduleType] ?? t.displayName;
        await prisma.fileBlob.create({ data: { key, data: new Uint8Array(samplePhotoSvg(s.name, label, n, hue)) } });
        await prisma.attachment.create({
          data: {
            storeModuleId: mod.id, fileUrl: key, fileType: "image/svg+xml", fileName: `sample-${label.toLowerCase().replace(/\s+/g, "-")}-${n}.svg`, sizeBytes: 1200,
            tag: t.photoTag ?? photoField?.attachmentTag ?? "photo_after", uploadedById: ids[editorKey], uploadedAt: completedAt ?? ago(-1),
          },
        });
      }
      hue = (hue + 23) % 360;

      if (completedAt) {
        await prisma.activityLog.create({ data: { storeId: store.id, storeModuleId: mod.id, userId: ids[editorKey], action: "module.updated", oldValue: { status: "IN_PROGRESS" }, newValue: { status: "COMPLETED" }, createdAt: completedAt } });
      }
      if (decided && t.approverTeam) {
        await prisma.activityLog.create({
          data: { storeId: store.id, storeModuleId: mod.id, userId: ids[approverKey], action: m.approvalStatus === "APPROVED" ? "module.approved" : "module.rejected", newValue: { comment: m.approvalComment ?? null }, createdAt: approvedAt ?? ago(-5) },
        });
      } else if (m.approvalStatus === "APPROVED" && completedAt) {
        await prisma.activityLog.create({ data: { storeId: store.id, storeModuleId: mod.id, userId: ids[editorKey], action: "module.done", createdAt: completedAt } });
      }
      if (t.moduleType === "KEY_HANDOVER" && handover && m.approvalStatus === "APPROVED") {
        await prisma.activityLog.create({ data: { storeId: store.id, storeModuleId: mod.id, userId: ids.rk, action: "key_handover.accepted", newValue: { keyHandoverDate: handover.toISOString().slice(0, 10) }, createdAt: ago(-(s.handoverDaysAgo as number), 17) } });
      }
      for (const c of m.comments ?? []) {
        await prisma.comment.create({ data: { storeModuleId: mod.id, userId: ids[c.by], text: c.text, createdAt: ago(-c.daysAgo, 14) } });
      }

      // Notifications as the app would have sent them.
      const base = { storeId: store.id, storeModuleId: mod.id };
      if (m.status === "BLOCKED") {
        await note("hq", { ...base, type: "module_blocked", message: `${s.name}: ${t.displayName} is Blocked — ${m.blockerReason}`, createdAt: ago(-2) });
      }
      if (m.status === "COMPLETED" && m.approvalStatus === "PENDING" && t.approverTeam) {
        for (const who of [approverKey, "hq"]) {
          await note(who, { ...base, type: "module_completed", message: `${s.name}: ${t.displayName} marked Completed — waiting for ${teamLabel(t.approverTeam)} approval.`, createdAt: completedAt ?? ago(-1) });
        }
      }
      if (m.approvalStatus === "REJECTED") {
        await note(editorKey, { ...base, type: "module_rejected", message: `${s.name}: ${t.displayName} was sent back by ${teamLabel(t.approverTeam ?? "")} — ${m.approvalComment}`, createdAt: ago(-3, 15) });
      }
      if (s.handoverDaysAgo !== null && s.handoverDaysAgo <= 2 && p && m.status === "NOT_STARTED") {
        await note(editorKey, { ...base, type: "setup_start", message: `${s.name}: keys received — start ${t.displayName} (step 6), planned ${p.plannedStart.toISOString().slice(0, 10)} to ${p.plannedEnd.toISOString().slice(0, 10)}.`, createdAt: ago(-s.handoverDaysAgo, 18) });
      }
      if (t.moduleType === "TOKEN_ADVANCE" && m.approvalStatus === "APPROVED" && !(m.details as Record<string, unknown> | undefined)?.apxPoNumber) {
        await note("purchase", { ...base, type: "after_approval", message: `${s.name}: Token advance approved — PO raised in APX and record the APX PO number.`, createdAt: approvedAt ?? ago(-1) });
      }
    }

    const modules = await prisma.storeModule.findMany({ where: { storeId: store.id } });
    const overallStatus = computeOverallStatus({ overallStatus: null, keyHandoverDate: store.keyHandoverDate, actualLaunchDate: store.actualLaunchDate }, modules);
    await prisma.store.update({ where: { id: store.id }, data: { overallStatus } });
    console.log(`${s.code.padEnd(16)} ${s.city.padEnd(10)} → ${overallStatus ?? "(location filing)"}`);
  }
  console.log(`\nSeeded ${templates.length} launch steps, ${USERS.length} demo users, ${STORES.length} demo stores.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
