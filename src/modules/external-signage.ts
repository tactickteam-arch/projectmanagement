import type { ModuleDefinition } from "./types";

// Spec: "4. Sangeetha Board / External Signage". Offsets are spec placeholders.
export const externalSignage: ModuleDefinition = {
  moduleType: "EXTERNAL_SIGNAGE",
  displayName: "Sangeetha Board / External Signage",
  sortOrder: 4,
  phase: "fitout",
  defaultStartOffsetDays: 3,
  defaultDurationDays: 7,
  minPhotos: 1,
  fields: [
    { key: "boardType", label: "Board type", type: "select", options: ["ACP", "LED", "Glow sign", "Non-lit"] },
    { key: "widthFt", label: "Width", type: "number", unit: "ft", min: 0 },
    { key: "heightFt", label: "Height", type: "number", unit: "ft", min: 0 },
    { key: "designApprovedByHq", label: "Design approved by HQ", type: "yesno" },
    { key: "designFile", label: "Design file", type: "file", attachmentTag: "design" },
    { key: "landlordPermission", label: "Landlord permission", type: "yesno" },
    { key: "municipalPermitNo", label: "Municipal signage permit number", type: "text" },
    { key: "municipalPermitDoc", label: "Municipal permit document", type: "file", attachmentTag: "permit" },
    { key: "installationDate", label: "Installation date", type: "date" },
    { key: "illuminationWorking", label: "Illumination working", type: "yesno" },
  ],
};
