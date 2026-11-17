import { setupTrack } from "./setup-track";

// Flow step 6 track "Marketing" (Marketing). Offsets are placeholders to confirm with Sangeetha.
export const marketing = setupTrack({
  moduleType: "MARKETING",
  displayName: "Marketing",
  shortLabel: "Marketing",
  sortOrder: 10,
  doneByLabel: "Marketing",
  editTeams: ["MARKETING"],
  defaultStartOffsetDays: 0,
  defaultDurationDays: 25,
  minPhotos: 2,
  fields: [
    { key: "externalSignage", label: "External signage / sign board", type: "task" },
    { key: "inShopBranding", label: "In-shop branding", type: "task" },
    { key: "campaignAndCollaterals", label: "Campaign and collaterals", type: "task" },
    { key: "guestFinalisation", label: "Guest finalisation", type: "task" },
    { key: "boardType", label: "Sign board type", type: "select", options: ["ACP", "LED", "Glow sign", "Non-lit"] },
    { key: "boardWidthFt", label: "Board width", type: "number", unit: "ft", min: 0 },
    { key: "boardHeightFt", label: "Board height", type: "number", unit: "ft", min: 0 },
    { key: "municipalPermitNo", label: "Municipal signage permit number", type: "text" },
    {
      key: "brandingItems",
      label: "In-shop branding items",
      type: "checklist",
      mustTick: "installed",
      defaultItems: ["Wall graphics", "Display fixtures", "Demo tables", "Posters", "Window vinyl"],
      itemFields: [
        { key: "itemName", label: "Item", type: "text" },
        { key: "quantity", label: "Qty", type: "number", min: 0 },
        { key: "installed", label: "Installed", type: "yesno" },
      ],
    },
    { key: "launchGuest", label: "Launch guest", type: "text" },
    { key: "designFile", label: "Signage and branding designs", type: "file", attachmentTag: "design" },
  ],
});
