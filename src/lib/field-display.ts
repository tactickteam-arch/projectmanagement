import type { FieldDef } from "@/modules/types";
import { formatDate } from "./format";

/** Read-only display of a config-driven module field value. */
export function displayValue(field: FieldDef, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  switch (field.type) {
    case "yesno":
      return v === true ? "Yes" : v === false ? "No" : "—";
    case "task":
      return v === true ? "Done" : "Not done";
    case "currency":
      return `₹${Number(v).toLocaleString("en-IN")}`;
    case "percent":
      return `${v}%`;
    case "number":
      return `${Number(v).toLocaleString("en-IN")}${field.unit ? ` ${field.unit}` : ""}`;
    case "multiselect":
      return Array.isArray(v) && v.length ? v.join(", ") : "—";
    case "date":
      return formatDate(String(v));
    default:
      return String(v);
  }
}
