/**
 * Verifier for the `his_session` cookie the API sets (docs/api/auth.md in the API repo).
 *
 * Value: `<token>.<expiry unix seconds>.<lower-case hex HMAC-SHA256 of "<token>.<expiry>">`, key = HIS_SESSION_COOKIE_KEY
 * used as it is (UTF-8). The token has no dots, so the value is split on the last two dots. Used by the proxy to decide
 * whether a page may load. It makes no network call and never returns or logs the token: the answer is yes or no.
 *
 * Only Web Crypto and no imports, so it runs in the proxy and in plain Node tests.
 */
export const API_SESSION_COOKIE = "his_session"

const encoder = new TextEncoder()

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) return null
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Splits `<token>.<expiry>.<mac>` on the last two dots; null when the shape is wrong. */
export function parseSessionCookie(raw: string | undefined | null): { token: string; expiry: number; mac: string } | null {
  if (typeof raw !== "string" || raw === "") return null
  const last = raw.lastIndexOf(".")
  const first = last === -1 ? -1 : raw.lastIndexOf(".", last - 1)
  if (last === -1 || first === -1) return null
  const token = raw.slice(0, first)
  const expiry = raw.slice(first + 1, last)
  const mac = raw.slice(last + 1)
  if (token === "" || expiry === "" || expiry.length > 12 || !/^\d+$/.test(expiry)) return null
  return { token, expiry: Number(expiry), mac }
}

/**
 * True only when the mac matches (constant-time compare inside `crypto.subtle.verify`) and the expiry is in the future.
 * A missing key, a malformed value, the old mock value `1`, a forged or expired cookie all give false.
 */
export async function verifySessionCookie(raw: string | undefined | null, key: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!key) return false
  const parts = parseSessionCookie(raw)
  if (!parts) return false
  const mac = hexToBytes(parts.mac)
  if (!mac) return false
  try {
    const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["verify"])
    const ok = await crypto.subtle.verify("HMAC", cryptoKey, mac, encoder.encode(`${parts.token}.${parts.expiry}`))
    return ok && parts.expiry > nowSeconds
  } catch {
    return false
  }
}
