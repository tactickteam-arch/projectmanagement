import { CreateStoreForm } from "@/components/create-store-form";
import { PageHeader } from "@/components/page-header";
import { requirePageUser } from "@/lib/auth/dal";
import { activeStoreOwners } from "@/lib/queries";

export const metadata = { title: "Add store" };

export default async function NewStorePage() {
  const user = await requirePageUser(["SUPER_ADMIN", "STORE_OWNER"]);
  const owners = user.role === "SUPER_ADMIN" ? await activeStoreOwners() : null;
  return (
    <>
      <PageHeader
        crumbs={[user.role === "STORE_OWNER" ? { label: "My stores", href: "/owner" } : { label: "Dashboard", href: "/hq" }, { label: "Add store" }]}
        title="Add store"
        description="Creates the store record with its 7 setup modules and the Key Handover milestone."
      />
      <CreateStoreForm owners={owners} />
    </>
  );
}
