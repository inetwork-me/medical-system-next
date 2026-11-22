import type { ContractKind } from "./data"

/**
 * Billing permissions (brief §4):
 * - reception records payments and sends invoices;
 * - billing staff manage claims (submit, fix, ask for pre-auth);
 * - the finance manager manages insurers and their agreements (papers, partner and insurer contracts);
 * - HR drafts staff contracts;
 * - only the authorized signatory (CEO / medical director) signs for the center;
 * - doctors see nothing here except their own contract.
 * "lead" is the demo login: every permission, and it signs as the center's signatory (Faisal Al-Qahtani).
 */
export type BillRole = "reception" | "billing" | "finance" | "hr" | "signatory" | "doctor" | "lead"

export const BILL_ROLES: BillRole[] = ["lead", "reception", "billing", "finance", "hr", "signatory", "doctor"]

export type BillAction =
  | "viewMoney"
  | "collect"
  | "sendInvoice"
  | "claims"
  | "insurers"
  | "upload"
  | "draftStaff"
  | "draftPartner"
  | "draftInsurer"
  | "sign"
  | "allContracts"
  | "export"

const MATRIX: Record<Exclude<BillRole, "lead">, BillAction[]> = {
  reception: ["viewMoney", "collect", "sendInvoice"],
  billing: ["viewMoney", "sendInvoice", "claims", "export"],
  finance: ["viewMoney", "insurers", "upload", "draftPartner", "draftInsurer", "allContracts", "export"],
  hr: ["draftStaff", "upload", "allContracts"],
  signatory: ["viewMoney", "sign", "allContracts", "export"],
  doctor: [],
}

export function billCan(role: BillRole, action: BillAction): boolean {
  if (role === "lead") return true
  return MATRIX[role].includes(action)
}

/** Which module tabs a role sees. Doctors only reach Contracts (their own); HR works in Contracts only. */
export function roleTabs(role: BillRole): string[] {
  if (role === "doctor" || role === "hr") return ["contracts"]
  return ["overview", "invoices", "claims", "insurers", "contracts"]
}

/** Can this role draft a contract of that kind? (HR → staff, finance → partners and insurers) */
export const canDraft = (role: BillRole, kind: ContractKind) =>
  billCan(role, kind === "staff" ? "draftStaff" : kind === "partner" ? "draftPartner" : "draftInsurer")

/** The doctor's own contract is the one whose party points at their Doctors key. Demo doctor: Dr. Lama Al-Saud. */
export const DEMO_DOCTOR_KEY = "saud"
