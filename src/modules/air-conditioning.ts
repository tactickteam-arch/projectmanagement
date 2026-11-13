import type { ModuleDefinition } from "./types";

// Spec: "6. Air Conditioning". Offsets are spec placeholders.
export const airConditioning: ModuleDefinition = {
  moduleType: "AIR_CONDITIONING",
  displayName: "Air Conditioning",
  sortOrder: 6,
  phase: "fitout",
  defaultStartOffsetDays: 7,
  defaultDurationDays: 5,
  minPhotos: 1,
  fields: [
    { key: "acType", label: "AC type", type: "select", options: ["Split", "Cassette", "Ducted"] },
    { key: "units", label: "Number of units", type: "number", min: 0 },
    { key: "totalTonnage", label: "Total tonnage", type: "number", unit: "tons", min: 0 },
    { key: "brand", label: "Brand", type: "text" },
    { key: "installationDate", label: "Installation date", type: "date" },
    { key: "warrantyEndDate", label: "Warranty end date", type: "date" },
    { key: "amcVendor", label: "AMC vendor", type: "text" },
  ],
};
