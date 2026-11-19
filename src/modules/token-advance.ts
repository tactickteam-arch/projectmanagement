import type { ModuleDefinition } from "./types";

// SOP stage 3 (slide 5): token advance release. Gate rule: payment and the APX PO only after the
// 8-point confirmation (stage 2 cleared by RK). Workflow: 1 8-point sign-off (State Admin & ASM,
// = stage 2) → 2 MOU sign-off (Legal & BH) → 3 Accounts approval (terms, KYC, 8 points) →
// 4 HO releases the advance → 5 PO raised in APX.
export const tokenAdvance: ModuleDefinition = {
  moduleType: "TOKEN_ADVANCE",
  displayName: "Token advance",
  shortLabel: "3 Token",
  stage: 3,
  code: "3",
  group: "gate",
  sortOrder: 3,
  summary: "MOU sign-off, Accounts approval, HO pays the advance, PO in APX",
  doneBy: "SANGEETHA",
  doneByLabel: "Legal / BH / State Admin / HO",
  editTeams: ["LEGAL", "BH", "STATE_ADMIN", "HO"],
  approverTeam: "ACCOUNTS",
  approvalNote: "Accounts verifies commercial terms, KYC & 8-point confirmation",
  requires: ["LANDLORD_CHECK"],
  notes: ["No token advance without the 8-point landlord confirmation (zero-exception gate)."],
  reviewFrom: {
    moduleType: "LOCATION_FILING",
    title: "Commercial terms & landlord KYC (from the 41-point MOU sheet)",
    keys: ["advanceAgreementTerms", "monthlyRent", "rentFreePeriod", "landlordName", "landlordPan", "landlordAadhaar", "bankName", "bankAccount", "ifsc", "gstNumber"],
  },
  afterApproval: [
    {
      key: "payment",
      label: "Token advance payment",
      teams: ["HO"],
      gate: true,
      pendingText: "Step 4 — HO releases the token advance to the landlord",
      doneText: "Token advance paid by HO",
      fields: [
        { key: "paidAmount", label: "Amount paid", type: "currency", min: 0, required: true },
        { key: "paidOn", label: "Paid on", type: "date", required: true },
        { key: "paymentMode", label: "Payment mode", type: "select", options: ["NEFT", "RTGS", "IMPS", "Cheque"], required: true },
        { key: "utr", label: "UTR / cheque no.", type: "text", required: true },
      ],
    },
    {
      key: "apxPo",
      label: "APX purchase order",
      teams: ["ACCOUNTS", "PURCHASE"],
      pendingText: "Step 5 — PO raised in APX",
      doneText: "PO raised in APX",
      fields: [{ key: "apxPoNumber", label: "APX PO number", type: "text", required: true }],
    },
  ],
  scheduleAnchor: "created",
  defaultStartOffsetDays: 28,
  defaultDurationDays: 14,
  minPhotos: 0,
  fields: [
    { key: "mouSignOff", label: "MOU executed with the landlord", type: "task", owner: "Legal & BH" },
    { key: "mouSignedOn", label: "MOU signed on", type: "date", required: true },
    { key: "tokenAmount", label: "Token advance amount", type: "currency", min: 0, required: true },
    { key: "signedMou", label: "Signed MOU", type: "file", attachmentTag: "signed_mou", required: true },
  ],
};
