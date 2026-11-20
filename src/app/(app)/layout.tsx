import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/lib/auth/dal";
import { approvalsBadge } from "@/lib/queries";
import { ensureDailyOverdueCheck, unreadCount } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requirePageUser();
  // Spec: overdue check runs daily. No scheduler in the local demo, so it runs on first page load of the day.
  await ensureDailyOverdueCheck().catch((e) => console.error("Overdue check failed", e));
  const [unread, approvals] = await Promise.all([unreadCount(user), approvalsBadge(user)]);
  return (
    <AppShell user={user} unread={unread} approvals={approvals}>
      {children}
    </AppShell>
  );
}
