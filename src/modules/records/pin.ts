/**
 * Signing PIN (4 digits, set in the doctor's profile). Behind an interface so the real check (the auth service,
 * never the browser) drops in later; the stub accepts any 4 digits except "0000", which stands for a wrong PIN.
 */
export type PinCheck = { ok: true } | { ok: false; reason: "wrong" | "locked" }

export interface PinService {
  verify(userId: string, pin: string): Promise<PinCheck>
}

export const PIN_LENGTH = 4
export const validPinShape = (pin: string) => pin.length === PIN_LENGTH && /^[0-9]+$/.test(pin)

export const pinStub: PinService = {
  async verify(_userId, pin) {
    await new Promise((r) => setTimeout(r, 300))
    return pin === "0000" ? { ok: false, reason: "wrong" } : { ok: true }
  },
}

export const pinService: PinService = pinStub
