/**
 * Patient messaging gateways (brief §4 · Patient messages): an SMS gateway and WhatsApp Business, sender name "AlNoor".
 * The server sends, tracks delivery (sent → delivered → read → replied, or failed) and receives replies into reception's
 * patient inbox; replies of "1" / "2" to a reminder update the appointment request. These stubs answer like the gateways:
 * - numbers in UNREACHABLE fail (Yousef's father's number today);
 * - WhatsApp fails for numbers without WhatsApp, and the caller falls back to SMS when the patient agreed to it;
 * - WhatsApp outside a 24-hour reply window only takes Meta-approved templates.
 */
export type GatewayResult = { id: string; state: "delivered" | "failed"; reason?: "unreachable" | "noWhatsapp" }

export interface SmsGateway {
  send(to: string, text: string, sender: string): Promise<GatewayResult>
}
export interface WhatsAppGateway {
  send(to: string, text: string, opts: { template?: string; sessionOpen: boolean }): Promise<GatewayResult>
}

const UNREACHABLE = new Set(["+966592330871"])
const NO_WHATSAPP = new Set(["+966557816620"])
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const id = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`
export const e164 = (mobile: string) => mobile.replace(/\s+/g, "")

export const smsStub: SmsGateway = {
  async send(to) {
    await wait(400)
    return UNREACHABLE.has(e164(to)) ? { id: id("sms"), state: "failed", reason: "unreachable" } : { id: id("sms"), state: "delivered" }
  },
}

export const whatsappStub: WhatsAppGateway = {
  async send(to) {
    await wait(500)
    if (UNREACHABLE.has(e164(to))) return { id: id("wa"), state: "failed", reason: "unreachable" }
    if (NO_WHATSAPP.has(e164(to))) return { id: id("wa"), state: "failed", reason: "noWhatsapp" }
    return { id: id("wa"), state: "delivered" }
  },
}

/** SMS parts: GSM-7 160 (153 per part when split); Arabic / Unicode 70 (67 per part). */
export function smsParts(text: string) {
  const unicode = /[^\u0000-\u007F]/.test(text)
  const one = unicode ? 70 : 160
  const per = unicode ? 67 : 153
  const n = text.length
  return { chars: n, parts: n === 0 ? 0 : n <= one ? 1 : Math.ceil(n / per) }
}

/** Results or diagnoses must never go by SMS / WhatsApp: diagnosis codes and lab values with units. */
export function clinicalContent(text: string) {
  return /\b[A-TV-Z]\d{2}(?:\.\d{1,2})?\b/.test(text) || /\b\d+(?:\.\d+)?\s?(?:mmol\/L|mg\/dL|g\/dL|mEq\/L|IU\/L|ng\/mL|U\/L)\b/i.test(text)
}
