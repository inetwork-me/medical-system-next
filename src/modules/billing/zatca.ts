import { CENTER, type Invoice, type ZatcaRecord } from "./data"
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

/* ------------------------------------------------------------------ QR (TLV) */

const te = new TextEncoder()

/** One TLV field: tag (1 byte), length (1 byte, UTF-8 byte length), value. */
function tlv(tag: number, value: string): number[] {
  const v = Array.from(te.encode(value))
  if (v.length > 255) throw new Error(`ZATCA TLV tag ${tag} is longer than 255 bytes`)
  return [tag, v.length, ...v]
}

const toBase64 = (bytes: number[]) => {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return typeof btoa === "function" ? btoa(s) : Buffer.from(bytes).toString("base64")
}

/** Riyadh wall-clock "2026-11-19T10:58" → UTC "2026-11-19T07:58:00Z" (KSA is UTC+3, no DST). */
export function zatcaTimestamp(local: string) {
  const d = new Date(`${local.length === 16 ? `${local}:00` : local}+03:00`)
  return d.toISOString().replace(/\.\d{3}Z$/, "Z")
}

/**
 * The invoice's QR payload (ZATCA e-invoicing): base64 of the TLV fields
 *   1 seller name · 2 VAT registration no. · 3 time stamp · 4 total with VAT · 5 VAT total · 6 invoice hash.
 * Phase 2 adds 7 ECDSA signature · 8 public key · 9 the stamp's signature (simplified invoices) — those come from the
 * signing SDK with the CSID; a cleared standard invoice carries the QR ZATCA returns, which replaces this one.
 */
export function zatcaQrPayload(inv: Invoice, sellerName = CENTER.name.ar, vatNo = CENTER.vatNo) {
  const t = totals(inv)
  const bytes = [
    ...tlv(1, sellerName),
    ...tlv(2, vatNo),
    ...tlv(3, zatcaTimestamp(inv.issuedAt)),
    ...tlv(4, t.total.toFixed(2)),
    ...tlv(5, t.vat.toFixed(2)),
    ...tlv(6, inv.zatca.hash),
  ]
  return toBase64(bytes)
}

/** Decode a TLV payload back to its fields (dev stories / tests). */
export function readZatcaQr(b64: string): Record<number, string> {
  const raw = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary")
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0))
  const out: Record<number, string> = {}
  const td = new TextDecoder()
  for (let i = 0; i + 1 < bytes.length; ) {
    const tag = bytes[i]
    const len = bytes[i + 1]
    out[tag] = td.decode(bytes.slice(i + 2, i + 2 + len))
    i += 2 + len
  }
  return out
}
