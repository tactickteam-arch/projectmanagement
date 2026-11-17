import { setupTrack } from "./setup-track";

// Flow step 6 track "Finance and IT" (Consumer finance · IT · Admin).
export const financeIt = setupTrack({
  moduleType: "FINANCE_IT",
  displayName: "Finance and IT",
  shortLabel: "Fin & IT",
  sortOrder: 15,
  doneByLabel: "Consumer finance · IT · Admin",
  editTeams: ["FINANCE_IT"],
  defaultStartOffsetDays: 0,
  defaultDurationDays: 21,
  minPhotos: 1,
  fields: [
    { key: "nbfcIntimation", label: "Intimation to NBFC finance cos.", type: "task" },
    { key: "cugConnections", label: "CUG mobile connections", type: "task" },
    { key: "broadbandCctv", label: "Broadband, CCTV", type: "task" },
    { key: "decorationStationeryApx", label: "Decoration, stationery, APX", type: "task" },
    { key: "nbfcPartners", label: "NBFC partners intimated", type: "multiselect", options: ["Bajaj Finserv", "HDB Financial", "TVS Credit", "Home Credit"], allowOther: true },
    { key: "cugNumbers", label: "CUG connections issued", type: "number", min: 0 },
    { key: "internetProvider", label: "Broadband provider", type: "text" },
    { key: "speedMbps", label: "Broadband speed", type: "number", unit: "Mbps", min: 0 },
    { key: "cctvCameras", label: "CCTV cameras", type: "number", min: 0 },
    { key: "apxStoreCode", label: "APX store code", type: "text" },
  ],
});
