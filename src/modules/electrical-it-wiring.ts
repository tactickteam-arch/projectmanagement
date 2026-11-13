import type { ModuleDefinition } from "./types";

// Spec: "5. Electrical and IT Wiring". Offsets are spec placeholders.
export const electricalItWiring: ModuleDefinition = {
  moduleType: "ELECTRICAL_IT_WIRING",
  displayName: "Electrical and IT Wiring",
  sortOrder: 5,
  phase: "fitout",
  defaultStartOffsetDays: 0,
  defaultDurationDays: 10,
  minPhotos: 1,
  fields: [
    { key: "sanctionedLoadKw", label: "Sanctioned load", type: "number", unit: "kW", min: 0 },
    { key: "newMeterOrLoadEnhancement", label: "New meter or load enhancement applied", type: "yesno" },
    { key: "applicationNumber", label: "Application number", type: "text" },
    { key: "electricityBoard", label: "Electricity board name", type: "text" },
    { key: "distributionBoardInstalled", label: "Distribution board installed", type: "yesno" },
    { key: "earthingDone", label: "Earthing done", type: "yesno" },
    { key: "upsInverterBackup", label: "UPS / inverter backup", type: "yesno" },
    { key: "powerPoints", label: "Number of power points", type: "number", min: 0 },
    { key: "lanPoints", label: "Number of LAN points", type: "number", min: 0 },
    { key: "cctvCablingDone", label: "CCTV cabling done", type: "yesno" },
    { key: "electricalSafetyCheckDone", label: "Electrical safety check done", type: "yesno" },
  ],
};
