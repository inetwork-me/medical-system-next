import type { Invoice, ZatcaRecord } from "./data"
import { totals } from "./rules"

/*
 * ZATCA e-invoicing (Fatoora, phase 2) behind an interface. Every invoice is either reported (simplified, B2C) or
 * cleared (standard, B2B / insurer) and carries the QR, UUID and hash the API returns. Screens show
 * "ZATCA reported" only once `status` is "reported" or "cleared" — never optimistically.
 *
 * The real client signs the UBL XML with the center's CSID and calls
 *   POST /invoices/reporting/single   (simplified)
 *   POST /invoices/clearance/single   (standard)
 * The stub below answers with the same response shape after a short delay.
 */

export type ZatcaRequest = {
  invoiceHash: string
  uuid: string
  /** Base64 UBL 2.1 XML (signed). */
  invoice: string
}

export type ZatcaResponse = {
  validationResults: {
    status: "PASS" | "WARNING" | "ERROR"
    infoMessages: { code: string; message: string }[]
    warningMessages: { code: string; message: string }[]
    errorMessages: { code: string; message: string }[]
  }
  reportingStatus?: "REPORTED" | "NOT_REPORTED"
  clearanceStatus?: "CLEARED" | "NOT_CLEARED"
  /** Standard invoices come back with the cleared XML (stamped QR). */
  clearedInvoice?: string
}

export interface ZatcaClient {
  report(req: ZatcaRequest, type: ZatcaRecord["type"]): Promise<ZatcaResponse>
}

/** Stub: passes after ~1.2 s. `fail` makes the next call return a validation error (dev stories). */
export function zatcaStub(opts: { delayMs?: number; fail?: boolean } = {}): ZatcaClient {
  return {
    report: (req, type) =>
      new Promise((resolve) =>
        setTimeout(() => {
          const errorMessages = opts.fail ? [{ code: "BR-KSA-37", message: "Seller VAT number does not match the CSID" }] : []
          resolve({
            validationResults: { status: opts.fail ? "ERROR" : "PASS", infoMessages: [], warningMessages: [], errorMessages },
            ...(type === "simplified" ? { reportingStatus: opts.fail ? "NOT_REPORTED" : "REPORTED" } : { clearanceStatus: opts.fail ? "NOT_CLEARED" : "CLEARED" }),
            ...(type === "standard" && !opts.fail ? { clearedInvoice: req.invoice } : {}),
          })
        }, opts.delayMs ?? 1200)
      ),
  }
}

/** The request for an invoice (stub XML: the totals the QR carries). */
export function zatcaRequest(inv: Invoice): ZatcaRequest {
  const t = totals(inv)
  const xml = `<Invoice><ID>${inv.no}</ID><UUID>${inv.zatca.uuid}</UUID><IssueDate>${inv.issuedAt}</IssueDate><TaxTotal>${t.vat}</TaxTotal><Total>${t.total}</Total></Invoice>`
  return { invoiceHash: inv.zatca.hash, uuid: inv.zatca.uuid, invoice: typeof btoa === "function" ? btoa(xml) : xml }
}

/** Apply the API's answer to the invoice's ZATCA record. */
export function applyZatca(inv: Invoice, res: ZatcaResponse, at: string): Invoice {
  const ok = res.reportingStatus === "REPORTED" || res.clearanceStatus === "CLEARED"
  return {
    ...inv,
    zatca: { ...inv.zatca, status: ok ? (inv.zatca.type === "standard" ? "cleared" : "reported") : "failed", reportedAt: ok ? at : undefined },
  }
}

export const zatca: ZatcaClient = zatcaStub()
