import { CreateStoreForm } from "@/components/create-store-form";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { activeStoreOwners } from "@/lib/queries";

export const metadata = { title: "Add store" };

export default async function NewStorePage() {
  const user = await requirePageUser(["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"]);
  if (!can.createStore(user)) redirect("/hq");
  const owners = await activeStoreOwners();
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/hq" }, { label: "Add store" }]}
        title="Add store"
        description="Creates the store with all 21 launch steps and assigns it to its store owner. Step 1, Location filing, starts right away."
      />
      <CreateStoreForm owners={owners} />
    </>
  );
}
