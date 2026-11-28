/**
 * DEV-ONLY mock auth flow. Sign-in accepts any valid e-mail / mobile + password and any 6-digit code;
 * DEMO_ACCOUNT only supplies the design's sample values for screens that need one (masked code target…).
 * Used only in mock mode (HIS_AUTH_MODE=mock and the static export); the sign-in on the API does not touch it.
 * The format helpers and limits it used to hold are in lib/auth-utils.ts.
 */
import { isEmail, normalizeSaudiMobile } from "@/lib/auth-utils"

export const DEMO_ACCOUNT = {
  email: "khaled.m@clinic.sa",
  mobile: "0551234287",
  password: "Clinic@2026",
  code: "482916",
}

const wait = (ms = 600) => new Promise((r) => setTimeout(r, ms))

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
