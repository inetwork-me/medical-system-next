/**
 * DEV-ONLY mock auth flow. Sign-in accepts any valid e-mail / mobile + password and any 6-digit code;
 * DEMO_ACCOUNT only supplies the design's sample values for screens that need one (masked code target…).
 * Replace this module with real API calls when the backend exists.
 */
export const DEMO_ACCOUNT = {
  email: "khaled.m@clinic.sa",
  mobile: "0551234287",
  password: "Clinic@2026",
  code: "482916",
}

export const LOGIN_ATTEMPTS = 3
export const CODE_ATTEMPTS = 3
export const RESEND_SECONDS = 45

const wait = (ms = 600) => new Promise((r) => setTimeout(r, ms))

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

/**
 * Demo sign-in: any valid e-mail or Saudi mobile with any non-empty password is accepted
 * (there is no backend or user database yet). The form already checks the formats.
 */
export async function mockSignIn(identifier: string, password: string) {
  await wait()
  const id = identifier.trim()
  return (isEmail(id) || normalizeSaudiMobile(id) !== null) && password.length > 0
}

/** Demo verification: any 6-digit code is accepted. */
export async function mockVerifyCode(code: string) {
  await wait()
  return /^\d{6}$/.test(code)
}

export async function mockSend() {
  await wait(400)
  return true
}
