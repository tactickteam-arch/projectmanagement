import type { ModuleDefinition } from "./types";

// Spec: "2. Token Advance"
export const tokenAdvance: ModuleDefinition = {
  moduleType: "TOKEN_ADVANCE",
  displayName: "Token Advance",
  sortOrder: 2,
  phase: "sequential",
  defaultStartOffsetDays: null,
  defaultDurationDays: null,
  minPhotos: 1,
  fields: [
    { key: "amount", label: "Amount", type: "currency", min: 0 },
    { key: "paymentDate", label: "Payment date", type: "date" },
    { key: "paymentMode", label: "Payment mode", type: "select", options: ["NEFT", "RTGS", "Cheque", "UPI"] },
    { key: "utrOrChequeNo", label: "UTR or cheque number", type: "text" },
    { key: "receipt", label: "Receipt", type: "file", attachmentTag: "receipt" },
    {
      key: "rentAgreementStatus",
      label: "Rent agreement status",
      type: "select",
      options: ["Draft", "Signed", "Registered"],
    },
    { key: "agreementDate", label: "Agreement date", type: "date" },
    { key: "agreement", label: "Agreement", type: "file", attachmentTag: "agreement" },
    { key: "rentFreeFitoutDays", label: "Rent-free fit-out period", type: "number", unit: "days", min: 0 },
    { key: "rentStartDate", label: "Rent start date", type: "date" },
  ],
};
