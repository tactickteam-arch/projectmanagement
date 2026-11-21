import "server-only";
import type { ModuleStatus, OverallStatus, Prisma } from "@/generated/prisma/client";
import { canViewStore, storeScope, type AccessSubject } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { HIDDEN_VALUE } from "@/lib/teams";
import { daysBetween, formatDateOnly, todayInIndia } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { notFound as nextNotFound } from "next/navigation";
import { AppError, notFound } from "@/lib/errors";
import { stateName } from "@/lib/india-states";
import { missingBeforeComplete, missingPrerequisites } from "@/lib/module-rules";
import { ragRows } from "@/lib/rag";
import { acRequirement, requiredLoadKw } from "@/lib/sop-rules";
import { computeProgressPercent, countDone, daysOverdue, flowModules, isDone, isOverdue, pendingGates, TOTAL_STEPS } from "@/lib/status";
import { getModuleDefinition, MODULE_TYPES, moduleOrder, STAGE_COLUMNS } from "@/modules";
import type { AfterAction, DoneBy, FieldDef, StepGroup, StoreSource } from "@/modules/types";

const num = (d: Prisma.Decimal | null | undefined) => (d === null || d === undefined ? null : Number(d));
const iso = (d: Date | null | undefined) => (d ? formatDateOnly(d) : null);

export interface StoreFilters {
  q?: string;
  state?: string;
  city?: string;
  status?: OverallStatus | "NONE";
  ownerId?: string;
  launchMonth?: string; // YYYY-MM (target launch, or actual launch once launched)
  sort?: "code" | "name" | "progress" | "launch" | "overdue";
}

const storeSelect = {
  id: true,
  storeCode: true,
  name: true,
  state: true,
  city: true,
  area: true,
  lat: true,
  lng: true,
  overallStatus: true,
  keyHandoverDate: true,
  expectedKeyDate: true,
  targetLaunchDate: true,
  actualLaunchDate: true,
  ownerId: true,
  owner: { select: { id: true, name: true } },
  modules: {
    select: { id: true, moduleType: true, status: true, approvalStatus: true, details: true, plannedEnd: true, estCost: true, actualCost: true },
  },
} satisfies Prisma.StoreSelect;

type StoreRow = Prisma.StoreGetPayload<{ select: typeof storeSelect }>;

export interface GridCell {
  moduleId: string;
  moduleType: string;
  status: ModuleStatus;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  done: boolean;
  /** Approved, waiting for a gating record (e.g. HO payment). */
  awaitingRecord: boolean;
  overdue: boolean;
  daysOverdue: number;
}

/** One cell per SOP stage column of the dashboard grid. */
export interface StageCell {
  key: string;
  done: number;
  total: number;
  state: "done" | "progress" | "blocked" | "notstarted" | "pending";
  overdue: number;
  firstOpen: string | null;
}

export interface StoreSummary {
  id: string;
  storeCode: string;
  name: string;
  state: string;
  city: string;
  area: string | null;
  lat: number | null;
  lng: number | null;
  ownerId: string;
  ownerName: string;
  overallStatus: OverallStatus | null;
  progressPercent: number;
  approvedCount: number;
  totalSteps: number;
  keyHandoverDate: string | null;
  expectedKeyDate: string | null;
  daysSinceHandover: number | null;
  targetLaunchDate: string | null;
  actualLaunchDate: string | null;
  overdueCount: number;
  blockedCount: number;
  pendingApprovalCount: number;
  estCost: number;
  actualCost: number;
  cells: GridCell[];
  stages: StageCell[];
}

