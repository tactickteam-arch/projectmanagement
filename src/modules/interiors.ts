import { setupTrack } from "./setup-track";

// Flow step 6 track "Interiors" (State admin → HO → Marketing).
export const interiors = setupTrack({
  moduleType: "INTERIORS",
  displayName: "Interiors",
  shortLabel: "Interiors",
  sortOrder: 11,
  doneByLabel: "State admin → HO → Marketing",
  editTeams: ["INTERIORS", "STATE_ADMIN"],
  defaultStartOffsetDays: 0,
  defaultDurationDays: 21,
  minPhotos: 2,
  fields: [
    { key: "vendorQuotation", label: "Vendor quotation", type: "task" },
    { key: "vendorApprovalByHo", label: "Vendor approval by HO", type: "task" },
    { key: "electricAcItCounters", label: "Electric, AC, IT, brand counters", type: "task" },
    { key: "purchaseAndPo", label: "Purchase + PO amount shown", type: "task" },
    { key: "quotationAmount", label: "Quotation amount", type: "currency", min: 0 },
    { key: "poNumber", label: "PO number", type: "text" },
    { key: "poAmount", label: "PO amount", type: "currency", min: 0 },
    { key: "sanctionedLoadKw", label: "Sanctioned electrical load", type: "number", unit: "kW", min: 0 },
    { key: "acUnits", label: "AC units", type: "number", min: 0 },
    { key: "acTonnage", label: "AC tonnage", type: "number", unit: "tons", min: 0 },
    { key: "brandCounters", label: "Brand counters installed", type: "multiselect", options: ["Samsung", "Apple", "Vivo", "Oppo", "Xiaomi", "OnePlus"], allowOther: true },
    { key: "quotation", label: "Quotation", type: "file", attachmentTag: "quotation" },
  ],
});
