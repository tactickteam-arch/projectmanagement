/**
 * Store code SGM-<STATE>-<CITY>-<NNNN> (spec), e.g. SGM-KA-BLR-0142.
 * Demo decisions (OPEN_QUESTIONS.md Q5): city code from a known list, else the first three
 * letters of the city; NNNN is one running number across all stores.
 */
const CITY_CODES: Record<string, string> = {
  bengaluru: "BLR", bangalore: "BLR", mysuru: "MYS", mysore: "MYS", mangaluru: "MLR", hubballi: "HBL",
  chennai: "CHE", coimbatore: "CBE", madurai: "MDU", tiruchirappalli: "TRY",
  hyderabad: "HYD", secunderabad: "SEC", warangal: "WGL",
  visakhapatnam: "VSK", vijayawada: "VJA", tirupati: "TPT",
  kochi: "KOC", cochin: "KOC", thiruvananthapuram: "TVM", kozhikode: "CLT", thrissur: "TCR",
  mumbai: "MUM", pune: "PUN", nagpur: "NAG", nashik: "NSK",
  delhi: "DEL", "new delhi": "DEL", gurugram: "GGN", noida: "NOI",
  kolkata: "KOL", ahmedabad: "AMD", surat: "SUR", jaipur: "JAI", lucknow: "LKO", bhubaneswar: "BBI",
  chandigarh: "CHD", indore: "IDR", bhopal: "BPL", patna: "PAT", guwahati: "GAU", goa: "GOA", panaji: "PNJ",
};

export function cityCode(city: string): string {
  const key = city.trim().toLowerCase();
  if (CITY_CODES[key]) return CITY_CODES[key];
  const letters = key.replace(/[^a-z]/g, "").toUpperCase();
  return (letters + "XXX").slice(0, 3);
}

export function formatStoreCode(state: string, city: string, serial: number): string {
  return `SGM-${state}-${cityCode(city)}-${String(serial).padStart(4, "0")}`;
}

export function serialFromCode(code: string): number {
  const m = /-(\d{4,})$/.exec(code);
  return m ? Number(m[1]) : 0;
}