function summarise(s: StoreRow, today: Date): StoreSummary {
  const flow = flowModules(s.modules);
  const cells: GridCell[] = [...flow]
    .sort((a, b) => moduleOrder(a.moduleType) - moduleOrder(b.moduleType))
    .map((m) => ({
      moduleId: m.id,
      moduleType: m.moduleType,
      status: m.status,
      approvalStatus: m.approvalStatus,
      done: isDone(m),
      awaitingRecord: m.status === "COMPLETED" && m.approvalStatus === "APPROVED" && !isDone(m),
      overdue: isOverdue(m.plannedEnd, m.status, today),
      daysOverdue: daysOverdue(m.plannedEnd, m.status, today),
    }));
  const stages: StageCell[] = STAGE_COLUMNS.map((c) => {
    const cs = cells.filter((x) => c.types.includes(x.moduleType));
    const done = cs.filter((x) => x.done).length;
    const state: StageCell["state"] =
      cs.length > 0 && done === cs.length
        ? "done"
        : cs.some((x) => x.status === "BLOCKED")
          ? "blocked"
          : cs.some((x) => (x.status === "COMPLETED" && !x.done) || x.awaitingRecord)
            ? "pending"
            : cs.some((x) => x.status !== "NOT_STARTED")
              ? "progress"
              : "notstarted";
    return { key: c.key, done, total: cs.length, state, overdue: cs.filter((x) => x.overdue).length, firstOpen: cs.find((x) => !x.done)?.moduleType ?? null };
  });
  const launched = s.actualLaunchDate !== null;
  return {
    id: s.id,
    storeCode: s.storeCode,
    name: s.name,
    state: s.state,
    city: s.city,
    area: s.area,
    lat: num(s.lat),
    lng: num(s.lng),
    ownerId: s.ownerId,
    ownerName: s.owner.name,
    overallStatus: s.overallStatus,
    progressPercent: computeProgressPercent(s.modules),
    approvedCount: countDone(s.modules),
    totalSteps: TOTAL_STEPS,
    keyHandoverDate: iso(s.keyHandoverDate),
    expectedKeyDate: iso(s.expectedKeyDate),
    daysSinceHandover: s.keyHandoverDate && !launched ? daysBetween(s.keyHandoverDate, today) : null,
    targetLaunchDate: iso(s.targetLaunchDate),
    actualLaunchDate: iso(s.actualLaunchDate),
    overdueCount: cells.filter((c) => c.overdue).length,
    blockedCount: cells.filter((c) => c.status === "BLOCKED").length,
    pendingApprovalCount: cells.filter((c) => c.status === "COMPLETED" && c.approvalStatus === "PENDING").length,
    estCost: flow.reduce((t, m) => t + (num(m.estCost) ?? 0), 0),
    actualCost: flow.reduce((t, m) => t + (num(m.actualCost) ?? 0), 0),
    cells,
    stages,
  };
}

/** Stores visible to the user (role scope always applied), with filters and sorting. */
export async function listStoreSummaries(user: AccessSubject, f: StoreFilters = {}): Promise<StoreSummary[]> {
  const today = todayInIndia();
  const and: Prisma.StoreWhereInput[] = [storeScope(user)];
  if (f.q) and.push({ OR: [{ storeCode: { contains: f.q, mode: "insensitive" } }, { name: { contains: f.q, mode: "insensitive" } }] });
  if (f.state) and.push({ state: f.state });
  if (f.city) and.push({ city: { equals: f.city, mode: "insensitive" } });
  if (f.status === "NONE") and.push({ overallStatus: null });
  else if (f.status) and.push({ overallStatus: f.status });
  if (f.ownerId) and.push({ ownerId: f.ownerId });
  if (f.launchMonth && /^\d{4}-\d{2}$/.test(f.launchMonth)) {
    const [y, m] = f.launchMonth.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1));
    const to = new Date(Date.UTC(y, m, 1));
    and.push({
      OR: [
        { actualLaunchDate: { gte: from, lt: to } },
        { actualLaunchDate: null, targetLaunchDate: { gte: from, lt: to } },
      ],
    });
  }
  const rows = await prisma.store.findMany({ where: { AND: and }, select: storeSelect, orderBy: { storeCode: "asc" } });
  const list = rows.map((r) => summarise(r, today));
  switch (f.sort) {
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "progress":
      return list.sort((a, b) => b.progressPercent - a.progressPercent);
    case "launch":
      return list.sort((a, b) => (a.targetLaunchDate ?? "9999").localeCompare(b.targetLaunchDate ?? "9999"));
    case "overdue":
      return list.sort((a, b) => b.overdueCount - a.overdueCount || b.blockedCount - a.blockedCount);
    default:
      return list;
  }
}

