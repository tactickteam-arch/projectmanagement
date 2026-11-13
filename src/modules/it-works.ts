import type { ModuleDefinition } from "./types";

// Spec: "7. IT Works". Offsets are spec placeholders.
export const itWorks: ModuleDefinition = {
  moduleType: "IT_WORKS",
  displayName: "IT Works",
  sortOrder: 7,
  phase: "fitout",
  defaultStartOffsetDays: 10,
  defaultDurationDays: 7,
  minPhotos: 1,
  fields: [
    { key: "internetProvider", label: "Internet provider", type: "text" },
    { key: "connectionId", label: "Connection ID", type: "text" },
    { key: "speedMbps", label: "Speed", type: "number", unit: "Mbps", min: 0 },
    { key: "backupLine", label: "Backup line", type: "yesno" },
    { key: "posPcs", label: "Number of POS / billing PCs", type: "number", min: 0 },
    { key: "printers", label: "Number of printers", type: "number", min: 0 },
    { key: "barcodeScanners", label: "Number of barcode scanners", type: "number", min: 0 },
    { key: "cctvCameras", label: "Number of CCTV cameras", type: "number", min: 0 },
    { key: "nvrInstalled", label: "NVR installed", type: "yesno" },
    { key: "remoteViewingEnabled", label: "Remote viewing enabled", type: "yesno" },
    { key: "billingSoftwareInstalled", label: "Billing software installed", type: "yesno" },
    { key: "gstLinked", label: "GST linked", type: "yesno" },
    { key: "testBillDone", label: "Test bill done", type: "yesno" },
  ],
};
