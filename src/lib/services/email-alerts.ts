import "server-only";
import { prisma } from "@/lib/db";
import { deliverable, emailConfigured, escapeHtml, sendEmail } from "@/lib/email";

const DAY_MS = 24 * 3600 * 1000;

export function appUrl(): string {
  const u = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return u.replace(/\/$/, "");
}

/**
 * Decided 21 Nov 2026: every alert also goes by e-mail. Runs after each request that created
 * alerts: each person gets one e-mail with all their new alerts. Alerts older than a day (e.g.
 * from before e-mail was switched on) are skipped, never sent late in a burst.
 */
export async function dispatchPendingEmails(): Promise<number> {
  const now = new Date();
  await prisma.notification.updateMany({ where: { emailedAt: null, createdAt: { lt: new Date(now.getTime() - DAY_MS) } }, data: { emailedAt: now } });
  if (!emailConfigured()) return 0;

  const pending = await prisma.notification.findMany({ where: { emailedAt: null }, orderBy: { createdAt: "asc" }, take: 500, select: { id: true } });
  if (!pending.length) return 0;
  // Claim the rows with a unique timestamp so two requests never send the same alert twice.
  const claim = new Date(now.getTime() + Math.floor(Math.random() * 997) + 1);
  await prisma.notification.updateMany({ where: { id: { in: pending.map((p) => p.id) }, emailedAt: null }, data: { emailedAt: claim } });
  const rows = await prisma.notification.findMany({
    where: { emailedAt: claim },
    orderBy: { createdAt: "asc" },
    select: { message: true, storeId: true, user: { select: { email: true, name: true, isActive: true } } },
  });

  const byUser = new Map<string, { name: string; items: { message: string; storeId: string | null }[] }>();
  for (const r of rows) {
    if (!r.user.isActive || !deliverable(r.user.email)) continue;
    const entry = byUser.get(r.user.email) ?? { name: r.user.name, items: [] };
    entry.items.push({ message: r.message, storeId: r.storeId });
    byUser.set(r.user.email, entry);
  }
  const base = appUrl();
  let sent = 0;
  for (const [to, { name, items }] of byUser) {
    const subject = items.length === 1 ? items[0].message.slice(0, 120) : `Store Launch Tracker: ${items.length} new alerts`;
    const link = (s: string | null) => (s ? `${base}/stores/${s}` : `${base}/notifications`);
    const text = [`Hello ${name},`, "", ...items.map((i) => `• ${i.message}\n  ${link(i.storeId)}`), "", `All alerts: ${base}/notifications`, "— Store Launch Tracker, Sangeetha Mobiles"].join("\n");
    const html = `<p>Hello ${escapeHtml(name)},</p><ul>${items
      .map((i) => `<li style="margin-bottom:8px">${escapeHtml(i.message)}<br><a href="${link(i.storeId)}">Open in the tracker</a></li>`)
      .join("")}</ul><p><a href="${base}/notifications">All alerts</a></p><p style="color:#666">Store Launch Tracker · Sangeetha Mobiles</p>`;
    if (await sendEmail({ to, subject, text, html })) sent++;
  }
  return sent;
}