export interface DashboardSummary {
  pipeline: number;
  launchedThisMonth: number;
  delayedStores: number;
  blockedStores: number;
  estSpend: number;
  actualSpend: number;
  pendingApprovals: number;
  byStatus: { status: OverallStatus | "NONE"; count: number }[];
}

/** Summary cards: computed from all stores in the user's scope. */
export async function dashboardSummary(user: AccessSubject): Promise<DashboardSummary> {
  const all = await listStoreSummaries(user);
  const today = todayInIndia();
  const month = formatDateOnly(today).slice(0, 7);
  const active = all.filter((s) => s.overallStatus !== "LAUNCHED" && s.overallStatus !== "DROPPED");
  const counts = new Map<OverallStatus | "NONE", number>();
  for (const s of all) counts.set(s.overallStatus ?? "NONE", (counts.get(s.overallStatus ?? "NONE") ?? 0) + 1);
  return {
    pipeline: active.length,
    launchedThisMonth: all.filter((s) => s.actualLaunchDate?.startsWith(month)).length,
    delayedStores: active.filter((s) => s.overdueCount > 0).length,
    blockedStores: active.filter((s) => s.blockedCount > 0).length,
    estSpend: all.reduce((t, s) => t + s.estCost, 0),
    actualSpend: all.reduce((t, s) => t + s.actualCost, 0),
    pendingApprovals: all.reduce((t, s) => t + s.pendingApprovalCount, 0),
    byStatus: [...counts.entries()].map(([status, count]) => ({ status, count })),
  };
}

const HIDDEN = HIDDEN_VALUE;

function storeValueOf(store: { name: string; storeCode: string; state: string; address: string | null; carpetAreaSqft: number | null }, src: StoreSource): string | number | null {
  if (src === "state") return stateName(store.state);
  return store[src];
}

/** Everything the store detail page needs. Returns 404 if the user cannot see the store. KYC and
 * bank values are replaced by "hidden" for users who may not see them (can.viewSensitive). */
