import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_TARGET_LAUNCH_OFFSET_DAYS } from "@/lib/scheduling";

/** Configurable settings stored in app_settings (HQ → Settings). */
export const SETTING_KEYS = {
  targetLaunchOffsetDays: "target_launch_offset_days",
  lastOverdueCheck: "last_overdue_check",
  lastRagWeek: "last_rag_week",
} as const;

/** Pass the transaction client when called inside a transaction, so the read uses the same connection. */
export async function getTargetLaunchOffsetDays(db: Pick<typeof prisma, "appSetting"> = prisma): Promise<number> {
  const row = await db.appSetting.findUnique({ where: { key: SETTING_KEYS.targetLaunchOffsetDays } });
  return typeof row?.value === "number" ? row.value : DEFAULT_TARGET_LAUNCH_OFFSET_DAYS;
}

export async function setSetting(key: string, value: string | number | boolean): Promise<void> {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function getSetting(key: string): Promise<unknown> {
  return (await prisma.appSetting.findUnique({ where: { key } }))?.value ?? null;
}
