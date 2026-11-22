/*
 * Nafath (national single sign-on) MFA behind an interface. Signing = a Nafath request on the signer's national ID;
 * Nafath shows a two-digit number, the signer picks it in the Nafath app and approves with face / fingerprint, and the
 * provider polls the request until it's COMPLETED, REJECTED or EXPIRED.
 *
 *   POST /api/v1/mfa/request        { nationalId, service, local }      → { transId, random }
 *   GET  /api/v1/mfa/request/status { nationalId, transId, random }     → { status }
 *
 * The stub answers with the same shapes: the number is 47 (as drawn), the request lives 3 minutes, and it's approved on
 * the 3rd status poll unless told to expire / be rejected.
 */

export type NafathStatus = "WAITING" | "COMPLETED" | "REJECTED" | "EXPIRED"

export type NafathRequest = { nationalId: string; service: "DigitalSigning"; local: "ar" | "en"; requestId: string }
export type NafathStart = { transId: string; random: string; expiresInSec: number }

export interface NafathClient {
  start(req: NafathRequest): Promise<NafathStart>
  status(q: { nationalId: string; transId: string; random: string }): Promise<{ status: NafathStatus }>
}

/** How long a Nafath request stays open. */
export const NAFATH_TTL_SEC = 180
/** How often the dialog polls (the "updates by itself" line); Check again polls at once. */
export const NAFATH_POLL_MS = 2000

export function nafathStub(opts: { approveAfter?: number; outcome?: "COMPLETED" | "REJECTED" | "EXPIRED"; delayMs?: number; fail?: boolean } = {}): NafathClient {
  const polls = new Map<string, number>()
  const later = <T,>(v: () => T) =>
    new Promise<T>((resolve, reject) => setTimeout(() => (opts.fail ? reject(new Error("Nafath unavailable")) : resolve(v())), opts.delayMs ?? 500))
  return {
    start: (req) =>
      later(() => {
        const transId = `NFD-${req.requestId}-${Math.floor(Date.now() / 1000).toString(36).toUpperCase()}`
        polls.set(transId, 0)
        return { transId, random: "47", expiresInSec: NAFATH_TTL_SEC }
      }),
    status: (q) =>
      later(() => {
        const n = (polls.get(q.transId) ?? 0) + 1
        polls.set(q.transId, n)
        if (n < (opts.approveAfter ?? 3)) return { status: "WAITING" as const }
        return { status: opts.outcome ?? "COMPLETED" }
      }),
  }
}

export const nafath: NafathClient = nafathStub()