export async function getStoreDetail(user: AccessSubject, storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      owner: { select: { id: true, name: true, email: true, phone: true } },
      modules: {
        include: {
          attachments: { orderBy: { uploadedAt: "asc" }, select: { id: true, fileType: true, fileName: true, tag: true, sizeBytes: true, uploadedAt: true } },
          approvedBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
          _count: { select: { comments: true } },
        },
      },
    },
  });
  if (!store || !canViewStore(user, store)) throw notFound("Store not found");
  const templates = await prisma.moduleTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  const activity = await prisma.activityLog.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, action: true, oldValue: true, newValue: true, createdAt: true, storeModuleId: true, user: { select: { name: true } } },
  });
  const today = todayInIndia();
  const names = Object.fromEntries(templates.map((t) => [t.moduleType, t.displayName]));
  const detailsOf = (t: string) => (store.modules.find((x) => x.moduleType === t)?.details ?? {}) as Record<string, unknown>;
  const fieldsOf = (t: string) => (templates.find((x) => x.moduleType === t)?.fieldSchema ?? []) as unknown as FieldDef[];

  const modules = templates
    .map((t) => {
      const m = store.modules.find((x) => x.moduleType === t.moduleType);
      const def = getModuleDefinition(t.moduleType);
      if (!m || !def) return null;
      const fields = t.fieldSchema as unknown as FieldDef[];
      const seeSensitive = can.viewSensitive(user, store);
      const raw = (m.details ?? {}) as Record<string, unknown>;
      const details: Record<string, unknown> = { ...raw };
      for (const f of fields) {
        if (f.fromStore) details[f.key] = storeValueOf(store, f.fromStore);
        else if (f.prefillFrom && (details[f.key] === undefined || details[f.key] === null)) {
          const v = detailsOf(f.prefillFrom.moduleType)[f.prefillFrom.key];
          if (v !== undefined && v !== null) details[f.key] = v;
        }
        if (f.sensitive && !seeSensitive && details[f.key] !== undefined && details[f.key] !== null) details[f.key] = HIDDEN;
      }
      const afterActions = (def.afterApproval ?? []).map((a: AfterAction) => ({
        ...a,
        record: (raw[a.key] ?? null) as (Record<string, unknown> & { recordedBy?: string; recordedAt?: string }) | null,
        canRecord: can.recordAfterApproval(user, store, a.teams),
      }));
      let review: { title: string; fromType: string; items: { field: FieldDef; value: unknown }[] } | null = null;
      if (def.reviewFrom) {
        const src = detailsOf(def.reviewFrom.moduleType);
        const srcSee = can.viewSensitive(user, store);
        const fieldsSrc = fieldsOf(def.reviewFrom.moduleType);
        review = {
          title: def.reviewFrom.title,
          fromType: def.reviewFrom.moduleType,
          items: def.reviewFrom.keys
            .map((k) => fieldsSrc.find((f) => f.key === k))
            .filter((f): f is FieldDef => f !== undefined)
            .map((f) => ({ field: f, value: f.sensitive && !srcSee && src[f.key] != null ? HIDDEN : (src[f.key] ?? null) })),
        };
      }
      const missing = missingPrerequisites(t.moduleType, store.modules);
      const beforeComplete = missingBeforeComplete(t.moduleType, store.modules);
      return {
        id: m.id,
        moduleType: m.moduleType,
        displayName: t.displayName,
        shortLabel: def.shortLabel,
        stage: def.stage,
        code: def.code,
        group: def.group as StepGroup,
        summary: def.summary,
        doneBy: def.doneBy as DoneBy,
        doneByLabel: def.doneByLabel,
        notes: def.notes ?? [],
        systemAction: def.systemAction ?? null,
        afterActions,
        pendingGates: pendingGates(m),
        review,
        checks: def.checks ?? [],
        requireActualEnd: def.requireActualEnd ?? false,
        editTeams: t.editTeams,
        supportTeams: def.supportTeams ?? [],
        approverTeam: t.approverTeam,
        approvalNote: def.approvalNote,
        requires: def.requires.map((r) => names[r] ?? r),
        completeAfter: (def.completeAfter ?? []).map((r) => ({ moduleType: r, name: names[r] ?? r, done: !beforeComplete.includes(r) })),
        waitingFor: missing.map((r) => names[r] ?? r),
        done: isDone(m),
        canSeeSensitive: seeSensitive,
        minPhotos: t.minPhotos,
        photoTag: t.photoTag,
        fields,
        status: m.status,
        approvalStatus: m.approvalStatus,
        approvalComment: m.approvalComment,
        approvedBy: m.approvedBy?.name ?? null,
        approvedAt: m.approvedAt?.toISOString() ?? null,
        completedAt: m.completedAt?.toISOString() ?? null,
        blockerReason: m.blockerReason,
        plannedStart: iso(m.plannedStart),
        plannedEnd: iso(m.plannedEnd),
        actualStart: iso(m.actualStart),
        actualEnd: iso(m.actualEnd),
        vendorName: m.vendorName,
        vendorPhone: m.vendorPhone,
        estCost: num(m.estCost),
        actualCost: num(m.actualCost),
        remarks: m.remarks,
        details,
        updatedBy: m.updatedBy?.name ?? null,
        updatedAt: m.updatedAt.toISOString(),
        overdue: isOverdue(m.plannedEnd, m.status, today),
        daysOverdue: daysOverdue(m.plannedEnd, m.status, today),
        commentCount: m._count.comments,
        attachments: m.attachments.map((a) => ({ ...a, uploadedAt: a.uploadedAt.toISOString() })),
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const area = store.carpetAreaSqft;
  return {
    id: store.id,
    storeCode: store.storeCode,
    name: store.name,
    state: store.state,
    city: store.city,
    area: store.area,
    pincode: store.pincode,
    address: store.address,
    lat: num(store.lat),
    lng: num(store.lng),
    storeType: store.storeType,
    carpetAreaSqft: area,
    /** SOP slide 4 / 8 requirements for this store's size. */
    requirements: area ? { loadKw: requiredLoadKw(area), ac: acRequirement(area) } : null,
    floor: store.floor,
    owner: store.owner,
    ownerId: store.ownerId,
    targetLaunchDate: iso(store.targetLaunchDate),
    expectedKeyDate: iso(store.expectedKeyDate),
    keyHandoverDate: iso(store.keyHandoverDate),
    actualLaunchDate: iso(store.actualLaunchDate),
    daysSinceHandover: store.keyHandoverDate && !store.actualLaunchDate ? daysBetween(store.keyHandoverDate, today) : null,
    daysToExpectedKeys: store.expectedKeyDate && !store.keyHandoverDate ? daysBetween(today, store.expectedKeyDate) : null,
    overallStatus: store.overallStatus,
    progressPercent: computeProgressPercent(store.modules),
    approvedCount: countDone(store.modules),
    totalSteps: TOTAL_STEPS,
    createdAt: store.createdAt.toISOString(),
    modules,
    activity: activity.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), userName: a.user?.name ?? "System" })),
  };
}

