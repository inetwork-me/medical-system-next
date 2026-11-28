import { publicApi } from "./client.ts"
import type { ApiBranch, ApiTenant, ApiUser } from "./types.ts"

/** What the sign-in calls can answer (docs/api/auth.md in the API repo). Cookie mode: the API sets `his_session`, no token here. */
export type SignedIn = { kind: "signed_in"; user: ApiUser; branch: ApiBranch | null; tenant: ApiTenant }
export type TwoFactorStep = { kind: "two_factor"; tempToken: string; method: string | null }
export type BranchStep = { kind: "branch"; branches: ApiBranch[]; branchTempToken: string }
export type SignInResult = SignedIn | TwoFactorStep | BranchStep

type Raw = {
  user?: ApiUser
  branch?: ApiBranch | null
  tenant?: ApiTenant
  two_factor_required?: boolean
  two_factor_method?: string | null
  temp_token?: string
  branch_required?: boolean
  branches?: ApiBranch[]
  branch_temp_token?: string
}

/** One of the three 200 replies. The temp tokens stay in the caller's memory only. */
export function readSignInReply(raw: Raw): SignInResult {
  if (raw.two_factor_required && raw.temp_token) return { kind: "two_factor", tempToken: raw.temp_token, method: raw.two_factor_method ?? null }
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

/** POST /api/login/2fa. 401 = the step expired, 422 = wrong code. */
export async function verifyTwoFactor(tempToken: string, code: string) {
  return readSignInReply(await publicApi.post<Raw>("/api/login/2fa", { temp_token: tempToken, code }))
}

/** POST /api/login/branch. */
export async function chooseBranch(branchTempToken: string, branchId: number) {
  return readSignInReply(await publicApi.post<Raw>("/api/login/branch", { branch_temp_token: branchTempToken, branch_id: branchId }))
}

/** POST /api/logout: the API deletes the token and clears the cookie. Uses `publicApi`: the caller sends the user to sign in itself. */
export async function signOut() {
  await publicApi.post("/api/logout")
}

