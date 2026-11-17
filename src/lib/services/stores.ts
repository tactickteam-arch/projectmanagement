import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { diff, logActivity } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { isStateCode } from "@/lib/india-states";
import { hqRecipients, notifyUsers, teamRecipients } from "@/lib/notify";
import { computeOverallStatus, OVERALL_STATUS_LABELS } from "@/lib/status";
import { formatStoreCode, serialFromCode } from "@/lib/store-code";

type Tx = Prisma.TransactionClient;

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
  .optional()
  .nullable()
  .transform((v) => (v ? parseDateOnly(v) : null));

const masterFields = {
  name: z.string().trim().min(2, "Store name is required").max(120),
  area: optionalText(120),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "PIN code must be 6 digits")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  address: optionalText(500),
  lat: z.number().min(6).max(38).optional().nullable(),
  lng: z.number().min(68).max(98).optional().nullable(),
  storeType: z.enum(["OWN", "FRANCHISE"]).optional().nullable(),
  carpetAreaSqft: z.number().int().min(1).max(100000).optional().nullable(),
  floor: z.enum(["GROUND", "FIRST", "OTHER"]).optional().nullable(),
  targetLaunchDate: optionalDate,
};

export const CreateStoreInput = z.object({
  ...masterFields,
  state: z.string().refine(isStateCode, "Choose a state"),
  city: z.string().trim().min(2, "City is required").max(80),
  ownerId: z.uuid().optional(),
});

export const UpdateStoreInput = z.object({
  ...masterFields,
  name: masterFields.name.optional(),
  actualLaunchDate: optionalDate,
}).partial();

/** Loads a store the user may see, or throws 404 (never reveals other stores exist). */
export async function getStoreForUser(user: CurrentUser, storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || !can.viewStore(user, store)) throw notFound("Store not found");
  return store;
}

/** POST /api/stores — creates the store and one row per launch step from the templates. */
export async function createStore(user: CurrentUser, raw: unknown) {
  if (!can.createStore(user)) throw forbidden();
  const input = CreateStoreInput.parse(raw);

  let ownerId = user.id;
  if (user.role === "SUPER_ADMIN") {
    if (!input.ownerId) throw badRequest("Choose the store owner.", { ownerId: "Choose the store owner" });
    const owner = await prisma.user.findUnique({ where: { id: input.ownerId } });
    if (!owner || owner.role !== "STORE_OWNER" || !owner.isActive) throw badRequest("The selected owner is not an active store owner.");
    ownerId = owner.id;
  }

  const templates = await prisma.moduleTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  if (templates.length === 0) throw conflict("Module templates are missing. Run the database seed.");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const codes = await tx.store.findMany({ select: { storeCode: true } });
        const next = codes.reduce((max, s) => Math.max(max, serialFromCode(s.storeCode)), 0) + 1 + attempt;
        const store = await tx.store.create({
          data: {
            storeCode: formatStoreCode(input.state, input.city, next),
            name: input.name,
            state: input.state,
            city: input.city,
            area: input.area,
            pincode: input.pincode ?? null,
            address: input.address,
            lat: input.lat ?? null,
            lng: input.lng ?? null,
            storeType: input.storeType ?? null,
            carpetAreaSqft: input.carpetAreaSqft ?? null,
            floor: input.floor ?? null,
            targetLaunchDate: input.targetLaunchDate,
            ownerId,
            modules: { create: templates.map((t) => ({ moduleType: t.moduleType, updatedById: user.id })) },
          },
        });
        await logActivity(tx, { userId: user.id, storeId: store.id, action: "store.created", newValue: { storeCode: store.storeCode, name: store.name } });
        if (ownerId !== user.id) {
          await notifyUsers(tx, [ownerId], { type: "store_assigned", message: `You have been assigned a new store: ${store.name} (${store.storeCode}).`, storeId: store.id });
        }
        return store;
      });
    } catch (e) {
      if (attempt < 2 && (e as { code?: string }).code === "P2002") continue; // store code collision — retry
      throw e;
    }
  }
  throw conflict("Could not allocate a store code. Please try again.");
}

