import { setupTrack } from "./setup-track";

// Flow step 6 track "Brand promoters" (Brand managers).
export const brandPromoters = setupTrack({
  moduleType: "BRAND_PROMOTERS",
  displayName: "Brand promoters",
  shortLabel: "Brands",
  sortOrder: 12,
  doneByLabel: "Brand managers",
  editTeams: ["BRAND_MANAGERS"],
  defaultStartOffsetDays: 14,
  defaultDurationDays: 14,
  minPhotos: 1,
  fields: [
    { key: "intimationToBrands", label: "Intimation to brands", type: "task" },
    { key: "demoFixtures", label: "Demo fixtures", type: "task" },
    { key: "promoterDeployment", label: "Promoter deployment", type: "task" },
    { key: "brandLaunchSupport", label: "Brand launch support", type: "task" },
    { key: "brandsIntimated", label: "Brands intimated", type: "multiselect", options: ["Samsung", "Apple", "Vivo", "Oppo", "Xiaomi", "OnePlus"], allowOther: true },
    { key: "promotersDeployed", label: "Promoters deployed", type: "number", min: 0 },
    { key: "launchSupportNotes", label: "Brand launch support agreed", type: "longtext" },
  ],
});
