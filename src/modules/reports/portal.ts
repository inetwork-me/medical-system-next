import { FACILITY_CODE, type Authority, type OfficialReturn } from "./returns-data"

/*
 * Portal clients and the signing PIN, as stubs. Submitting goes through the authority's client (MOH, HESN, CCHI,
 * ZATCA), which answers with a reference; the PIN is checked by the auth service, never the browser. Replace the
 * stubs with the real clients; the screens only see these interfaces.
 */

export type PortalResult = { ok: true; reference: string } | { ok: false; reason: "portal-down" }
export interface PortalClient {
  submit(r: OfficialReturn, file: Blob | null): Promise<PortalResult>
}

const stubClient = (authority: Authority): PortalClient => ({
  async submit(r) {
    await new Promise((x) => setTimeout(x, 400))
    return { ok: true, reference: `${authority}-${r.code}-${FACILITY_CODE.slice(3)}` }
  },
})

export const PORTALS: Record<Authority, PortalClient> = {
  MOH: stubClient("MOH"),
  HESN: stubClient("HESN"),
  CCHI: stubClient("CCHI"),
  ZATCA: stubClient("ZATCA"),
}

export type PinCheck = { ok: true } | { ok: false; reason: "wrong" }
export const PIN_LENGTH = 4
export const validPin = (pin: string) => pin.length === PIN_LENGTH && /^[0-9]+$/.test(pin)

/** Stub: any 4 digits pass except "0000", which stands for a wrong PIN. */
export async function verifySigningPin(_userId: string, pin: string): Promise<PinCheck> {
  await new Promise((x) => setTimeout(x, 300))
  return pin === "0000" ? { ok: false, reason: "wrong" } : { ok: true }
}
