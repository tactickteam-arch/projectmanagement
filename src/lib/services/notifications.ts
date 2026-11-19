import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { addDays, formatDateOnly, todayInIndia } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { missingPrerequisites } from "@/lib/module-rules";
import { notifyUsers, teamRecipients, teamRecipientsFor } from "@/lib/notify";
import { ragRows } from "@/lib/rag";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/settings";
import { daysOverdue } from "@/lib/status";
import { RAG_REPORT_TEAMS } from "@/lib/teams";
import { AFTER_KEY_TYPES, getModuleDefinition, MATERIAL_ORDERING, MODULE_TYPES, SIGN_BOARD } from "@/modules";

export async function listNotifications(user: CurrentUser, limit = 50) {
  return prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, message: true, isRead: true, createdAt: true, storeId: true, storeModule: { select: { moduleType: true } } },
  });
}

export async function unreadCount(user: CurrentUser): Promise<number> {
  return prisma.notification.count({ where: { userId: user.id, isRead: false } });
}

export async function markRead(user: CurrentUser, ids: string[] | "all") {
  await prisma.notification.updateMany({
    where: { userId: user.id, ...(ids === "all" ? {} : { id: { in: ids } }) },
    data: { isRead: true },
  });
}

const ACTIVE = { OR: [{ overallStatus: null }, { overallStatus: { notIn: ["LAUNCHED" as const, "DROPPED" as const, "ON_HOLD" as const] } }] };

/**
 * Automatic notices (SOP slides 6 and 11). There is no scheduler, so the checks run at most once per
 * IST day, the first time any signed-in page loads:
 *  - Delay alerts: the owning team of every overdue step (not still waiting on an earlier step) is
 *    told; HQ gets one daily summary.
 *  - T-7: one week before the expected key date every team is formally informed; the sign board
 *    and material ordering teams are reminded of the zero-exception gate.
 *  - Weekly RAG: on the first check of each week (from Monday) the RAG summary goes to State Admin,
 *    ASM, SH/BH, Legal, Marketing, HO and HQ.
 */
export async function ensureDailyOverdueCheck(): Promise<void> {
  const today = todayInIndia();
  const todayStr = formatDateOnly(today);
  if ((await getSetting(SETTING_KEYS.lastOverdueCheck)) === todayStr) return;
  await setSetting(SETTING_KEYS.lastOverdueCheck, todayStr); // claim first, so concurrent loads don't double-notify
  await overdueAlerts(today);
  await preKeyIntimations(today);
  await weeklyRag(today);
}

async function overdueAlerts(today: Date) {
  const stores = await prisma.store.findMany({
    where: { ...ACTIVE, modules: { some: { status: { not: "COMPLETED" }, plannedEnd: { lt: today } } } },
    select: { id: true, name: true, ownerId: true, state: true, modules: { select: { id: true, moduleType: true, status: true, approvalStatus: true, details: true, plannedEnd: true } } },
  });
  const templates = await prisma.moduleTemplate.findMany({ select: { moduleType: true, displayName: true, editTeams: true } });
  const names = Object.fromEntries(templates.map((t) => [t.moduleType, t.displayName]));
  const overdue = stores.flatMap((s) =>
    s.modules
      .filter((m) => MODULE_TYPES.includes(m.moduleType) && m.status !== "COMPLETED" && m.plannedEnd && m.plannedEnd < today)
      .filter((m) => missingPrerequisites(m.moduleType, s.modules).length === 0)
      .map((m) => ({ store: s, m })),
  );
  if (overdue.length === 0) return;
  const hq = (await prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } })).map((u) => u.id);
  await prisma.$transaction(async (tx) => {
    for (const { store, m } of overdue) {
      const days = daysOverdue(m.plannedEnd, m.status, today);
      const teams = templates.find((t) => t.moduleType === m.moduleType)?.editTeams ?? ["STORE_OWNER"];
      await notifyUsers(tx, await teamRecipients(tx, store, teams), {
        type: "module_overdue",
        message: `Delay alert — ${store.name}: ${names[m.moduleType] ?? m.moduleType} is ${days} day${days === 1 ? "" : "s"} overdue (planned end ${formatDate(formatDateOnly(m.plannedEnd as Date))}).`,
        storeId: store.id,
        storeModuleId: m.id,
      });
    }
    const storeCount = new Set(overdue.map((o) => o.store.id)).size;
    await notifyUsers(tx, hq, {
      type: "overdue_summary",
      message: `Daily check: ${overdue.length} overdue step${overdue.length === 1 ? "" : "s"} across ${storeCount} store${storeCount === 1 ? "" : "s"}. See the Delays report.`,
    });
  });
}

