import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { formatDateOnly } from "@/lib/dates";
import { planModulesFromHandover } from "@/lib/scheduling";
import { computeOverallStatus } from "@/lib/status";
import { KEY_HANDOVER, MODULE_DEFINITIONS, MODULE_TYPES } from "@/modules";
import type { FieldDef } from "@/modules/types";

/**
 * Brings module_templates in line with the launch-flow steps in src/modules and gives every store
 * a row for every step. Safe to re-run. HQ's changes made in Settings (schedule offsets, who edits /
 * approves, checklist items) are kept unless `reset` is set (used by the demo seed).
 * Rows of retired module types stay in the database but are no longer shown or counted.
 */
export async function syncSteps(prisma: PrismaClient, opts: { reset?: boolean; log?: (s: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const existing = await prisma.moduleTemplate.findMany();

  for (const def of MODULE_DEFINITIONS) {
    const cur = existing.find((t) => t.moduleType === def.moduleType);
    const keep = cur && !opts.reset;
    const fields: FieldDef[] = def.fields.map((f) => {
      if (f.type !== "checklist" || !keep) return f;
      const old = (cur.fieldSchema as unknown as FieldDef[]).find((x) => x.key === f.key && x.type === "checklist");
      return old?.defaultItems ? { ...f, defaultItems: old.defaultItems } : f;
    });
    const configured = keep && cur.editTeams.length > 0;
    const data = {
      displayName: def.displayName,
      sortOrder: def.sortOrder,
      defaultStartOffsetDays: keep && cur.defaultStartOffsetDays !== null ? cur.defaultStartOffsetDays : def.defaultStartOffsetDays,
      defaultDurationDays: keep && cur.defaultDurationDays !== null ? cur.defaultDurationDays : def.defaultDurationDays,
      fieldSchema: fields as unknown as Prisma.InputJsonArray,
      minPhotos: def.minPhotos,
      photoTag: def.photoTag ?? null,
      editTeams: configured ? cur.editTeams : def.editTeams,
      approverTeam: configured ? cur.approverTeam : def.approverTeam,
    };
    await prisma.moduleTemplate.upsert({ where: { moduleType: def.moduleType }, create: { moduleType: def.moduleType, ...data }, update: data });
    log(`${cur ? "updated" : "added  "} ${def.moduleType}`);
  }

  const retired = existing.filter((t) => !MODULE_TYPES.includes(t.moduleType)).map((t) => t.moduleType);
  if (retired.length) {
    await prisma.moduleTemplate.deleteMany({ where: { moduleType: { in: retired } } });
    log(`retired ${retired.join(", ")}`);
  }

  const templates = await prisma.moduleTemplate.findMany();
  const stores = await prisma.store.findMany({ select: { id: true, overallStatus: true, keyHandoverDate: true, actualLaunchDate: true, ownerId: true } });
  for (const s of stores) {
    const added = await prisma.storeModule.createMany({
      data: MODULE_TYPES.map((moduleType) => ({ storeId: s.id, moduleType, updatedById: s.ownerId })),
      skipDuplicates: true,
    });
    // Keys recorded under the earlier process (a milestone without approval): count the handover
    // as accepted and copy the date into the step, so the department tracks can start.
    if (s.keyHandoverDate) {
      const kh = await prisma.storeModule.findUnique({ where: { storeId_moduleType: { storeId: s.id, moduleType: KEY_HANDOVER } } });
      if (kh && kh.approvalStatus !== "APPROVED") {
        const details = { ...((kh.details ?? {}) as Record<string, unknown>), handoverDate: formatDateOnly(s.keyHandoverDate) };
        await prisma.storeModule.update({
          where: { id: kh.id },
          data: { status: "COMPLETED", approvalStatus: "APPROVED", approvedAt: kh.completedAt ?? new Date(), completedAt: kh.completedAt ?? new Date(), details: details as Prisma.InputJsonObject },
        });
        log(`store ${s.id}: key handover of ${formatDateOnly(s.keyHandoverDate)} marked accepted`);
      }
      // Department tracks added after the handover get their planned dates from it.
      for (const p of planModulesFromHandover(s.keyHandoverDate, templates)) {
        await prisma.storeModule.updateMany({
          where: { storeId: s.id, moduleType: p.moduleType, status: "NOT_STARTED", plannedStart: null },
          data: { plannedStart: p.plannedStart, plannedEnd: p.plannedEnd },
        });
      }
    }
    const modules = await prisma.storeModule.findMany({ where: { storeId: s.id }, select: { moduleType: true, status: true, approvalStatus: true } });
    const overallStatus = computeOverallStatus(s, modules);
    if (overallStatus !== s.overallStatus) await prisma.store.update({ where: { id: s.id }, data: { overallStatus } });
    if (added.count || overallStatus !== s.overallStatus) log(`store ${s.id}: +${added.count} steps, status ${s.overallStatus ?? "—"} → ${overallStatus ?? "—"}`);
  }
  return { templates: MODULE_DEFINITIONS.length, retired, stores: stores.length };
}