/** PATCH /api/stores/:id — master fields. State and city are fixed once the store code exists. */
export async function updateStore(user: CurrentUser, storeId: string, raw: unknown) {
  const store = await getStoreForUser(user, storeId);
  if (!can.editStoreMaster(user, store)) throw forbidden();
  const input = UpdateStoreInput.parse(raw);

  if (input.actualLaunchDate !== undefined && input.actualLaunchDate !== null && store.actualLaunchDate === null) {
    if (store.overallStatus !== "READY_FOR_LAUNCH") {
      throw badRequest("The soft launch date can be entered once every department is green (all steps done).", {
        actualLaunchDate: "Not every step is done yet",
      });
    }
  }

  const data = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Prisma.StoreUpdateInput;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.store.update({ where: { id: storeId }, data });
    const d = diff(store as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (d) await logActivity(tx, { userId: user.id, storeId, action: "store.updated", ...d });
    await recalcStoreStatus(tx, storeId, user.id);
    return updated;
  });
}

/** POST /api/stores/:id/status — HQ sets On Hold / Dropped, or resumes automatic status. */
export const StatusOverrideInput = z.object({ status: z.enum(["ON_HOLD", "DROPPED", "AUTO"]) });

export async function overrideStatus(user: CurrentUser, storeId: string, raw: unknown) {
  if (!can.overrideStatus(user)) throw forbidden();
  const store = await getStoreForUser(user, storeId);
  const { status } = StatusOverrideInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    const before = store.overallStatus;
    if (status === "AUTO") {
      await tx.store.update({ where: { id: storeId }, data: { overallStatus: null } });
      await recalcStoreStatus(tx, storeId, user.id, { force: true });
    } else {
      await tx.store.update({ where: { id: storeId }, data: { overallStatus: status } });
    }
    const after = (await tx.store.findUniqueOrThrow({ where: { id: storeId } })).overallStatus;
    await logActivity(tx, { userId: user.id, storeId, action: "store.status_override", oldValue: { overallStatus: before }, newValue: { overallStatus: after } });
    await notifyUsers(tx, [store.ownerId], {
      type: "store_status",
      message: `HQ changed ${store.name} to ${after ? OVERALL_STATUS_LABELS[after] : "automatic status"}.`,
      storeId,
    });
  });
}

/** PATCH /api/stores/:id/owner — SuperAdmin reassigns a store. */
export async function reassignOwner(user: CurrentUser, storeId: string, raw: unknown) {
  if (!can.assignStores(user)) throw forbidden();
  const store = await getStoreForUser(user, storeId);
  const { ownerId } = z.object({ ownerId: z.uuid() }).parse(raw);
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!owner || owner.role !== "STORE_OWNER" || !owner.isActive) throw badRequest("Choose an active store owner.");
  if (owner.id === store.ownerId) return;
  await prisma.$transaction(async (tx) => {
    await tx.store.update({ where: { id: storeId }, data: { ownerId } });
    await logActivity(tx, { userId: user.id, storeId, action: "store.owner_changed", oldValue: { ownerId: store.ownerId }, newValue: { ownerId, ownerName: owner.name } });
    await notifyUsers(tx, [ownerId], { type: "store_assigned", message: `You have been assigned ${store.name} (${store.storeCode}).`, storeId });
  });
}

/** Recomputes overall status from step states; notifies HQ and Sales when every department is green. */
export async function recalcStoreStatus(tx: Tx, storeId: string, userId: string | null, opts: { force?: boolean } = {}) {
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
  const modules = await tx.storeModule.findMany({ where: { storeId }, select: { moduleType: true, status: true, approvalStatus: true } });
  const next = computeOverallStatus(opts.force ? { ...store, overallStatus: null } : store, modules);
  if (next === store.overallStatus && !opts.force) return next;
  await tx.store.update({ where: { id: storeId }, data: { overallStatus: next } });
  if (next !== store.overallStatus) {
    await logActivity(tx, { userId, storeId, action: "store.status_auto", oldValue: { overallStatus: store.overallStatus }, newValue: { overallStatus: next } });
    if (next === "READY_FOR_LAUNCH") {
      const recipients = [...(await hqRecipients(tx, store.state, { includeRegional: false })), ...(await teamRecipients(tx, store, ["SALES", "STORE_OWNER"]))];
      await notifyUsers(tx, recipients, {
        type: "ready_for_launch",
        message: `${store.name} (${store.storeCode}): all departments green — ready for soft launch.`,
        storeId,
      });
    }
  }
  return next;
}
