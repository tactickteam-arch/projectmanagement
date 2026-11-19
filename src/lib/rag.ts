import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { formatDateOnly, todayInIndia } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { missingPrerequisites } from "@/lib/module-rules";
import { daysOverdue, flowModules, isDone, stepRag, worstRag, type Rag } from "@/lib/status";
import { getModuleDefinition, MODULE_TYPES, STAGE_COLUMNS } from "@/modules";

export interface RagStep {
  moduleType: string;
  displayName: string;
  code: string;
  rag: Rag | null;
  status: string;
  plannedEnd: string | null;
  daysOverdue: number;
  waitingFor: string[];
  blockerReason: string | null;
}

export interface RagRow {
  id: string;
  storeCode: string;
  name: string;
  city: string;
  state: string;
  ownerName: string;
  overallStatus: string | null;
  expectedKeyDate: string | null;
  keyHandoverDate: string | null;
  targetLaunchDate: string | null;
  rag: Rag | null;
  stages: { key: string; label: string; title: string; rag: Rag | null }[];
  /** Red and amber steps, worst first. */
  attention: RagStep[];
  done: number;
  total: number;
}

/**
 * Weekly RAG rollout tracker (SOP slide 11) for active stores (not launched, dropped or on hold):
 * every step's Red / Amber / Green, rolled up per SOP stage and per store.
 */
export async function ragRows(where: Prisma.StoreWhereInput): Promise<RagRow[]> {
  const today = todayInIndia();
  const iso = (d: Date | null) => (d ? formatDateOnly(d) : null);
  const [stores, templates] = await Promise.all([
    prisma.store.findMany({
      where: { AND: [where, { OR: [{ overallStatus: null }, { overallStatus: { notIn: ["LAUNCHED", "DROPPED", "ON_HOLD"] } }] }] },
      orderBy: { storeCode: "asc" },
      select: {
        id: true,
        storeCode: true,
        name: true,
        city: true,
        state: true,
        overallStatus: true,
        expectedKeyDate: true,
        keyHandoverDate: true,
        targetLaunchDate: true,
        owner: { select: { name: true } },
        modules: { select: { moduleType: true, status: true, approvalStatus: true, details: true, plannedStart: true, plannedEnd: true, blockerReason: true } },
      },
    }),
    prisma.moduleTemplate.findMany({ select: { moduleType: true, displayName: true } }),
  ]);
  const names = Object.fromEntries(templates.map((t) => [t.moduleType, t.displayName]));
  return stores.map((s) => {
    const mods = flowModules(s.modules);
    const steps: RagStep[] = mods.map((m) => {
      const waitingFor = missingPrerequisites(m.moduleType, mods);
      return {
        moduleType: m.moduleType,
        displayName: names[m.moduleType] ?? m.moduleType,
        code: getModuleDefinition(m.moduleType)?.code ?? "",
        rag: stepRag(m, waitingFor.length > 0, today),
        status: m.status,
        plannedEnd: iso(m.plannedEnd),
        daysOverdue: daysOverdue(m.plannedEnd, m.status, today),
        waitingFor: waitingFor.map((t) => names[t] ?? t),
        blockerReason: m.blockerReason,
      };
    });
    const stages = STAGE_COLUMNS.map((c) => ({ key: c.key, label: c.label, title: c.title, rag: worstRag(steps.filter((x) => c.types.includes(x.moduleType)).map((x) => x.rag)) }));
    const order = { R: 0, A: 1, G: 2 } as const;
    return {
      id: s.id,
      storeCode: s.storeCode,
      name: s.name,
      city: s.city,
      state: s.state,
      ownerName: s.owner.name,
      overallStatus: s.overallStatus,
      expectedKeyDate: iso(s.expectedKeyDate),
      keyHandoverDate: iso(s.keyHandoverDate),
      targetLaunchDate: iso(s.targetLaunchDate),
      rag: worstRag(steps.map((x) => x.rag)),
      stages,
      attention: steps
        .filter((x) => x.rag === "R" || x.rag === "A")
        .sort((a, b) => order[a.rag as "R" | "A"] - order[b.rag as "R" | "A"] || b.daysOverdue - a.daysOverdue),
      done: mods.filter(isDone).length,
      total: MODULE_TYPES.length,
    };
  });
}
