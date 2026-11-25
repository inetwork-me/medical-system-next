/**
 * Integration services (Settings › Integrations, brief §4 · Integrations). The app talks to each outside service through
 * these interfaces; the real clients run on the server with their credentials (NPHIES and ZATCA client certificates, Seha /
 * Yakeen / Nafath API keys, the mada terminal gateway, the HL7 listener). The stubs below answer like the services would for
 * the demo: everything healthy except mada terminal 2 at Malaz (offline), and ZATCA accepts any 6-digit portal code but
 * "000000" (expired).
 */
export type IntegrationId = "nphies" | "zatca" | "seha" | "yakeen" | "nafath" | "m365" | "sms" | "mada" | "hl7"

export type TestResult = {
  ok: boolean
  /** Round trip in seconds. */
  seconds: number
  /** Something answered but needs a look (a terminal offline). */
  warning?: { en: string; ar: string }
}

export interface IntegrationService {
  id: IntegrationId
  /** Health check: a harmless call that proves the credentials and the network path work. */
  test(): Promise<TestResult>
}

/** ZATCA (Fatoora) — EGS units, one per branch: clearance for standard invoices, reporting within 24 h for simplified. */
export interface ZatcaService extends IntegrationService {
  /**
   * Renew a unit's compliance certificate (CSID) with the one-time code from the Fatoora portal (valid 1 hour). The unit keeps
   * signing invoices with the current certificate until the new one is issued.
   */
  renewCertificate(unit: string, otp: string): Promise<{ ok: true; validUntil: string } | { ok: false; reason: "otp" }>
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function stub(id: IntegrationId, seconds: number, warning?: TestResult["warning"]): IntegrationService {
  return {
    id,
    async test() {
      await wait(500)
      return { ok: true, seconds, warning }
    },
  }
}

export const zatca: ZatcaService = {
  id: "zatca",
  async test() {
    await wait(500)
    return { ok: true, seconds: 0.4 }
  },
  async renewCertificate(_unit, otp) {
    await wait(900)
    if (otp === "000000") return { ok: false, reason: "otp" }
    // New certificates run a year from the old one's expiry.
    return { ok: true, validUntil: "" }
  },
}

export const SERVICES: Record<Exclude<IntegrationId, "m365" | "sms">, IntegrationService> = {
  nphies: stub("nphies", 0.4),
  zatca,
  seha: stub("seha", 0.6),
  yakeen: stub("yakeen", 0.3),
  nafath: stub("nafath", 0.5),
  mada: stub("mada", 0.8, { en: "Malaz terminal 2 is still offline · check its power and network cable", ar: "جهاز الملز 2 لسا مفصول · شيّك على الكهرباء وسلك الشبكة" }),
  hl7: stub("hl7", 0.2),
}