/** For pages: like getStoreDetail, but renders the 404 page when the store is missing or not visible. */
export async function getStoreDetailForPage(user: AccessSubject, storeId: string) {
  try {
    return await getStoreDetail(user, storeId);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) nextNotFound();
    throw e;
  }
}

export type StoreDetail = Awaited<ReturnType<typeof getStoreDetail>>;
export type ModuleView = StoreDetail["modules"][number];

/** Approvals queue: Completed steps waiting for approval, oldest first. SuperAdmin sees every step;
 * other users see the steps their teams approve (Boss + CEO, RK, Accounts). */
/** For the menu: can this user approve any step, and how many approvals are waiting for them? */
export async function approvalsBadge(user: AccessSubject): Promise<{ canApprove: boolean; count: number }> {
  if (user.role === "STORE_OWNER") return { canApprove: false, count: 0 };
  const templates = await prisma.moduleTemplate.findMany({ select: { moduleType: true, approverTeam: true } });
  const approvable = templates
    .filter((t) => MODULE_TYPES.includes(t.moduleType) && (user.role === "SUPER_ADMIN" || (t.approverTeam !== null && (user.teams ?? []).includes(t.approverTeam))))
    .map((t) => t.moduleType);
  if (approvable.length === 0) return { canApprove: false, count: 0 };
  const count = await prisma.storeModule.count({ where: { status: "COMPLETED", approvalStatus: "PENDING", moduleType: { in: approvable }, store: storeScope(user) } });
  return { canApprove: true, count };
}

export async function approvalsQueue(user: AccessSubject) {
  const templates = await prisma.moduleTemplate.findMany({ select: { moduleType: true, displayName: true, approverTeam: true } });
  const approvable = templates
    .filter((t) => MODULE_TYPES.includes(t.moduleType) && (user.role === "SUPER_ADMIN" || (t.approverTeam !== null && (user.teams ?? []).includes(t.approverTeam))))
    .map((t) => t.moduleType);
  if (approvable.length === 0) return [];
  const rows = await prisma.storeModule.findMany({
    where: { status: "COMPLETED", approvalStatus: "PENDING", moduleType: { in: approvable }, store: storeScope(user) },
    orderBy: [{ completedAt: "asc" }, { updatedAt: "asc" }],
    select: {
      id: true,
      moduleType: true,
      completedAt: true,
      updatedAt: true,
      actualCost: true,
      _count: { select: { attachments: true } },
      updatedBy: { select: { name: true } },
      store: { select: { id: true, storeCode: true, name: true, city: true, state: true } },
    },
  });
  return rows.map((r) => {
    const t = templates.find((x) => x.moduleType === r.moduleType);
    return {
      id: r.id,
      moduleType: r.moduleType,
      displayName: t?.displayName ?? r.moduleType,
      code: getModuleDefinition(r.moduleType)?.code ?? "",
      approverTeam: t?.approverTeam ?? null,
      submittedAt: (r.completedAt ?? r.updatedAt).toISOString(),
      submittedBy: r.updatedBy?.name ?? null,
      attachments: r._count.attachments,
      actualCost: num(r.actualCost),
      store: r.store,
    };
  });
}

/** "My tasks": open steps that the user's teams fill in, plus records their teams must make after
 * an approval (HO pays the token advance, Accounts records the APX PO), across the stores they see.
 * A step is "ready" once its earlier steps are done. */
