// GST helpers for tax invoices and quotations. Isomorphic.
import { DEFAULT_COMPANY, type CompanyProfile } from "./company";

export const GST_RATES = [0, 5, 12, 18, 28] as const;

/** SAC for information technology design and development services. */
export const DEFAULT_SAC = "998314";

/** GST state and union territory codes. */
export const INDIAN_STATES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

// Codes still found on older GSTINs.
const LEGACY_CODES: Record<string, string> = {
  "25": "Dadra and Nagar Haveli and Daman and Diu",
  "28": "Andhra Pradesh",
  "97": "Other Territory",
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isValidGstin(s: string | null | undefined): boolean {
  return typeof s === "string" && GSTIN_RE.test(s.trim().toUpperCase());
}

export function stateFromGstin(s: string | null | undefined): string | null {
  if (typeof s !== "string") return null;
  const code = s.trim().slice(0, 2);
  if (!/^\d{2}$/.test(code)) return null;
  return INDIAN_STATES.find((st) => st.code === code)?.name ?? LEGACY_CODES[code] ?? null;
}

/** Canonical state name for comparisons: accepts a name in any case or a two-digit code. */
function canonicalState(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return "";
  if (/^\d{2}$/.test(t)) return (INDIAN_STATES.find((st) => st.code === t)?.name ?? LEGACY_CODES[t] ?? t).toLowerCase();
  const byName = INDIAN_STATES.find((st) => st.name.toLowerCase() === t.toLowerCase());
  return (byName?.name ?? t).toLowerCase();
}

/** Client state, else the state from the client's GSTIN, else the company's state. */
export function placeOfSupplyFor(client?: { state?: string; gstin?: string } | null, company?: CompanyProfile): string {
  const state = client?.state?.trim();
  if (state) return state;
  const fromGstin = stateFromGstin(client?.gstin);
  if (fromGstin) return fromGstin;
  return company?.state || DEFAULT_COMPANY.state;
}

const paise = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** CGST + SGST when supplier and place of supply are the same state, IGST otherwise. Values are rounded to paise. */
export function gstSplit(o: { taxable: number; rate: number; supplierState: string; placeOfSupply: string }): {
  intraState: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  total: number;
} {
  const taxable = paise(o.taxable);
  const rate = Number(o.rate) || 0;
  const tax = paise((taxable * rate) / 100);
  const supplier = canonicalState(o.supplierState);
  const pos = canonicalState(o.placeOfSupply);
  const intraState = !!supplier && supplier === pos;
  if (intraState) {
    const cgst = paise(tax / 2);
    const sgst = paise(tax - cgst);
    return { intraState, cgst, sgst, igst: 0, tax, total: paise(taxable + tax) };
  }
  return { intraState, cgst: 0, sgst: 0, igst: tax, tax, total: paise(taxable + tax) };
}
