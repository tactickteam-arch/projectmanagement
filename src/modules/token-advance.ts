import type { ModuleDefinition } from "./types";

// Flow step 3 "Token advance" — Sangeetha locks the site; Accounts approves the advance payment.
// After approval a PO is raised in APX (recorded on the step as the APX PO number).
export const tokenAdvance: ModuleDefinition = {
  moduleType: "TOKEN_ADVANCE",
  displayName: "Token advance",
  shortLabel: "3 Token",
  step: 3,
  sortOrder: 3,
  summary: "Lock the site with the landlord",
  doneBy: "SANGEETHA",
  doneByLabel: "Sangeetha",
  editTeams: ["ACCOUNTS", "LEGAL"],
  approverTeam: "ACCOUNTS",
  approvalNote: "Advance payment",
  requires: ["LANDLORD_CHECK"],
  afterApproval: {
    key: "apxPoNumber",
    label: "APX PO number",
    teams: ["ACCOUNTS", "PURCHASE"],
    pendingText: "After approval: PO raised in APX",
    doneText: "PO raised in APX",
  },
  defaultStartOffsetDays: null,
  defaultDurationDays: null,
  minPhotos: 0,
  fields: [
    { key: "mouSignOff", label: "MOU sign-off", type: "task", owner: "Legal · BH" },
    { key: "paymentOfAdvance", label: "Payment of advance", type: "task", owner: "HO" },
    { key: "amount", label: "Advance amount", type: "currency", min: 0 },
    { key: "paymentDate", label: "Payment date", type: "date" },
    { key: "paymentMode", label: "Payment mode", type: "select", options: ["NEFT", "RTGS", "Cheque", "UPI"] },
    { key: "utrOrChequeNo", label: "UTR or cheque number", type: "text" },
    { key: "mou", label: "Signed MOU", type: "file", attachmentTag: "mou" },
    { key: "receipt", label: "Payment receipt", type: "file", attachmentTag: "receipt" },
  ],
};
