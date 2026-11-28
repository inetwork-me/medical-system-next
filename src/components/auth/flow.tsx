"use client"

import * as React from "react"

import type { ApiBranch } from "@/lib/api"
import { LOGIN_ATTEMPTS } from "@/lib/auth-utils"
import { DEMO_ACCOUNT } from "@/lib/mock/auth"

/**
 * State shared across the auth steps (lives in the (auth) layout, which persists between its pages):
 * who is signing in, where the code was sent, remaining attempts. Pages opened directly fall back to the
 * design's sample values so every screen still renders.
 */
type FlowState = {
  /** Sign in: e-mail or mobile typed on the login screen */
  identifier: string
  keepSignedIn: boolean
  loginAttemptsLeft: number
  /** Sign up: mobile (05…) the code went to */
  signupMobile: string
  /** Reset: e-mail or mobile the reset code went to */
  resetTarget: string
  /** Sign in on the API: the temp tokens live here, in memory only (never storage, cookie or URL). A reload drops them. */
  twoFactorToken: string | null
  branchToken: string | null
  branches: ApiBranch[]
  /** Sign in on the API: when the account lock ends (ms since epoch), from the API's retry_after. */
  lockedUntil: number | null
  /** Shown once on the sign-in page: the code or branch step ran out of time. */
  expired: boolean
}

const initial: FlowState = {
  identifier: "", // starts empty: a pre-filled value got the typed email appended to it
  keepSignedIn: true,
  loginAttemptsLeft: LOGIN_ATTEMPTS,
  signupMobile: "0554182290",
  resetTarget: DEMO_ACCOUNT.email,
  twoFactorToken: null,
  branchToken: null,
  branches: [],
  lockedUntil: null,
  expired: false,
}

const Ctx = React.createContext<{ state: FlowState; set: (patch: Partial<FlowState>) => void } | null>(null)

export function AuthFlowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState(initial)
  const set = React.useCallback((patch: Partial<FlowState>) => setState((s) => ({ ...s, ...patch })), [])
  return <Ctx.Provider value={{ state, set }}>{children}</Ctx.Provider>
}

export function useAuthFlow() {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error("useAuthFlow outside AuthFlowProvider")
  return ctx
}
