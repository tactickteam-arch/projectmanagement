import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/lib/auth/dal";
import { ensureDailyOverdueCheck, unreadCount } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requirePageUser();
  // Spec: overdue check runs daily. No scheduler in the local demo, so it runs on first page load of the day.
  await ensureDailyOverdueCheck().catch((e) => console.error("Overdue check failed", e));
  const unread = await unreadCount(user);
  return (
    <AppShell user={user} unread={unread}>
      {children}
    </AppShell>
  );
}
