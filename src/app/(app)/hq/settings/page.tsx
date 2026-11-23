import { PageHeader } from "@/components/page-header";
import { AssignmentPanel, ChecklistsPanel, SchedulingPanel, StepsPanel, UsersPanel } from "@/components/settings-panels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePageUser } from "@/lib/auth/dal";
import { loginMode } from "@/lib/auth/login-code";
import { prisma } from "@/lib/db";
import { activeStoreOwners } from "@/lib/queries";
import { listUsers } from "@/lib/services/admin";
import { getTargetLaunchOffsetDays } from "@/lib/settings";
import { getModuleDefinition, MODULE_TYPES } from "@/modules";
import type { FieldDef } from "@/modules/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePageUser(["SUPER_ADMIN"]);
  const [users, stores, owners, allTemplates, target] = await Promise.all([
    listUsers(user),
    prisma.store.findMany({ orderBy: { storeCode: "asc" }, select: { id: true, storeCode: true, name: true, city: true, ownerId: true } }),
    activeStoreOwners(),
    prisma.moduleTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
    getTargetLaunchOffsetDays(),
  ]);
  const templates = allTemplates.filter((t) => MODULE_TYPES.includes(t.moduleType));
  const checklists = templates.flatMap((t) =>
    (t.fieldSchema as unknown as FieldDef[])
      .filter((f) => f.type === "checklist")
      .map((f) => ({ moduleType: t.moduleType, stepName: t.displayName, fieldKey: f.key, label: f.label, items: f.defaultItems ?? [] })),
  );

  return (
    <>
      <PageHeader title="Settings" description="Users and teams, who fills in and approves each SOP step, store assignment and the 13-week schedule." />
      <Tabs defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users">Users &amp; teams</TabsTrigger>
          <TabsTrigger value="steps">Steps &amp; approvals</TabsTrigger>
          <TabsTrigger value="assign">Store assignment</TabsTrigger>
          <TabsTrigger value="schedule">Scheduling</TabsTrigger>
          {checklists.length > 0 && <TabsTrigger value="checklists">Checklists</TabsTrigger>}
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UsersPanel
            codeLogin={loginMode() === "code"}
            currentUserId={user.id}
            users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, regionStates: u.regionStates, teams: u.teams, isActive: u.isActive, stores: u._count.ownedStores }))}
          />
        </TabsContent>
        <TabsContent value="steps" className="mt-4">
          <StepsPanel
            steps={templates.map((t) => ({ moduleType: t.moduleType, displayName: t.displayName, code: getModuleDefinition(t.moduleType)?.code ?? "", editTeams: t.editTeams, approverTeam: t.approverTeam }))}
          />
        </TabsContent>
        <TabsContent value="assign" className="mt-4">
          <AssignmentPanel stores={stores} owners={owners} />
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <SchedulingPanel
            templates={templates.map((t) => ({ moduleType: t.moduleType, displayName: t.displayName, code: getModuleDefinition(t.moduleType)?.code ?? "", anchor: getModuleDefinition(t.moduleType)?.scheduleAnchor ?? "handover", defaultStartOffsetDays: t.defaultStartOffsetDays, defaultDurationDays: t.defaultDurationDays }))}
            targetLaunchOffsetDays={target}
          />
        </TabsContent>
        <TabsContent value="checklists" className="mt-4">
          <ChecklistsPanel checklists={checklists} />
        </TabsContent>
      </Tabs>
    </>
  );
}
