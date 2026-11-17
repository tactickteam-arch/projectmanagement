import type { ModuleDefinition } from "./types";

// Flow step 4 "Legal agreement and statutory" — owned by the Legal team (with Tax), runs alongside
// steps 3–5. No separate approval box in the flow: Legal marks it done.
export const legalStatutory: ModuleDefinition = {
  moduleType: "LEGAL_STATUTORY",
  displayName: "Legal agreement and statutory",
  shortLabel: "4 Legal",
  step: 4,
  sortOrder: 4,
  summary: "Agreement signed by landlord + MD",
  doneBy: "SANGEETHA",
  doneByLabel: "Sangeetha Legal + tax team",
  editTeams: ["LEGAL", "TAX", "ACCOUNTS"],
  approverTeam: null,
  approvalNote: "Runs alongside steps 3–5",
  requires: ["LANDLORD_CHECK"],
  defaultStartOffsetDays: null,
  defaultDurationDays: null,
  minPhotos: 0,
  fields: [
    { key: "signingOfAgreement", label: "Signing of agreement", type: "task", owner: "Legal" },
    { key: "licences", label: "S&E, BBMP, Labour licences", type: "task", owner: "Legal" },
    { key: "gstRegistration", label: "GST registration, upload on GST portal", type: "task", owner: "Tax team" },
    { key: "balanceDeposit", label: "Balance deposit", type: "task", owner: "HO" },
    { key: "agreementDate", label: "Agreement date", type: "date" },
    { key: "rentAgreementStatus", label: "Rent agreement status", type: "select", options: ["Draft", "Signed", "Registered"] },
    { key: "rentFreeFitoutDays", label: "Rent-free fit-out period", type: "number", unit: "days", min: 0 },
    { key: "rentStartDate", label: "Rent start date", type: "date" },
    { key: "shopEstablishmentNo", label: "Shops & Establishment number", type: "text" },
    { key: "bbmpLicenceNo", label: "BBMP / municipal licence number", type: "text" },
    { key: "labourLicenceNo", label: "Labour licence number", type: "text" },
    { key: "gstin", label: "GSTIN (added on GST portal)", type: "text" },
    { key: "balanceDepositAmount", label: "Balance deposit amount", type: "currency", min: 0 },
    { key: "balanceDepositDate", label: "Balance deposit paid on", type: "date" },
    { key: "agreement", label: "Signed agreement", type: "file", attachmentTag: "agreement" },
    { key: "licenceDocs", label: "Licences and GST certificate", type: "file", attachmentTag: "licence" },
  ],
};
