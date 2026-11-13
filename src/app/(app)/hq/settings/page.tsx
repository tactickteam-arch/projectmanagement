import { PageHeader } from "@/components/page-header";
import { AssignmentPanel, BrandingItemsPanel, SchedulingPanel, UsersPanel } from "@/components/settings-panels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePageUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { activeStoreOwners } from "@/lib/queries";
import { listUsers } from "@/lib/services/admin";
import { getTargetLaunchOffsetDays } from "@/lib/settings";
import type { FieldDef } from "@/modules/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePageUser(["SUPER_ADMIN"]);
  const [users, stores, owners, templates, target] = await Promise.all([
    listUsers(user),
    prisma.store.findMany({ orderBy: { storeCode: "asc" }, select: { id: true, storeCode: true, name: true, city: true, ownerId: true } }),
    activeStoreOwners(),
    prisma.moduleTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
    getTargetLaunchOffsetDays(),
  ]);
  const branding = templates.find((t) => t.moduleType === "INSHOP_BRANDING");
  const brandingItems = ((branding?.fieldSchema as unknown as FieldDef[] | undefined) ?? []).find((f) => f.type === "checklist")?.defaultItems ?? [];

  return (
    <>
      <PageHeader title="Settings" description="Users and roles, store assignment, scheduling defaults and branding checklist." />
      <Tabs defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users">Users &amp; roles</TabsTrigger>
          <TabsTrigger value="assign">Store assignment</TabsTrigger>
          <TabsTrigger value="schedule">Scheduling</TabsTrigger>
          <TabsTrigger value="branding">Branding checklist</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UsersPanel currentUserId={user.id} users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, regionStates: u.regionStates, isActive: u.isActive, stores: u._count.ownedStores }))} />
        </TabsContent>
        <TabsContent value="assign" className="mt-4">
          <AssignmentPanel stores={stores} owners={owners} />
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <SchedulingPanel
            templates={templates.map((t) => ({ moduleType: t.moduleType, displayName: t.displayName, defaultStartOffsetDays: t.defaultStartOffsetDays, defaultDurationDays: t.defaultDurationDays }))}
            targetLaunchOffsetDays={target}
          />
        </TabsContent>
        <TabsContent value="branding" className="mt-4">
          <BrandingItemsPanel items={brandingItems} />
        </TabsContent>
      </Tabs>
    </>
  );
}
