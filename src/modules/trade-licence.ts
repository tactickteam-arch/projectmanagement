import { setupTrack } from "./setup-track";

// Flow step 6 track "Trade licence" (Legal).
export const tradeLicence = setupTrack({
  moduleType: "TRADE_LICENCE",
  displayName: "Trade licence",
  shortLabel: "Trade lic.",
  sortOrder: 16,
  doneByLabel: "Legal",
  editTeams: ["LEGAL"],
  defaultStartOffsetDays: 0,
  defaultDurationDays: 21,
  minPhotos: 0,
  fields: [
    { key: "tradeLicenceObtained", label: "Trade licence obtained", type: "task" },
    { key: "licenceNumber", label: "Licence number", type: "text" },
    { key: "issueDate", label: "Issued on", type: "date" },
    { key: "validTill", label: "Valid till", type: "date" },
    { key: "licence", label: "Trade licence", type: "file", attachmentTag: "licence" },
  ],
});
