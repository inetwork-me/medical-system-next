"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "@/components/ds/toast"

import { useRouter } from "@/i18n/navigation"
import { resendCode, verifyTwoFactor } from "@/lib/api"
import type { AuthMode } from "@/lib/auth-mode"
import { resendProblem, verifyProblem } from "@/lib/auth-code"
import { CODE_ATTEMPTS, formatMobile, isEmail, maskMobile, normalizeSaudiMobile } from "@/lib/auth-utils"
import { DEMO_ACCOUNT, mockSend, mockVerifyCode } from "@/lib/mock/auth"
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session"
import { Button } from "@/components/ui/button"
import { useAuthFlow } from "./flow"
import { OtpField } from "./otp-field"
import { AuthAlert, AuthTitle, BackLink, LinkLine, LtrTarget, SubmitButton, TextLink, Unavailable } from "./parts"
import { useFinishSignIn } from "./use-finish"

type Kind = "login" | "signup" | "reset"

const BACK: Record<Kind, { href: string; key: "backToSignIn" | "back" }> = {
  login: { href: "/login", key: "backToSignIn" },
  signup: { href: "/signup", key: "back" },
  reset: { href: "/forgot-password", key: "back" },
}

/**
 * Auth · Verification code (login 2-step / sign-up mobile / password reset) + "Wrong code" state.
 * Login success sets the session and opens the dashboard (prototype: Verify code → Dashboard).
 *
 * mode "api" (login only): the code is checked by POST /api/login/2fa with the temp token kept in memory (flow provider).
 * Until SMS is connected the code goes by email (D50): the page opens in its email state and the phone link is switched off.
 * The tries, the wait before a resend and the address the code went to (masked) all come from the API; the page does not count.
 * After the last wrong try the API ends the step and the page goes back to sign in. Opened without the step in memory it goes back to sign in.
 * mode "mock" (and sign-up / reset): the old demo behaviour.
 */
