import { NotificationList } from "@/components/notification-list";
import { PageHeader } from "@/components/page-header";
import { requirePageUser } from "@/lib/auth/dal";
import { listNotifications } from "@/lib/services/notifications";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requirePageUser();
  const items = await listNotifications(user, 100);
  return (
    <>
      <PageHeader title="Notifications" />
      <NotificationList
        items={items.map((n) => ({
          id: n.id,
          type: n.type,
          message: n.message,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
          href: n.storeId
            ? n.storeModule
              ? `/stores/${n.storeId}/modules/${n.storeModule.moduleType}`
              : `/stores/${n.storeId}`
            : n.type === "overdue_summary"
              ? "/hq/reports/delays"
              : null,
        }))}
      />
    </>
  );
}
