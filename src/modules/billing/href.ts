/**
 * Billing routes. Records are query params (`/billing/invoices/invoice?no=INV-2611-0241`) so the app also runs as a
 * static export, like the Lab order and Patients record pages. Each inner page lives under its tab's path (Invoice →
 * /billing/invoices/…), so the nav keeps that tab active, and when that tab is off for the branch the page and every
 * link into it are off too.
 */
export const BILLING_HREF = "/billing"
export const INVOICES_HREF = "/billing/invoices"
/** New invoice by hand (inner page of Invoices). */
export const NEW_INVOICE_HREF = "/billing/invoices/new"
export const CLAIMS_HREF = "/billing/claims"
export const INSURERS_HREF = "/billing/insurers"
export const CONTRACTS_HREF = "/billing/contracts"

export const invoiceHref = (no: string) => `/billing/invoices/invoice?${new URLSearchParams({ no })}`
/** Credit note page (inner page of Invoices): `/billing/invoices/credit-note?no=CN-2611-0012`. */
export const creditNoteHref = (no: string) => `/billing/invoices/credit-note?${new URLSearchParams({ no })}`
export const claimsHref = (query?: { q?: string; filter?: string }) => {
  const q = new URLSearchParams(Object.entries(query ?? {}).filter(([, v]) => v) as [string, string][]).toString()
  return q ? `${CLAIMS_HREF}?${q}` : CLAIMS_HREF
}
export const insurerHref = (id: string) => `/billing/insurers/insurer?${new URLSearchParams({ id })}`
export const contractHref = (no: string) => `/billing/contracts/contract?${new URLSearchParams({ no })}`
/** New contract with a type (and optionally a template to start from): `/billing/contracts/new?type=staff&template=…`. */
export const newContractHref = (type?: "staff" | "partner" | "insurer", template?: string) => {
  const q = new URLSearchParams(Object.entries({ type, template }).filter(([, v]) => v) as [string, string][]).toString()
  return q ? `/billing/contracts/new?${q}` : "/billing/contracts/new"
}
/** Templates library (inner page of Contracts); `?id=` selects a template. */
export const TEMPLATES_HREF = "/billing/contracts/templates"
export const templatesHref = (id?: string) => (id ? `${TEMPLATES_HREF}?${new URLSearchParams({ id })}` : TEMPLATES_HREF)
/** Template editor (inner page of Contracts › Templates): `/billing/contracts/templates/edit?id=staff-doctors&v=5`. */
export const templateEditHref = (id: string, v: number) => `/billing/contracts/templates/edit?${new URLSearchParams({ id, v: String(v) })}`
