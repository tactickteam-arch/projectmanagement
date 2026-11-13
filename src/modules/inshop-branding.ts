import type { ModuleDefinition } from "./types";

// Spec: "8. In-shop Branding". Final store photos for HQ sign-off: minimum 4.
export const inshopBranding: ModuleDefinition = {
  moduleType: "INSHOP_BRANDING",
  displayName: "In-shop Branding",
  sortOrder: 8,
  phase: "fitout",
  defaultStartOffsetDays: 15,
  defaultDurationDays: 7,
  minPhotos: 4,
  photoTag: "photo_final",
  fields: [
    {
      key: "brandingItems",
      label: "Branding items",
      type: "checklist",
      defaultItems: ["Wall graphics", "Display fixtures", "Demo tables", "Posters", "Window vinyl"],
      itemFields: [
        { key: "itemName", label: "Item name", type: "text" },
        { key: "quantity", label: "Quantity", type: "number", min: 0 },
        { key: "received", label: "Received", type: "yesno" },
        { key: "installed", label: "Installed", type: "yesno" },
        { key: "photo", label: "Photo", type: "file", attachmentTag: "photo_branding_item" },
      ],
    },
    {
      key: "brandPartnerZones",
      label: "Brand partner zones",
      type: "multiselect",
      options: ["Samsung", "Apple", "Vivo", "Oppo", "Xiaomi", "OnePlus"],
      allowOther: true,
    },
    { key: "finalStorePhotos", label: "Final store photos for HQ sign-off", type: "file", attachmentTag: "photo_final" },
  ],
};
