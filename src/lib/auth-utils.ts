/**
 * Helpers the sign-in, sign-up and reset screens share (formats and limits). Not mock data: the real flows use them too.
 */
export const LOGIN_ATTEMPTS = 3
export const CODE_ATTEMPTS = 3
export const RESEND_SECONDS = 45

/** 05XXXXXXXX / 5XXXXXXXX / +9665XXXXXXXX / 9665XXXXXXXX → 05XXXXXXXX, else null. */
export function normalizeSaudiMobile(v: string): string | null {
  const d = v.replace(/[\s-]/g, "")
  const m = d.match(/^(?:\+?966|0)?(5\d{8})$/)
  return m ? `0${m[1]}` : null
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

/** "+966 5• ••• •287" — design masking for the 2-step code target. */
export function maskMobile(mobile05: string) {
  const n = mobile05.replace(/^0/, "")
  return `+966 ${n[0]}• ••• •${n.slice(-3)}`
}

/** "+966 55 418 2290" display format. */
export function formatMobile(mobile05: string) {
  const n = mobile05.replace(/^0/, "")
  return `+966 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`
}
