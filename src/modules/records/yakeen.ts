import type { IdType } from "./visits-data"

/**
 * Yakeen (Elm): checks a National ID / Iqama / GCC ID against the person on file before it's saved. Behind an
 * interface so the real Yakeen client replaces the stub. Passports aren't in Yakeen. The stub turns down numbers
 * ending in 000 (no match) so the error path can be tried.
 */
export type YakeenQuery = { idType: Exclude<IdType, "passport">; idNumber: string; name: string }
export type YakeenResult = { ok: true } | { ok: false; reason: "noMatch" | "unavailable" }

export interface YakeenClient {
  verify(q: YakeenQuery): Promise<YakeenResult>
}

export const yakeenStub: YakeenClient = {
  async verify(q) {
    await new Promise((r) => setTimeout(r, 500))
    return q.idNumber.endsWith("000") ? { ok: false, reason: "noMatch" } : { ok: true }
  },
}

export const yakeen: YakeenClient = yakeenStub