export async function myTasks(user: AccessSubject) {
  const templates = await prisma.moduleTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  const teams = user.teams ?? [];
  const mine = templates.filter((t) => MODULE_TYPES.includes(t.moduleType) && t.editTeams.some((x) => teams.includes(x))).map((t) => t.moduleType);
  const recordTypes = templates
    .filter((t) => getModuleDefinition(t.moduleType)?.afterApproval?.some((a) => a.teams.some((x) => teams.includes(x))))
    .map((t) => t.moduleType);
  if (mine.length === 0 && recordTypes.length === 0) return { teamsWithSteps: [] as string[], items: [], records: [] };
  const today = todayInIndia();
  const stores = await prisma.store.findMany({
    where: { AND: [storeScope(user), { OR: [{ overallStatus: null }, { overallStatus: { notIn: ["LAUNCHED", "DROPPED"] } }] }] },
    select: {
      id: true,
      storeCode: true,
      name: true,
      city: true,
      state: true,
      overallStatus: true,
      modules: { select: { id: true, moduleType: true, status: true, approvalStatus: true, details: true, plannedStart: true, plannedEnd: true, approvalComment: true, blockerReason: true } },
    },
    orderBy: { storeCode: "asc" },
  });
  const names = Object.fromEntries(templates.map((t) => [t.moduleType, t.displayName]));
  const storeOf = (s: (typeof stores)[number]) => ({ id: s.id, storeCode: s.storeCode, name: s.name, city: s.city, state: s.state, overallStatus: s.overallStatus });
  const items = stores.flatMap((s) =>
    s.modules
      .filter((m) => mine.includes(m.moduleType) && !(m.status === "COMPLETED" && m.approvalStatus === "APPROVED"))
      .map((m) => {
        const waitingFor = missingPrerequisites(m.moduleType, s.modules).map((r) => names[r] ?? r);
        const t = templates.find((x) => x.moduleType === m.moduleType);
        return {
          id: m.id,
          moduleType: m.moduleType,
          displayName: names[m.moduleType] ?? m.moduleType,
          code: getModuleDefinition(m.moduleType)?.code ?? "",
          sortOrder: moduleOrder(m.moduleType),
          status: m.status,
          approvalStatus: m.approvalStatus,
          approverTeam: t?.approverTeam ?? null,
          approvalComment: m.approvalComment,
          blockerReason: m.blockerReason,
          plannedStart: iso(m.plannedStart),
          plannedEnd: iso(m.plannedEnd),
          overdue: isOverdue(m.plannedEnd, m.status, today),
          daysOverdue: daysOverdue(m.plannedEnd, m.status, today),
          waitingFor,
          store: storeOf(s),
        };
      }),
  );
  items.sort((a, b) => b.daysOverdue - a.daysOverdue || (a.plannedEnd ?? "9999").localeCompare(b.plannedEnd ?? "9999") || a.sortOrder - b.sortOrder);
  const records = stores.flatMap((s) =>
    s.modules
      .filter((m) => recordTypes.includes(m.moduleType) && m.status === "COMPLETED" && m.approvalStatus === "APPROVED")
      .flatMap((m) => {
        const details = (m.details ?? {}) as Record<string, unknown>;
        return (getModuleDefinition(m.moduleType)?.afterApproval ?? [])
          .filter((a) => a.teams.some((x) => teams.includes(x)) && !details[a.key])
          .map((a) => ({ id: `${m.id}:${a.key}`, moduleId: m.id, moduleType: m.moduleType, displayName: names[m.moduleType] ?? m.moduleType, label: a.label, pendingText: a.pendingText, gate: a.gate ?? false, store: storeOf(s) }));
      }),
  );
  return {
    teamsWithSteps: [...new Set(templates.filter((t) => mine.includes(t.moduleType)).flatMap((t) => t.editTeams).filter((x) => teams.includes(x)))],
    items,
    records,
  };
}

/** Delays report: overdue steps sorted by days overdue. Steps still waiting on an earlier step are
 * marked so (the delay sits with the earlier step). */
