import type { ModuleDefinition } from "./types";

// Spec: "1. Store Location"
export const storeLocation: ModuleDefinition = {
  moduleType: "STORE_LOCATION",
  displayName: "Store Location",
  sortOrder: 1,
  phase: "sequential",
  defaultStartOffsetDays: null,
  defaultDurationDays: null,
  minPhotos: 1,
  fields: [
    { key: "landlordName", label: "Landlord name", type: "text" },
    { key: "landlordPhone", label: "Landlord phone", type: "phone" },
    { key: "landlordPan", label: "Landlord PAN", type: "text" },
    { key: "monthlyRent", label: "Monthly rent", type: "currency", min: 0 },
    { key: "securityDeposit", label: "Security deposit", type: "currency", min: 0 },
    { key: "lockInMonths", label: "Lock-in period", type: "number", unit: "months", min: 0 },
    { key: "leaseTenureYears", label: "Lease tenure", type: "number", unit: "years", min: 0 },
    { key: "yearlyEscalationPct", label: "Yearly escalation", type: "percent", min: 0, max: 100 },
    { key: "frontageWidthFt", label: "Frontage width", type: "number", unit: "ft", min: 0 },
    { key: "footfallRating", label: "Footfall rating", type: "number", min: 1, max: 5 },
    {
      key: "nearbyCompetitors",
      label: "Nearby competitors",
      type: "multiselect",
      options: [], // Spec gives no list: free text only until Sangeetha supplies one.
      allowOther: true,
    },
    { key: "frontagePhotos", label: "Frontage photos", type: "file", attachmentTag: "photo_frontage" },
    { key: "interiorPhotos", label: "Interior photos", type: "file", attachmentTag: "photo_interior" },
    { key: "locationApprovedByHq", label: "Location approved by HQ", type: "yesno" },
  ],
};
