import { setupTrack } from "./setup-track";

// Flow step 6 track "Stocks" (Purchase · e-com (CXO)).
export const stocks = setupTrack({
  moduleType: "STOCKS",
  displayName: "Stocks",
  shortLabel: "Stocks",
  sortOrder: 14,
  doneByLabel: "Purchase · e-com (CXO)",
  editTeams: ["PURCHASE"],
  defaultStartOffsetDays: 21,
  defaultDurationDays: 7,
  minPhotos: 0,
  fields: [
    { key: "stockOrderingAndArrival", label: "Stock ordering and arrival", type: "task" },
    { key: "orderDate", label: "Order placed on", type: "date" },
    { key: "stockValue", label: "Opening stock value", type: "currency", min: 0 },
    { key: "arrivalDate", label: "Stock arrived on", type: "date" },
  ],
});
