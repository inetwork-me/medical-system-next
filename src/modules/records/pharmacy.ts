/**
 * Pharmacy link (e-prescription): the prescription goes to the patient by SMS with a code any pharmacy can scan;
 * the dispensing status comes back. Behind an interface so the national e-prescription service replaces the stub.
 * The stub hands out a code at once and reports the prescription dispensed 20 seconds after it was sent.
 */
export type RxSent = { code: string; sentTo: string }
export type RxDispensing = { status: "sent" | "dispensed"; at?: string; pharmacy?: { en: string; ar: string } }

export interface PharmacyLink {
  send(input: { no: string; mobile?: string }): Promise<RxSent>
  status(no: string): Promise<RxDispensing>
}

const DISPENSE_AFTER_MS = 20_000
const sentAt = new Map<string, number>()

const codeOf = (no: string) => {
  let h = 7
  for (const c of no) h = (h * 31 + c.charCodeAt(0)) % 1_679_616
  const s = h.toString(36).toUpperCase().padStart(4, "0")
  return `${s.slice(0, 3)}-${no.slice(-3)}`
}

export const pharmacyStub: PharmacyLink = {
  async send({ no, mobile }) {
    await new Promise((r) => setTimeout(r, 400))
    sentAt.set(no, Date.now())
    return { code: codeOf(no), sentTo: mobile ?? "" }
  },
  async status(no) {
    const at = sentAt.get(no)
    if (at && Date.now() - at > DISPENSE_AFTER_MS) return { status: "dispensed", pharmacy: { en: "Al-Nahdi pharmacy · Olaya", ar: "صيدلية النهدي · العليا" } }
    return { status: "sent" }
  },
}

export const pharmacyLink: PharmacyLink = pharmacyStub
