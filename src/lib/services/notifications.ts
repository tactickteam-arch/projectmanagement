import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { formatDateOnly, todayInIndia } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/settings";
import { daysOverdue } from "@/lib/status";
import { SETUP_MODULE_TYPES } from "@/modules";

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

/**
 * Spec "Module overdue (daily check) → Store owner and HQ". There is no scheduler in the
 * local demo, so the check runs at most once per IST day, the first time any signed-in page
 * loads. Owners get one notification per overdue module; HQ gets one daily summary.
 */
export async function ensureDailyOverdueCheck(): Promise<void> {
  const today = todayInIndia();
  const todayStr = formatDateOnly(today);
  if ((await getSetting(SETTING_KEYS.lastOverdueCheck)) === todayStr) return;
  await setSetting(SETTING_KEYS.lastOverdueCheck, todayStr); // claim first, so concurrent loads don't double-notify

  const modules = await prisma.storeModule.findMany({
    where: {
      moduleType: { in: [...SETUP_MODULE_TYPES] },
      status: { not: "COMPLETED" },
      plannedEnd: { lt: today },
      store: { overallStatus: { notIn: ["LAUNCHED", "DROPPED", "ON_HOLD"] } },
    },
    select: { id: true, moduleType: true, status: true, plannedEnd: true, store: { select: { id: true, name: true, ownerId: true } } },
  });
  if (modules.length === 0) return;
  const names = Object.fromEntries((await prisma.moduleTemplate.findMany({ select: { moduleType: true, displayName: true } })).map((t) => [t.moduleType, t.displayName]));
  const hq = (await prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } })).map((u) => u.id);

  await prisma.$transaction(async (tx) => {
    for (const m of modules) {
      const days = daysOverdue(m.plannedEnd, m.status, today);
      await notifyUsers(tx, [m.store.ownerId], {
        type: "module_overdue",
        message: `${m.store.name}: ${names[m.moduleType] ?? m.moduleType} is ${days} day${days === 1 ? "" : "s"} overdue.`,
        storeId: m.store.id,
        storeModuleId: m.id,
      });
    }
    const storeCount = new Set(modules.map((m) => m.store.id)).size;
    await notifyUsers(tx, hq, {
      type: "overdue_summary",
      message: `Daily check: ${modules.length} overdue module${modules.length === 1 ? "" : "s"} across ${storeCount} store${storeCount === 1 ? "" : "s"}. See the Delays report.`,
    });
  });
}