export async function delaysReport(user: AccessSubject) {
  const today = todayInIndia();
  const stores = await prisma.store.findMany({
    where: { AND: [storeScope(user), { OR: [{ overallStatus: null }, { overallStatus: { notIn: ["LAUNCHED", "DROPPED"] } }] }], modules: { some: { status: { not: "COMPLETED" }, plannedEnd: { lt: today } } } },
    select: {
      id: true,
      storeCode: true,
      name: true,
      city: true,
      state: true,
      owner: { select: { name: true } },
      modules: { select: { id: true, moduleType: true, status: true, approvalStatus: true, details: true, plannedStart: true, plannedEnd: true, blockerReason: true, vendorName: true } },
    },
  });
  const templates = await prisma.moduleTemplate.findMany({ select: { moduleType: true, displayName: true, editTeams: true } });
  const names = Object.fromEntries(templates.map((t) => [t.moduleType, t.displayName]));
  return stores
    .flatMap((s) =>
      s.modules
        .filter((m) => MODULE_TYPES.includes(m.moduleType) && isOverdue(m.plannedEnd, m.status, today))
        .map((m) => ({
          id: m.id,
          moduleType: m.moduleType,
          displayName: names[m.moduleType] ?? m.moduleType,
          code: getModuleDefinition(m.moduleType)?.code ?? "",
          ownerTeams: templates.find((t) => t.moduleType === m.moduleType)?.editTeams ?? [],
          status: m.status,
          plannedStart: iso(m.plannedStart),
          plannedEnd: iso(m.plannedEnd),
          daysOverdue: daysOverdue(m.plannedEnd, m.status, today),
          waitingFor: missingPrerequisites(m.moduleType, s.modules).map((r) => names[r] ?? r),
          blockerReason: m.blockerReason,
          vendorName: m.vendorName,
          store: { id: s.id, storeCode: s.storeCode, name: s.name, city: s.city, state: s.state, ownerName: s.owner.name },
        })),
    )
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/** Weekly RAG rollout tracker (SOP slide 11) for the stores the user can see. */
export async function ragReport(user: AccessSubject) {
  return ragRows(storeScope(user));
}

/** Cost report: estimated vs actual per store and per step. */
export async function costReport(user: AccessSubject) {
  const rows = await prisma.storeModule.findMany({
    where: { store: storeScope(user), moduleType: { in: [...MODULE_TYPES] } },
    select: { moduleType: true, estCost: true, actualCost: true, store: { select: { id: true, storeCode: true, name: true, city: true } } },
  });
  const names = await templateNames();
  const byStore = new Map<string, { id: string; storeCode: string; name: string; city: string; est: number; actual: number; modules: Record<string, { est: number; actual: number }> }>();
  const byModule = new Map<string, { moduleType: string; displayName: string; est: number; actual: number }>();
  for (const r of rows) {
    const est = num(r.estCost) ?? 0;
    const actual = num(r.actualCost) ?? 0;
    const s = byStore.get(r.store.id) ?? { ...r.store, est: 0, actual: 0, modules: {} };
    s.est += est;
    s.actual += actual;
    s.modules[r.moduleType] = { est, actual };
    byStore.set(r.store.id, s);
    const m = byModule.get(r.moduleType) ?? { moduleType: r.moduleType, displayName: names[r.moduleType] ?? r.moduleType, est: 0, actual: 0 };
    m.est += est;
    m.actual += actual;
    byModule.set(r.moduleType, m);
  }
  return {
    stores: [...byStore.values()].sort((a, b) => a.storeCode.localeCompare(b.storeCode)),
    modules: [...byModule.values()].sort((a, b) => moduleOrder(a.moduleType) - moduleOrder(b.moduleType)),
    moduleNames: names,
  };
}

export async function templateNames(): Promise<Record<string, string>> {
  const t = await prisma.moduleTemplate.findMany({ select: { moduleType: true, displayName: true } });
  return Object.fromEntries(t.map((x) => [x.moduleType, x.displayName]));
}

export async function storeOwnersInScope(user: AccessSubject) {
  const owners = await prisma.user.findMany({
    where: { role: "STORE_OWNER", ownedStores: { some: storeScope(user) } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return owners;
}

export async function activeStoreOwners() {
  return prisma.user.findMany({ where: { role: "STORE_OWNER", isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
}
