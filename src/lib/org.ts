import type { Bi } from "@/lib/mock/bi"

/**
 * The center's identity (Settings › General, design v9.0): names per language (the short name is the SMS sender), legal and
 * licence ids, contact. It feeds the printed documents — tax invoices and credit notes (ZATCA seller), contracts, medical
 * reports — which read it through the getters on their module's CENTER. Saved values reach the app through <PermissionsGate>
 * (the server render keeps the defaults).
 */
export type OrgIdentity = {
  name: Bi
  short: Bi
  /** Commercial registration: 10 digits. */
  cr: string
  /** VAT number: 15 digits, starts and ends with 3. */
  vat: string
  moh: string
  mohExpires: string
  cchi: string
  nphies: string
  phone: string
  email: string
  website: string
  mainBranch: string
  /** Uploaded logo (data URL); the initials tile shows when there's none. */
  logo?: string
}

export const ORG_DEFAULT: OrgIdentity = {
  name: { en: "Al Noor Medical Center", ar: "مجمع النور الطبي" },
  short: { en: "Al Noor", ar: "النور" },
  cr: "1010567890",
  vat: "310123456700003",
  moh: "MOH-1401-22341",
  mohExpires: "2027-08-14",
  cchi: "CCHI-HP-0457",
  nphies: "PR-10023481",
  phone: "920000000",
  email: "info@alnoor.sa",
  website: "alnoor.sa",
  mainBranch: "olaya",
}

let live: OrgIdentity | null = null
export function setOrgGate(o: OrgIdentity | null) {
  live = o
}
/** The center as saved (defaults on the server and before any change). */
export const org = (): OrgIdentity => live ?? ORG_DEFAULT

/* ------------------------------------------------------------------ validation (brief §4 · Organisation) */

export const VALID = {
  cr: (v: string) => /^[1-7]\d{9}$/.test(v),
  vat: (v: string) => /^3\d{13}3$/.test(v),
  moh: (v: string) => /^MOH-\d{4}-\d{5}$/.test(v),
  cchi: (v: string) => !v || /^CCHI-[A-Z]{2}-\d{4}$/.test(v),
  nphies: (v: string) => !v || /^PR-\d{8}$/.test(v),
  phone: (v: string) => /^(9200\d{5}|01\d{8}|05\d{8})$/.test(v),
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v),
  website: (v: string) => !v || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v.replace(/^https?:\/\//, "")),
}
