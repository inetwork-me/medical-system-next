/**
 * Billing routes. Records are query params (`/billing/invoices/invoice?no=INV-2611-0241`) so the app also runs as a
 * static export, like the Lab order and Patients record pages. Each inner page lives under its tab's path (Invoice →
 * /billing/invoices/…), so the nav keeps that tab active, and when that tab is off for the branch the page and every
 * link into it are off too.
 */
export const BILLING_HREF = "/billing"
export const INVOICES_HREF = "/billing/invoices"
export const CLAIMS_HREF = "/billing/claims"
export const INSURERS_HREF = "/billing/insurers"
export const CONTRACTS_HREF = "/billing/contracts"

export const invoiceHref = (no: string) => `/billing/invoices/invoice?${new URLSearchParams({ no })}`
export const claimsHref = (query?: { q?: string; filter?: string }) => {
  const q = new URLSearchParams(Object.entries(query ?? {}).filter(([, v]) => v) as [string, string][]).toString()
  return q ? `${CLAIMS_HREF}?${q}` : CLAIMS_HREF
}
export const insurerHref = (id: string) => `/billing/insurers/insurer?${new URLSearchParams({ id })}`
export const contractHref = (no: string) => `/billing/contracts/contract?${new URLSearchParams({ no })}`
export const newContractHref = (kind?: "staff" | "partner" | "insurer") => (kind ? `/billing/contracts/new?${new URLSearchParams({ kind })}` : "/billing/contracts/new")
