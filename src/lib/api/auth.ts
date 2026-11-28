import { publicApi } from "./client.ts"
import type { ApiBranch, ApiTenant, ApiUser } from "./types.ts"

/** What the sign-in calls can answer (docs/api/auth.md in the API repo). Cookie mode: the API sets `his_session`, no token here. */
export type SignedIn = { kind: "signed_in"; user: ApiUser; branch: ApiBranch | null; tenant: ApiTenant }
/** The code step: where the code went (masked email, or null), tries left and seconds to wait before a resend (all from the API). */
export type TwoFactorStep = {
  kind: "two_factor"
  tempToken: string
  method: string | null
  codeSentTo: string | null
  triesLeft: number
  resendIn: number
}
export type CodeSent = { codeSentTo: string | null; triesLeft: number; resendIn: number }
export type BranchStep = { kind: "branch"; branches: ApiBranch[]; branchTempToken: string }
export type SignInResult = SignedIn | TwoFactorStep | BranchStep

type Raw = {
  user?: ApiUser
  branch?: ApiBranch | null
  tenant?: ApiTenant
  two_factor_required?: boolean
  two_factor_method?: string | null
  temp_token?: string
  code_sent_to?: string | null
  tries_left?: number
  resend_in?: number
  branch_required?: boolean
  branches?: ApiBranch[]
  branch_temp_token?: string
}

/** One of the three 200 replies. The temp tokens stay in the caller's memory only. */
export function readSignInReply(raw: Raw): SignInResult {
  if (raw.two_factor_required && raw.temp_token) return {
      kind: "two_factor",
      tempToken: raw.temp_token,
      method: raw.two_factor_method ?? null,
      codeSentTo: raw.code_sent_to ?? null,
      triesLeft: raw.tries_left ?? 3,
      resendIn: raw.resend_in ?? 0,
    }
  if (raw.branch_required && raw.branch_temp_token && Array.isArray(raw.branches)) {
    return { kind: "branch", branches: raw.branches, branchTempToken: raw.branch_temp_token }
  }
  if (raw.user && raw.tenant) return { kind: "signed_in", user: raw.user, branch: raw.branch ?? null, tenant: raw.tenant }
  throw new Error("Unexpected sign-in reply")
}

/** POST /api/login. Errors: ApiError with code invalid_credentials (+ attemptsLeft), locked, inactive, no_branch, too_many_requests (+ retryAfter). */
export async function signIn(identifier: string, password: string, keepSignedIn: boolean) {
  return readSignInReply(await publicApi.post<Raw>("/api/login", { identifier, password, keep_signed_in: keepSignedIn }))
}

/** POST /api/login/2fa. Errors: step_expired (401), invalid_code (422, triesLeft), code_tries_exhausted (422: the step is over). */
export async function verifyTwoFactor(tempToken: string, code: string) {
  return readSignInReply(await publicApi.post<Raw>("/api/login/2fa", { temp_token: tempToken, code }))
}

/** POST /api/login/2fa/resend. Errors: resend_wait (429, retryAfter), too_many_requests, step_expired, send_failed, resend_unavailable. */
export async function resendCode(tempToken: string): Promise<CodeSent> {
  const raw = await publicApi.post<{ code_sent_to?: string | null; tries_left?: number; resend_in?: number }>("/api/login/2fa/resend", { temp_token: tempToken })
  return { codeSentTo: raw.code_sent_to ?? null, triesLeft: raw.tries_left ?? 3, resendIn: raw.resend_in ?? 0 }
}

/** POST /api/login/branch. */
export async function chooseBranch(branchTempToken: string, branchId: number) {
  return readSignInReply(await publicApi.post<Raw>("/api/login/branch", { branch_temp_token: branchTempToken, branch_id: branchId }))
}

/** POST /api/logout: the API deletes the token and clears the cookie. Uses `publicApi`: the caller sends the user to sign in itself. */
export async function signOut() {
  await publicApi.post("/api/logout")
}