async function preKeyIntimations(today: Date) {
  const stores = await prisma.store.findMany({
    where: { ...ACTIVE, keyHandoverDate: null, expectedKeyDate: { not: null, lte: addDays(today, 7) } },
    select: { id: true, name: true, storeCode: true, state: true, ownerId: true, expectedKeyDate: true, preKeyNotifiedFor: true, modules: { select: { id: true, moduleType: true, status: true, approvalStatus: true } } },
  });
  const due = stores.filter((s) => s.expectedKeyDate && s.preKeyNotifiedFor?.getTime() !== s.expectedKeyDate.getTime());
  if (!due.length) return;
  const templates = await prisma.moduleTemplate.findMany({ select: { moduleType: true, editTeams: true } });
  const teamsOf = (t: string) => [...(templates.find((x) => x.moduleType === t)?.editTeams ?? []), ...(getModuleDefinition(t)?.supportTeams ?? [])];
  const stage6Teams = [...new Set(AFTER_KEY_TYPES.flatMap(teamsOf))];
  const preKeyTeams = [...new Set([...teamsOf(SIGN_BOARD), ...teamsOf(MATERIAL_ORDERING)])];
  await prisma.$transaction(async (tx) => {
    for (const s of due) {
      const keys = formatDate(formatDateOnly(s.expectedKeyDate as Date));
      const open = [SIGN_BOARD, MATERIAL_ORDERING].filter((t) => {
        const m = s.modules.find((x) => x.moduleType === t);
        return !m || m.status !== "COMPLETED" || m.approvalStatus !== "APPROVED";
      });
      const lookup = await teamRecipientsFor(tx, s, [...stage6Teams, ...preKeyTeams, "STATE_ADMIN", "RK"]);
      await notifyUsers(tx, lookup([...stage6Teams, "RK"]), {
        type: "pre_key_intimation",
        message: `${s.name} (${s.storeCode}): keys expected on ${keys} — one week to go. Stage 6 departments, get ready to start on Day 0.`,
        storeId: s.id,
      });
      if (open.length) {
        await notifyUsers(tx, lookup([...preKeyTeams, "STATE_ADMIN"]), {
          type: "pre_key_gate",
          message: `${s.name}: keys expected on ${keys}. ${open.length === 2 ? "The external sign board and material ordering are" : open[0] === SIGN_BOARD ? "The external sign board is" : "Material ordering is"} not done — no key handover without them (T-7 rule).`,
          storeId: s.id,
        });
      }
      await tx.store.update({ where: { id: s.id }, data: { preKeyNotifiedFor: s.expectedKeyDate } });
    }
  });
}

/** Monday of the IST week of `today`, as yyyy-mm-dd. */
function weekStart(today: Date): string {
  const dow = (today.getUTCDay() + 6) % 7; // Monday = 0
  return formatDateOnly(addDays(today, -dow));
}

async function weeklyRag(today: Date) {
  const week = weekStart(today);
  if ((await getSetting(SETTING_KEYS.lastRagWeek)) === week) return;
  await setSetting(SETTING_KEYS.lastRagWeek, week);
  const rows = await ragRows({});
  if (!rows.length) return;
  const count = (r: string) => rows.filter((x) => x.rag === r).length;
  const users = await prisma.user.findMany({
    where: { isActive: true, OR: [{ role: "SUPER_ADMIN" }, { role: { in: ["REGIONAL_MANAGER", "TEAM_MEMBER"] }, teams: { hasSome: [...RAG_REPORT_TEAMS] } }] },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    await notifyUsers(tx, users.map((u) => u.id), {
      type: "weekly_rag",
      message: `Weekly RAG rollout tracker (week of ${formatDate(week)}): ${count("R")} red, ${count("A")} amber, ${count("G")} green of ${rows.length} active store${rows.length === 1 ? "" : "s"}. Open Reports → Weekly RAG.`,
    });
  });
}
