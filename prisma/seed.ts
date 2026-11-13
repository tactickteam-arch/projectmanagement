/**
 * Development / demo seed (spec instruction 4): fictional sample stores in different Indian
 * states and stages, so the dashboard can be tested. Everything is clearly labelled "Demo";
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
import { MODULE_DEFINITIONS } from "../src/modules";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data with NODE_ENV=production");
const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword || seedPassword.length < 8) throw new Error("SEED_PASSWORD must be set in .env (at least 8 characters)");

const prisma = createPrismaClient();
const today = todayInIndia();
const d = (days: number) => addDays(today, days);
const ago = (days: number, hour = 11) => new Date(addDays(today, days).getTime() + (hour - 5.5) * 3600_000);

// ---------- people ----------
const USERS = [
  { key: "hq", email: "hq.admin@sangeetha.test", name: "HQ Admin (demo)", role: "SUPER_ADMIN" as const, regionStates: [] as string[] },
  { key: "rm", email: "rm.south@sangeetha.test", name: "Kavya Nair (demo Regional Manager)", role: "REGIONAL_MANAGER" as const, regionStates: ["KA", "KL", "TN", "TG"] },
  { key: "arjun", email: "owner.arjun@sangeetha.test", name: "Arjun Rao (demo)", role: "STORE_OWNER" as const, regionStates: [] },
  { key: "meera", email: "owner.meera@sangeetha.test", name: "Meera Iyer (demo)", role: "STORE_OWNER" as const, regionStates: [] },
  { key: "rahul", email: "owner.rahul@sangeetha.test", name: "Rahul Deshmukh (demo)", role: "STORE_OWNER" as const, regionStates: [] },
  { key: "fatima", email: "owner.fatima@sangeetha.test", name: "Fatima Shaikh (demo)", role: "STORE_OWNER" as const, regionStates: [] },
];
type UserKey = (typeof USERS)[number]["key"];

// ---------- module seeds ----------
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
  completedDaysAgo?: number;
  photos?: number; // generated sample photos (defaults to the module minimum when Completed)
  comments?: { by: UserKey; text: string; daysAgo: number }[];
};

const approved = (x: Omit<ModuleSeed, "status" | "approvalStatus"> = {}): ModuleSeed => ({ status: "COMPLETED", approvalStatus: "APPROVED", ...x });
const pending = (x: Omit<ModuleSeed, "status" | "approvalStatus"> = {}): ModuleSeed => ({ status: "COMPLETED", approvalStatus: "PENDING", ...x });

const LOCATION = (rent: number, footfall: number) =>
  approved({
    vendorName: "Demo Property Consultants",
    estCost: 50_000,
    actualCost: 45_000,
    details: {
      landlordName: "Demo Landlord",
      landlordPhone: "9000000000",
      monthlyRent: rent,
      securityDeposit: rent * 10,
      lockInMonths: 36,
      leaseTenureYears: 9,
      yearlyEscalationPct: 5,
      frontageWidthFt: 24,
      footfallRating: footfall,
      nearbyCompetitors: ["Demo competitor A", "Demo competitor B"],
      locationApprovedByHq: true,
    },
  });
const TOKEN = (amount: number) =>
  approved({
    estCost: amount,
    actualCost: amount,
    details: { amount, paymentMode: "NEFT", utrOrChequeNo: "DEMO-UTR-000123", rentAgreementStatus: "Registered", rentFreeFitoutDays: 30 },
  });
const HANDOVER = (): ModuleSeed => ({ status: "COMPLETED", details: { receivedBy: "Store owner (demo)", premisesCondition: "Good", repairNotes: null } });
const ELECTRICAL = (x: Partial<ModuleSeed> = {}) =>
  approved({
    vendorName: "Demo Electricals",
    estCost: 350_000,
    actualCost: 372_000,
    details: { sanctionedLoadKw: 25, newMeterOrLoadEnhancement: true, distributionBoardInstalled: true, earthingDone: true, upsInverterBackup: true, powerPoints: 40, lanPoints: 12, cctvCablingDone: true, electricalSafetyCheckDone: true },
    ...x,
  });
const SIGNAGE = (x: Partial<ModuleSeed> = {}) =>
  approved({ vendorName: "Demo Signage Co.", estCost: 280_000, actualCost: 265_000, details: { boardType: "LED", widthFt: 24, heightFt: 4, designApprovedByHq: true, landlordPermission: true, illuminationWorking: true }, ...x });
const AC = (x: Partial<ModuleSeed> = {}) =>
  approved({ vendorName: "Demo Cooling", estCost: 420_000, actualCost: 405_000, details: { acType: "Cassette", units: 4, totalTonnage: 8, brand: "Demo brand" }, ...x });
const IT = (x: Partial<ModuleSeed> = {}) =>
  approved({
    vendorName: "Demo IT Services",
    estCost: 180_000,
    actualCost: 196_500,
    details: { internetProvider: "Demo ISP", speedMbps: 200, backupLine: true, posPcs: 3, printers: 2, barcodeScanners: 3, cctvCameras: 8, nvrInstalled: true, remoteViewingEnabled: true, billingSoftwareInstalled: true, gstLinked: true, testBillDone: true },
    ...x,
  });
const BRANDING = (x: Partial<ModuleSeed> = {}) =>
  approved({
    vendorName: "Demo Brand Fixtures",
    estCost: 600_000,
    actualCost: 640_000,
    details: {
      brandingItems: ["Wall graphics", "Display fixtures", "Demo tables", "Posters", "Window vinyl"].map((n, i) => ({ itemName: n, quantity: [6, 4, 3, 12, 2][i], received: true, installed: true })),
      brandPartnerZones: ["Samsung", "Apple", "Vivo", "Xiaomi"],
    },
    ...x,
  });

type StoreSeed = {
  code: string;
  name: string;
  state: string;
  city: string;
  area: string;
  pincode: string;
  lat: number;
  lng: number;
  storeType: "OWN" | "FRANCHISE";
  carpetAreaSqft: number;
  floor: "GROUND" | "FIRST" | "OTHER";
  owner: UserKey;
  createdDaysAgo: number;
  handoverDaysAgo: number | null;
  targetLaunch?: Date | null;
  launchedDaysAgo?: number;
  modules: Partial<Record<string, ModuleSeed>>;
};

const ALL_APPROVED = (): Partial<Record<string, ModuleSeed>> => ({
  STORE_LOCATION: LOCATION(150_000, 4),
  TOKEN_ADVANCE: TOKEN(500_000),
  KEY_HANDOVER: HANDOVER(),
  ELECTRICAL_IT_WIRING: ELECTRICAL(),
  EXTERNAL_SIGNAGE: SIGNAGE(),
  AIR_CONDITIONING: AC(),
  IT_WORKS: IT(),
  INSHOP_BRANDING: BRANDING(),
});

const STORES: StoreSeed[] = [
  {
    code: "SGM-KA-BLR-0001", name: "Demo Store – Jayanagar", state: "KA", city: "Bengaluru", area: "Jayanagar 4th Block", pincode: "560011",
    lat: 12.925, lng: 77.5938, storeType: "OWN", carpetAreaSqft: 1500, floor: "GROUND", owner: "arjun", createdDaysAgo: 70, handoverDaysAgo: 20,
    modules: {
      STORE_LOCATION: LOCATION(165_000, 5),
      TOKEN_ADVANCE: TOKEN(600_000),
      KEY_HANDOVER: HANDOVER(),
      ELECTRICAL_IT_WIRING: ELECTRICAL({ actualStart: d(-20), actualEnd: d(-11), completedDaysAgo: 10 }),
      EXTERNAL_SIGNAGE: pending({ vendorName: "Demo Signage Co.", estCost: 280_000, actualCost: 265_000, actualStart: d(-16), actualEnd: d(-9), completedDaysAgo: 2, details: { boardType: "LED", widthFt: 24, heightFt: 4, designApprovedByHq: true, landlordPermission: true, municipalPermitNo: "DEMO/BBMP/2026/114", illuminationWorking: true } }),
      AIR_CONDITIONING: {
        status: "IN_PROGRESS", approvalStatus: "REJECTED", vendorName: "Demo Cooling", estCost: 420_000, actualCost: 455_000, actualStart: d(-12),
        approvalComment: "Tonnage installed (6 T) is lower than the approved layout (8 T). Please add the missing unit and re-submit with photos.",
        details: { acType: "Cassette", units: 3, totalTonnage: 6, brand: "Demo brand" }, photos: 1,
        comments: [
          { by: "hq", text: "Tonnage installed (6 T) is lower than the approved layout (8 T). Please add the missing unit and re-submit with photos.", daysAgo: 3 },
          { by: "arjun", text: "Noted. The fourth unit is arriving on Friday; installer booked for Saturday.", daysAgo: 2 },
        ],
      },
      IT_WORKS: {
        status: "BLOCKED", vendorName: "Demo ISP", estCost: 180_000, actualStart: d(-9),
        blockerReason: "Internet provider waiting for landlord permission to lay fibre through the common duct.",
        comments: [{ by: "arjun", text: "Landlord's office says the NOC will be signed this week.", daysAgo: 1 }],
      },
    },
  },
  {
    code: "SGM-TN-CHE-0002", name: "Demo Store – T. Nagar", state: "TN", city: "Chennai", area: "T. Nagar", pincode: "600017",
    lat: 13.0418, lng: 80.2341, storeType: "FRANCHISE", carpetAreaSqft: 1200, floor: "GROUND", owner: "meera", createdDaysAgo: 30, handoverDaysAgo: null, targetLaunch: d(55),
    modules: {
      STORE_LOCATION: LOCATION(140_000, 5),
      TOKEN_ADVANCE: pending({ estCost: 500_000, actualCost: 500_000, actualStart: d(-8), actualEnd: d(-5), completedDaysAgo: 4, details: { amount: 500_000, paymentMode: "RTGS", utrOrChequeNo: "DEMO-UTR-778812", rentAgreementStatus: "Signed", rentFreeFitoutDays: 45 } }),
    },
  },
  {
    code: "SGM-TG-HYD-0003", name: "Demo Store – Kukatpally", state: "TG", city: "Hyderabad", area: "Kukatpally", pincode: "500072",
    lat: 17.4849, lng: 78.4138, storeType: "FRANCHISE", carpetAreaSqft: 1100, floor: "FIRST", owner: "meera", createdDaysAgo: 90, handoverDaysAgo: 34,
    modules: ALL_APPROVED(),
  },
  {
    code: "SGM-MH-PUN-0004", name: "Demo Store – Kothrud", state: "MH", city: "Pune", area: "Kothrud", pincode: "411038",
    lat: 18.5074, lng: 73.8077, storeType: "OWN", carpetAreaSqft: 1300, floor: "GROUND", owner: "rahul", createdDaysAgo: 110, handoverDaysAgo: 45, launchedDaysAgo: 5,
    modules: ALL_APPROVED(),
  },
  {
    code: "SGM-KL-KOC-0005", name: "Demo Store – Edappally", state: "KL", city: "Kochi", area: "Edappally", pincode: "682024",
    lat: 10.0261, lng: 76.3083, storeType: "OWN", carpetAreaSqft: 900, floor: "GROUND", owner: "arjun", createdDaysAgo: 21, handoverDaysAgo: null,
    modules: {
      STORE_LOCATION: LOCATION(85_000, 4),
      TOKEN_ADVANCE: { status: "IN_PROGRESS", actualStart: d(-3), estCost: 300_000, details: { amount: 300_000, rentAgreementStatus: "Draft" } },
    },
  },
  {
    code: "SGM-WB-KOL-0006", name: "Demo Store – Salt Lake", state: "WB", city: "Kolkata", area: "Salt Lake Sector V", pincode: "700091",
    lat: 22.5726, lng: 88.4339, storeType: "FRANCHISE", carpetAreaSqft: 1000, floor: "GROUND", owner: "fatima", createdDaysAgo: 40, handoverDaysAgo: 1,
    modules: { STORE_LOCATION: LOCATION(120_000, 4), TOKEN_ADVANCE: TOKEN(450_000), KEY_HANDOVER: HANDOVER() },
  },
  {
    code: "SGM-GJ-AMD-0007", name: "Demo Store – Vastrapur", state: "GJ", city: "Ahmedabad", area: "Vastrapur", pincode: "380015",
    lat: 23.0395, lng: 72.5293, storeType: "OWN", carpetAreaSqft: 1400, floor: "GROUND", owner: "rahul", createdDaysAgo: 55, handoverDaysAgo: 12,
    modules: {
      STORE_LOCATION: LOCATION(130_000, 4),
      TOKEN_ADVANCE: TOKEN(550_000),
      KEY_HANDOVER: HANDOVER(),
      ELECTRICAL_IT_WIRING: pending({ vendorName: "Demo Power Works", estCost: 330_000, actualCost: 318_000, actualStart: d(-12), actualEnd: d(-3), completedDaysAgo: 3, details: { sanctionedLoadKw: 20, earthingDone: true, distributionBoardInstalled: true, powerPoints: 36, lanPoints: 10 } }),
      EXTERNAL_SIGNAGE: { status: "IN_PROGRESS", vendorName: "Demo Signage Co.", estCost: 260_000, actualStart: d(-8), details: { boardType: "ACP", widthFt: 20, heightFt: 4, landlordPermission: true } },
    },
  },
  {
    code: "SGM-UP-LKO-0008", name: "Demo Store – Gomti Nagar", state: "UP", city: "Lucknow", area: "Gomti Nagar", pincode: "226010",
    lat: 26.8467, lng: 80.9462, storeType: "OWN", carpetAreaSqft: 1100, floor: "FIRST", owner: "arjun", createdDaysAgo: 6, handoverDaysAgo: null,
    modules: { STORE_LOCATION: { status: "IN_PROGRESS", actualStart: d(-5), details: { landlordName: "Demo Landlord", monthlyRent: 95_000, frontageWidthFt: 18, footfallRating: 3 } } },
  },
];

// ---------- sample photos ----------
const LABELS: Record<string, string> = {
  STORE_LOCATION: "Frontage", TOKEN_ADVANCE: "Receipt", KEY_HANDOVER: "Handover", EXTERNAL_SIGNAGE: "Signage board",
  ELECTRICAL_IT_WIRING: "Distribution board", AIR_CONDITIONING: "AC unit", IT_WORKS: "Billing counter", INSHOP_BRANDING: "Final store",
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
  // 1. Module templates from src/modules (config files are the defaults).
  for (const def of MODULE_DEFINITIONS) {
    const data = {
      displayName: def.displayName,
      sortOrder: def.sortOrder,
      defaultStartOffsetDays: def.defaultStartOffsetDays,
      defaultDurationDays: def.defaultDurationDays,
      fieldSchema: def.fields as unknown as Prisma.InputJsonArray,
      minPhotos: def.minPhotos,
      isMilestone: def.phase === "milestone",
      photoTag: def.photoTag ?? null,
    };
    await prisma.moduleTemplate.upsert({ where: { moduleType: def.moduleType }, create: { moduleType: def.moduleType, ...data }, update: data });
  }
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
      update: { name: u.name, role: u.role, regionStates: u.regionStates, passwordHash, isActive: true },
    });
    ids[key] = user.id;
  }

  // 4. Stores, modules, photos, comments, activity
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
      // Approved fit-out modules without explicit dates: finish within their planned window.
      const actualStart = m.actualStart ?? (m.status === "COMPLETED" && p ? p.plannedStart : undefined);
      const actualEnd = m.actualEnd ?? (m.status === "COMPLETED" && p ? addDays(p.plannedEnd, -1) : t.moduleType === "KEY_HANDOVER" && handover ? handover : undefined);
      const decided = m.approvalStatus === "APPROVED" || m.approvalStatus === "REJECTED";
      const completedAt = m.status === "COMPLETED" ? ago(-(m.completedDaysAgo ?? (actualEnd ? Math.max(1, -Math.round((actualEnd.getTime() - today.getTime()) / 864e5)) : 20)), 16) : null;

      const mod = await prisma.storeModule.create({
        data: {
          storeId: store.id, moduleType: t.moduleType, status: m.status, approvalStatus: m.approvalStatus ?? "PENDING",
          approvalComment: m.approvalComment ?? null, approvedById: decided ? ids.hq : null,
          approvedAt: decided ? (m.approvalStatus === "REJECTED" ? ago(-3, 15) : completedAt ? new Date(completedAt.getTime() + 864e5) : null) : null,
          blockerReason: m.blockerReason ?? null, plannedStart: p?.plannedStart ?? null, plannedEnd: p?.plannedEnd ?? null,
          actualStart: actualStart ?? null, actualEnd: actualEnd ?? null, vendorName: m.vendorName ?? null, vendorPhone: m.vendorPhone ?? null,
          estCost: m.estCost ?? null, actualCost: m.actualCost ?? null, remarks: m.remarks ?? null, details: m.details ?? {},
          completedAt, updatedById: ids[s.owner],
        },
      });

      // Sample photos so Completed modules satisfy the photo rule.
      const photoCount = m.photos ?? (m.status === "COMPLETED" ? t.minPhotos : 0);
      for (let n = 1; n <= photoCount; n++) {
        const key = `${store.id}/${mod.id}/${randomUUID()}.svg`;
        await prisma.fileBlob.create({ data: { key, data: new Uint8Array(samplePhotoSvg(s.name, LABELS[t.moduleType] ?? t.displayName, n, hue)) } });
        const tag = t.photoTag ?? (t.moduleType === "STORE_LOCATION" ? "photo_frontage" : "photo_after");
        await prisma.attachment.create({
          data: { storeModuleId: mod.id, fileUrl: key, fileType: "image/svg+xml", fileName: `sample-${(LABELS[t.moduleType] ?? "photo").toLowerCase().replace(/\s+/g, "-")}-${n}.svg`, sizeBytes: 1200, tag, uploadedById: ids[s.owner], uploadedAt: completedAt ?? ago(-1) },
        });
      }
      hue = (hue + 23) % 360;

      if (completedAt && t.moduleType !== "KEY_HANDOVER") {
        await prisma.activityLog.create({ data: { storeId: store.id, storeModuleId: mod.id, userId: ids[s.owner], action: "module.updated", oldValue: { status: "IN_PROGRESS" }, newValue: { status: "COMPLETED" }, createdAt: completedAt } });
      }
      if (decided) {
        await prisma.activityLog.create({
          data: { storeId: store.id, storeModuleId: mod.id, userId: ids.hq, action: m.approvalStatus === "APPROVED" ? "module.approved" : "module.rejected", newValue: { comment: m.approvalComment ?? null }, createdAt: m.approvalStatus === "REJECTED" ? ago(-3, 15) : new Date((completedAt ?? ago(-5)).getTime() + 864e5) },
        });
      }
      if (t.moduleType === "KEY_HANDOVER" && handover) {
        await prisma.activityLog.create({ data: { storeId: store.id, storeModuleId: mod.id, userId: ids[s.owner], action: "key_handover.recorded", newValue: { keyHandoverDate: handover.toISOString().slice(0, 10), receivedBy: "Store owner (demo)", premisesCondition: "Good" }, createdAt: ago(-(s.handoverDaysAgo as number), 17) } });
      }
      for (const c of m.comments ?? []) {
        await prisma.comment.create({ data: { storeModuleId: mod.id, userId: ids[c.by], text: c.text, createdAt: ago(-c.daysAgo, 14) } });
      }
      if (m.status === "BLOCKED") {
        await prisma.notification.create({ data: { userId: ids.hq, type: "module_blocked", message: `${s.name}: ${t.displayName} is Blocked — ${m.blockerReason}`, storeId: store.id, storeModuleId: mod.id, createdAt: ago(-2) } });
      }
      if (m.approvalStatus === "PENDING" && m.status === "COMPLETED" && t.moduleType !== "KEY_HANDOVER") {
        await prisma.notification.create({ data: { userId: ids.hq, type: "module_completed", message: `${s.name}: ${t.displayName} marked Completed — waiting for HQ approval.`, storeId: store.id, storeModuleId: mod.id, createdAt: completedAt ?? ago(-1) } });
      }
      if (m.approvalStatus === "REJECTED") {
        await prisma.notification.create({ data: { userId: ids[s.owner], type: "module_rejected", message: `${s.name}: ${t.displayName} was rejected by HQ — ${m.approvalComment}`, storeId: store.id, storeModuleId: mod.id, createdAt: ago(-3, 15) } });
      }
    }

    const modules = await prisma.storeModule.findMany({ where: { storeId: store.id } });
    const overallStatus = computeOverallStatus({ overallStatus: null, keyHandoverDate: store.keyHandoverDate, actualLaunchDate: store.actualLaunchDate }, modules);
    await prisma.store.update({ where: { id: store.id }, data: { overallStatus } });
    console.log(`${s.code.padEnd(16)} ${s.city.padEnd(10)} → ${overallStatus ?? "(not yet finalised)"}`);
  }
  console.log(`\nSeeded ${templates.length} module templates, ${USERS.length} demo users, ${STORES.length} demo stores.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
