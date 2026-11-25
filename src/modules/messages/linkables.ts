import type { Bi } from "@/lib/mock/bi"
import { CLAIMS, CONTRACTS, INSURERS, INVOICES } from "@/modules/billing/data"
import { ENCOUNTERS, PATIENTS, REQUESTS } from "@/modules/records/data"
import type { LinkKind, RecordLink } from "./types"

/*
 * Link to a record: what an email can be linked to, from the modules that own the records — patients and visits (Medical
 * records), invoices, claims and contracts (Billing), records requests (Medical records). A claim that isn't submitted yet
 * has no number: it's offered as "Claim with {insurer}" for an insured invoice without a claim.
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })
type Pt = { name: Bi; mrn: string; sex: "m" | "f" }
const pts = PATIENTS as unknown as Record<string, Pt>
const insurer = (id: string) => INSURERS.find((i) => i.id === id)
const dm = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00`)
  return bi(`${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}`, `${d.getDate()} ${new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { month: "long" }).format(d)}`)
}

export type Linkable = RecordLink & { icon: string; search: string; patientName?: Bi }

function entry(kind: LinkKind, ref: string, label: Bi, sub: Bi, icon: string, patient?: string): Linkable {
  const p = patient ? pts[patient] : undefined
  const search = [ref, label.en, label.ar, sub.en, sub.ar, p?.name.en, p?.name.ar, p?.mrn].filter(Boolean).join(" ").toLowerCase()
  return { kind, ref, label, sub, icon, patient, search, patientName: p?.name }
}

let cache: Linkable[] | null = null

export function linkables(): Linkable[] {
  if (cache) return cache
  const out: Linkable[] = []
  for (const [key, p] of Object.entries(pts)) out.push(entry("patient", p.mrn, p.name, bi(`Patient · ${p.mrn}`, `مريض · ${p.mrn}`), "profile-2user", key))
  for (const e of ENCOUNTERS) {
    const d = dm(e.at)
    out.push(entry("visit", e.id, bi(`Visit ${e.id}`, `الزيارة ${e.id}`), bi(`${d.en} · ${e.clinic.en.toLowerCase()}`, `${d.ar} · ${e.clinic.ar}`), "calendar", e.patient))
  }
  const claimed = new Set(CLAIMS.map((c) => c.invoiceNo))
  for (const inv of INVOICES) {
    const ins = inv.payer === "cash" ? undefined : insurer(inv.payer)
    const payer = ins ? ins.name : bi("Cash", "كاش")
    out.push(entry("invoice", inv.no, bi(`Invoice ${inv.no}`, `الفاتورة ${inv.no}`), bi(`${payer.en} · ${dm(inv.issuedAt).en}`, `${payer.ar} · ${dm(inv.issuedAt).ar}`), "receipt-2", inv.patient))
    if (ins && !claimed.has(inv.no))
      out.push(entry("claim", `draft:${inv.no}`, bi(`Claim with ${ins.short.en}`, `مطالبة ${ins.short.ar}`), bi("Not submitted · no number yet", "ما انرفعت · ما لها رقم للحين"), "shield-tick", inv.patient))
  }
  for (const c of CLAIMS) {
    const ins = insurer(c.insurer)
    out.push(entry("claim", c.no, bi(`Claim ${c.no}`, `المطالبة ${c.no}`), bi(`${ins?.name.en ?? c.insurer} · ${c.service.en}`, `${ins?.name.ar ?? c.insurer} · ${c.service.ar}`), "shield-tick", c.patient))
  }
  for (const c of CONTRACTS) out.push(entry("contract", c.no, bi(`Contract ${c.no}`, `العقد ${c.no}`), c.party.name, "document-text"))
  for (const r of REQUESTS) out.push(entry("request", r.no, bi(`Request ${r.no}`, `الطلب ${r.no}`), r.requester, "document-text", r.patient))
  cache = out
  return out
}

/** Search by name, MRN or number; patient first, then their visits, invoices and claims (as drawn). */
export function searchLinkables(q: string, limit = 6): Linkable[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const order: LinkKind[] = ["patient", "visit", "invoice", "claim", "contract", "request", "preauth", "referral"]
  return linkables()
    .filter((x) => words.every((w) => x.search.includes(w)))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.ref.localeCompare(a.ref))
    .slice(0, limit)
}

export const patientSex = (key?: string) => (key && pts[key]?.sex) || "m"
export const patientOfKey = (key?: string) => (key ? pts[key] : undefined)
