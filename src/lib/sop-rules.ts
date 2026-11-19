/**
 * Technical rules of the New Outlet Launch SOP v2, checked automatically.
 *   Slide 4  — 3-phase power only; sanctioned load by store size.
 *   Slide 8  — AC type by store size; minimum 1 ton per 150 sq ft (always rounded up).
 *   Slide 6  — T-7: the external sign board is completed and all materials ordered at least
 *              7 days before the key handover.
 */

/** Slide 4 "3-phase power load requirements (kW-wise by store size)". */
export const POWER_LOAD_TABLE: readonly { upToSqft: number; kw: number }[] = [
  { upToSqft: 500, kw: 7.5 },
  { upToSqft: 1000, kw: 15 },
  { upToSqft: 1500, kw: 20 },
  { upToSqft: 2000, kw: 25 },
  { upToSqft: 3000, kw: 30 },
];

export const THREE_PHASE = "3-Phase";
export const SINGLE_PHASE = "Single phase";
export const SUPPLY_OPTIONS = [THREE_PHASE, SINGLE_PHASE];

/** Minimum sanctioned load for a store size. Above 3,000 sq ft the table ends: 30 kW is the
 * minimum and the size is flagged as beyond the table. */
export function requiredLoadKw(areaSqft: number): { kw: number; beyondTable: boolean } {
  const row = POWER_LOAD_TABLE.find((r) => areaSqft <= r.upToSqft);
  return row ? { kw: row.kw, beyondTable: false } : { kw: POWER_LOAD_TABLE[POWER_LOAD_TABLE.length - 1].kw, beyondTable: true };
}

/** Problems with a site's power, as messages (empty = OK). */
export function powerLoadProblems(areaSqft: number | null, supply: unknown, kw: unknown): string[] {
  const out: string[] = [];
  if (supply !== undefined && supply !== null && supply !== THREE_PHASE) {
    out.push("A 3-phase power connection is mandatory — single-phase connections are not accepted (SOP slide 4).");
  }
  if (!areaSqft) {
    out.push("Enter the store size (carpet area) to check the power load.");
    return out;
  }
  if (typeof kw !== "number") return out;
  const need = requiredLoadKw(areaSqft);
  if (kw < need.kw) {
    out.push(`A ${areaSqft.toLocaleString("en-IN")} sq ft store needs at least ${need.kw} kW sanctioned load (3-phase); ${kw} kW is entered (SOP slide 4).`);
  }
  return out;
}

export const AC_SPLIT = "Split AC (back-to-back)";
export const AC_CASSETTE = "Cassette AC";
export const AC_TYPES = [AC_SPLIT, AC_CASSETTE];

/** Slide 8: split ACs below 1,000 sq ft, ceiling cassette ACs from 1,000 sq ft; min 1 ton / 150 sq ft, rounded up. */
export function acRequirement(areaSqft: number): { type: string; minTons: number } {
  return { type: areaSqft < 1000 ? AC_SPLIT : AC_CASSETTE, minTons: Math.ceil(areaSqft / 150) };
}

export function acProblems(areaSqft: number | null, type: unknown, tons: unknown): string[] {
  if (!areaSqft) return ["Enter the store size (carpet area) to check the AC sizing."];
  const need = acRequirement(areaSqft);
  const out: string[] = [];
  if (typeof type === "string" && type !== need.type) out.push(`A ${areaSqft.toLocaleString("en-IN")} sq ft store needs ${need.type} (SOP slide 8); ${type} is entered.`);
  if (typeof tons === "number" && tons < need.minTons) out.push(`Minimum ${need.minTons} ton total for ${areaSqft.toLocaleString("en-IN")} sq ft (1 ton per 150 sq ft, rounded up); ${tons} ton is entered.`);
  return out;
}

/** yyyy-mm-dd ± days. */
export function shiftDate(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Slide 6 T-7 rule: both pre-key steps done, finished on or before handover − 7 days. */
export function preKeyProblems(
  handoverDate: string | null,
  signBoard: { done: boolean; completedOn: string | null },
  materials: { done: boolean; completedOn: string | null },
): string[] {
  const out: string[] = [];
  const limit = handoverDate ? shiftDate(handoverDate, -7) : null;
  const check = (name: string, s: { done: boolean; completedOn: string | null }) => {
    if (!s.done) out.push(`${name} must be done before the key handover.`);
    else if (limit && s.completedOn && s.completedOn > limit) out.push(`${name} was finished on ${s.completedOn}; it must be done by ${limit}, one week before the key handover.`);
  };
  check("The external sign board (6·1)", signBoard);
  check("Material ordering", materials);
  return out;
}

/** Aadhaar: keep only the last 4 digits (the full number is never stored). Returns null if not 12 digits. */
export function maskAadhaar(v: string): string | null {
  const digits = v.replace(/\D/g, "");
  if (/^X{4} X{4} \d{4}$/.test(v.trim())) return v.trim();
  return digits.length === 12 ? `XXXX XXXX ${digits.slice(-4)}` : null;
}

export const PATTERNS = {
  PAN: { regex: "^[A-Z]{5}[0-9]{4}[A-Z]$", message: "PAN must look like ABCDE1234F" },
  IFSC: { regex: "^[A-Z]{4}0[A-Z0-9]{6}$", message: "IFSC must look like HDFC0001234" },
  GSTIN: { regex: "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$", message: "GST number must be 15 characters, like 29ABCDE1234F1Z5" },
  ACCOUNT: { regex: "^[0-9]{9,18}$", message: "Bank account number must be 9–18 digits" },
  PHONE: { regex: "^\\+?[0-9][0-9 -]{8,14}[0-9]$", message: "Enter a valid phone number (at least 10 digits)" },
} as const;