export function VerifyForm({ kind, next, mode = "mock" }: { kind: Kind; next?: string; mode?: AuthMode }) {
  const t = useTranslations("auth")
  const router = useRouter()
  const finish = useFinishSignIn(next)
  const { state, set } = useAuthFlow()
  const api = mode === "api" && kind === "login"
  const [code, setCode] = React.useState("")
  const [error, setError] = React.useState<string>()
  const [tries, setTries] = React.useState(CODE_ATTEMPTS)
  const [shake, setShake] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [viaEmail, setViaEmail] = React.useState(api)
  const [wait, setWait] = React.useState({ seconds: api ? state.resendIn : 45, key: 0 })

  const target = (() => {
    if (kind === "signup") return formatMobile(state.signupMobile)
    if (kind === "reset") {
      const m = normalizeSaudiMobile(state.resetTarget)
      return m ? maskMobile(m) : state.resetTarget
    }
    if (api) return state.codeSentTo ?? ""
    if (viaEmail) return isEmail(state.identifier) ? state.identifier : DEMO_ACCOUNT.email
    return maskMobile(normalizeSaudiMobile(state.identifier) ?? DEMO_ACCOUNT.mobile)
  })()

  React.useEffect(() => {
    if (api && !state.twoFactorToken) router.replace("/login")
  }, [api, state.twoFactorToken, router])

  async function verifyApi(value: string) {
    const token = state.twoFactorToken
    if (value.length < 6) return setError(t("otp.incomplete"))
    if (!token) return
    setLoading(true)
    try {
      const result = await verifyTwoFactor(token, value)
      if (result.kind === "signed_in") return finish()
      setLoading(false)
      if (result.kind === "branch") {
        set({ twoFactorToken: null, branchToken: result.branchTempToken, branches: result.branches })
        router.push(next ? `/login/branch?next=${encodeURIComponent(next)}` : "/login/branch")
      } else setError(t("login.network"))
    } catch (e) {
      setLoading(false)
      const p = verifyProblem(e)
      if (p.kind === "expired") {
        // The step ran out of time or was used up: sign in again.
        set({ twoFactorToken: null, expired: true })
      } else if (p.kind === "over") {
        // The API ended the step after the last wrong try: say so on the sign-in page.
        set({ twoFactorToken: null, codeTriesUsed: true })
      } else if (p.kind === "wrong") {
        setTries(p.triesLeft)
        setError(t("otp.wrong", { count: p.triesLeft }))
        setShake((n) => n + 1)
      } else if (p.kind === "tooMany") {
        setError(t("login.tooMany", p.seconds <= 60 ? { unit: "seconds", count: Math.max(1, p.seconds) } : { unit: "minutes", count: Math.ceil(p.seconds / 60) }))
      } else setError(t("login.network"))
    }
  }

  async function verify(value = code) {
    if (api) return verifyApi(value)
    if (value.length < 6) return setError(t("otp.incomplete"))
    if (tries <= 0) return
    setLoading(true)
    const ok = await mockVerifyCode(value)
    setLoading(false)
    if (!ok) {
      const left = tries - 1
      setTries(left)
      setError(left > 0 ? t("otp.wrong", { count: left }) : t("otp.noTriesLeft"))
      setShake((s) => s + 1)
      return
    }
    setError(undefined)
    if (kind === "login") {
      const age = state.keepSignedIn ? `; max-age=${SESSION_MAX_AGE}` : ""
      document.cookie = `${SESSION_COOKIE}=1; path=/; samesite=lax${age}`
      router.replace(next && next.startsWith("/") ? next : "/dashboard")
    } else if (kind === "signup") router.push("/signup/done")
    else router.push("/forgot-password/new")
  }

  async function resendApi() {
    const token = state.twoFactorToken
    if (!token) return
    try {
      const sent = await resendCode(token)
      set({ codeSentTo: sent.codeSentTo, codeTriesLeft: sent.triesLeft })
      setTries(sent.triesLeft)
      setWait((w) => ({ seconds: sent.resendIn, key: w.key + 1 }))
      setError(undefined)
      setCode("")
      toast.success(t("otp.resent"))
    } catch (e) {
      const p = resendProblem(e)
      if (p.kind === "expired") set({ twoFactorToken: null, expired: true })
      else if (p.kind === "wait") setWait((w) => ({ seconds: p.seconds, key: w.key + 1 }))
      else if (p.kind === "tooMany") setWait((w) => ({ seconds: p.seconds, key: w.key + 1 }))
      else setError(p.kind === "failed" ? t("otp.resendFailed") : t("login.network"))
    }
  }

  async function resend() {
    if (api) return resendApi()
    await mockSend()
    setTries(CODE_ATTEMPTS)
    setError(undefined)
    setCode("")
    toast.success(t("otp.resent"))
  }

  if (api && !state.twoFactorToken) return null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        verify()
      }}
      noValidate
      className="contents"
    >
      <BackLink href={BACK[kind].href}>{t(`common.${BACK[kind].key}`)}</BackLink>
      <AuthTitle
        icon="sms"
        title={kind === "login" && viaEmail ? t("otp.login.titleEmail") : t(`otp.${kind}.title`)}
        subtitle={t.rich(`otp.${kind}.subtitle`, { value: target, target: LtrTarget })}
      />
      <OtpField
        value={code}
        onChange={(v) => {
          setCode(v)
          if (error && tries > 0) setError(undefined)
        }}
        onComplete={(v) => verify(v)}
        error={error}
        shakeKey={shake}
        onResend={resend}
        wait={api ? wait : undefined}
      />
      {/* Mock only: nothing is sent, so say so and offer the demo code. */}
      {!api && (
        <AuthAlert tone="info" icon="info-circle">
          {t("otp.demo")}{" "}
          <button
            type="button"
            onClick={() => {
              setCode(DEMO_ACCOUNT.code)
              setError(undefined)
              verify(DEMO_ACCOUNT.code)
            }}
            className="cursor-pointer font-medium underline underline-offset-2"
          >
            {t("otp.demoFill")}
          </button>
        </AuthAlert>
      )}
      <SubmitButton loading={loading}>{t(`otp.${kind}.submit`)}</SubmitButton>
      {api && (
        <Unavailable reason="thirdParty">
          <Button type="button" variant="link" disabled className="h-auto w-full p-0 text-sm">
            {t("otp.login.usePhone")}
          </Button>
        </Unavailable>
      )}
      {kind === "login" && !api && (
        <LinkLine question={t("otp.login.noPhone")}>
          <TextLink onClick={() => setViaEmail((v) => !v)}>{viaEmail ? t("otp.login.usePhone") : t("otp.login.useEmail")}</TextLink>
        </LinkLine>
      )}
    </form>
  )
}
