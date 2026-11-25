/**
 * Identity services (My account, brief §4): password change and signing-PIN change go to the auth server; a PIN change is
 * confirmed with Nafath (the user approves the request in the Nafath app). The stubs answer like the server would for the
 * demo: the current password is anything but "wrong-password", the current PIN is 2580, and Nafath approves after a moment.
 */
export interface IdentityService {
  changePassword(current: string, next: string): Promise<{ ok: true } | { ok: false; reason: "current" }>
  /** Sends a Nafath request; resolves when it's approved in the app (or declined). */
  confirmWithNafath(purpose: "pin"): Promise<{ approved: boolean; number: number }>
  changePin(current: string, next: string): Promise<{ ok: true } | { ok: false; reason: "current" }>
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const identity: IdentityService = {
  async changePassword(current) {
    await wait(600)
    return current === "wrong-password" ? { ok: false, reason: "current" } : { ok: true }
  },
  async confirmWithNafath() {
    await wait(900)
    return { approved: true, number: 42 }
  },
  async changePin(current) {
    await wait(400)
    return current === "2580" ? { ok: true } : { ok: false, reason: "current" }
  },
}
