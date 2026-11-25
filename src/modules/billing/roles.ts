import type { ContractKind } from "./data"
import { can, type PermAction } from "@/lib/permissions"

/**
 * Billing permissions (brief §4):
 * - reception records payments and sends invoices;
 * - billing staff manage claims (submit, fix, ask for pre-auth);
 * - the finance manager manages insurers and their agreements (papers, partner and insurer contracts);
 * - HR drafts staff contracts;
 * - only the authorized signatory (CEO / medical director) signs for the center;
 * - doctors see nothing here except their own contract.
 * "lead" is the demo role: every permission. Signing also needs the signed-in user to be an authorized signatory and
 * the next signer (session.ts) — the role alone never signs for someone else.
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
  /** Issue a credit note (refunds up to the approval limit). */
  | "creditNote"
  /** Approve refunds over the limit (finance manager). */
  | "approveRefund"
  /** New invoice by hand (billing staff and the finance manager). */
  | "newInvoice"

const MATRIX: Record<Exclude<BillRole, "lead">, BillAction[]> = {
  reception: ["viewMoney", "collect", "sendInvoice", "creditNote"],
  billing: ["viewMoney", "sendInvoice", "claims", "export", "newInvoice"],
  finance: ["viewMoney", "insurers", "upload", "draftPartner", "draftInsurer", "allContracts", "export", "creditNote", "approveRefund", "newInvoice"],
  hr: ["draftStaff", "upload", "allContracts"],
  signatory: ["viewMoney", "sign", "allContracts", "export"],
  doctor: [],
}

/** The permission-matrix action each billing action needs (Settings › Roles and access); the module role narrows it further. */
const PERM: Record<BillAction, PermAction> = {
  viewMoney: "view",
  allContracts: "view",
  collect: "create",
  sendInvoice: "create",
  upload: "create",
  draftStaff: "create",
  draftPartner: "create",
  draftInsurer: "create",
  creditNote: "create",
  newInvoice: "create",
  claims: "edit",
  insurers: "edit",
  sign: "approve",
  approveRefund: "approve",
  export: "export",
}

export function billCan(role: BillRole, action: BillAction): boolean {
  if (!can("billing", PERM[action])) return false
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
