"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { ApiError, signIn, type SignInResult } from "@/lib/api"
import type { AuthMode } from "@/lib/auth-mode"
import { LOGIN_ATTEMPTS, isEmail, normalizeSaudiMobile } from "@/lib/auth-utils"
import { mockSignIn } from "@/lib/mock/auth"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { PasswordInput } from "@/components/ds/password-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useAuthFlow } from "./flow"
import { AuthAlert, AuthTitle, OrDivider, SubmitButton, TextLink, Unavailable } from "./parts"
import { useFinishSignIn } from "./use-finish"

/** What the red alert above the form says after a failed sign-in (every case comes from the API's `code` and numbers). */
type Problem =
  | { kind: "wrong"; left: number }
  | { kind: "locked" }
  | { kind: "inactive" }
  | { kind: "noBranch" }
  | { kind: "tooMany"; seconds: number }
  | { kind: "network" }

/** "Try again in 45 seconds" up to a minute, then whole minutes. */
const waitFor = (seconds: number) => (seconds <= 60 ? { unit: "seconds", count: Math.max(1, seconds) } : { unit: "minutes", count: Math.ceil(seconds / 60) })

function problemFrom(e: unknown): Problem {
  if (e instanceof ApiError) {
    if (e.code === "invalid_credentials") return { kind: "wrong", left: e.attemptsLeft ?? 0 }
    if (e.code === "locked") return { kind: "locked" }
    if (e.code === "inactive") return { kind: "inactive" }
    if (e.code === "no_branch") return { kind: "noBranch" }
    if (e.code === "too_many_requests") return { kind: "tooMany", seconds: e.retryAfter ?? 60 }
  }
  // network, a 5xx, or anything else the page has no text for
  return { kind: "network" }
}

/**
 * Auth · Login (+ "Wrong password" state): title, e-mail or mobile, password with "Forgot password?",
 * keep me signed in, Sign in, Nafath (switched off until it is connected, D50). Sign-up is not built (D12), so no link.
 *
 * mode "api": the call goes to the API (`publicApi`); the reply is signed in, the code step or the branch step.
 * mode "mock": the old front-end-only flow (static export and HIS_AUTH_MODE=mock).
 */
export function LoginForm({ next, mode }: { next?: string; mode: AuthMode }) {
  const t = useTranslations("auth")
  const router = useRouter()
  const finish = useFinishSignIn(next)
  const { state, set } = useAuthFlow()
  const [identifier, setIdentifier] = React.useState(state.identifier)
  const [password, setPassword] = React.useState("")
  const [keep, setKeep] = React.useState(state.keepSignedIn)
  const [errors, setErrors] = React.useState<{ identifier?: string; password?: string }>({})
  const [wrong, setWrong] = React.useState(false)
  const [problem, setProblem] = React.useState<Problem | null>(null)
  const [loading, setLoading] = React.useState(false)
  const api = mode === "api"
  const locked = api ? problem?.kind === "locked" : state.loginAttemptsLeft <= 0

  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path)

  async function submitApi(v: string) {
    // A lock the API reported: do nothing until it ends (the API refuses anyway, also from another browser).
    if (state.lockedUntil && Date.now() < state.lockedUntil) return setProblem({ kind: "locked" })
    setLoading(true)
    setProblem(null)
    setWrong(false)
    set({ expired: false })
    let result: SignInResult
    try {
      result = await signIn(v, password, keep)
    } catch (e) {
      setLoading(false)
      const p = problemFrom(e)
      setProblem(p)
      setWrong(p.kind === "wrong")
      if (p.kind === "locked") set({ lockedUntil: Date.now() + (e instanceof ApiError ? (e.retryAfter ?? 900) : 900) * 1000 })
      return
    }
    set({ identifier: v, keepSignedIn: keep, lockedUntil: null })
    if (result.kind === "signed_in") return finish()
    setLoading(false)
    if (result.kind === "two_factor") {
      set({ twoFactorToken: result.tempToken })
      router.push(withNext("/login/verify"))
    } else {
      set({ branchToken: result.branchTempToken, branches: result.branches })
      router.push(withNext("/login/branch"))
    }
  }

  async function submitMock(v: string) {
    setLoading(true)
    const ok = await mockSignIn(v, password)
    setLoading(false)
    if (!ok) {
      setWrong(true)
      set({ loginAttemptsLeft: state.loginAttemptsLeft - 1 })
      return
    }
    set({ identifier: v, keepSignedIn: keep, loginAttemptsLeft: LOGIN_ATTEMPTS })
    router.push(withNext("/login/verify"))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!api && locked) return
    const v = identifier.trim()
    const errs: typeof errors = {}
    if (!v) errs.identifier = t("errors.required")
    else if (!isEmail(v) && !normalizeSaudiMobile(v)) errs.identifier = t("errors.identifier")
    if (!password) errs.password = t("errors.required")
    setErrors(errs)
    if (Object.keys(errs).length) return
    await (api ? submitApi(v) : submitMock(v))
  }

  const alert = (() => {
    if (api) {
      if (!problem) return null
      switch (problem.kind) {
        case "wrong":
          return { icon: "danger" as const, text: t("login.wrong", { count: problem.left }) }
        case "locked":
          return { icon: "danger" as const, text: t("login.locked") }
        case "inactive":
          return { icon: "danger" as const, text: t("login.inactive") }
        case "noBranch":
          return { icon: "danger" as const, text: t("login.noBranch") }
        case "tooMany":
          return { icon: "danger" as const, text: t("login.tooMany", waitFor(problem.seconds)) }
        case "network":
          return { icon: "danger" as const, text: t("login.network") }
      }
    }
    if (locked) return { icon: "danger" as const, text: t("login.locked") }
    if (wrong) return { icon: "danger" as const, text: t("login.wrong", { count: state.loginAttemptsLeft }) }
    return null
  })()

  return (
    <form onSubmit={submit} noValidate className="contents">
      <AuthTitle title={t("login.title")} subtitle={t("login.subtitle")} />
      {api && state.expired && !alert && (
        <AuthAlert tone="info" icon="info-circle">
          {t("login.expired")}
        </AuthAlert>
      )}
      {alert && (
        <AuthAlert tone="destructive" icon={alert.icon}>
          {alert.text}
        </AuthAlert>
      )}
      <Field label={t("common.emailOrMobile")} error={errors.identifier}>
        <Input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          startIcon={<Icon name="sms" size={20} />}
          type="text"
          inputMode="email"
          autoComplete="username"
          dir="ltr"
        />
      </Field>
      <Field
        label={t("common.password")}
        labelEnd={<TextLink href="/forgot-password">{t("login.forgot")}</TextLink>}
        error={errors.password ?? (wrong && !locked ? t("login.wrongField") : undefined)}
      >
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <Checkbox checked={keep} onCheckedChange={(v) => setKeep(v === true)} />
        {t("login.keepSignedIn")}
      </label>
      <SubmitButton loading={loading}>{t("login.submit")}</SubmitButton>
      <OrDivider />
      <Unavailable reason="thirdParty">
        <Button type="button" variant="outline" size="lg" className="w-full" disabled>
          <Icon name="shield-tick" size={20} />
          {t("login.nafath")}
        </Button>
      </Unavailable>
    </form>
  )
}
