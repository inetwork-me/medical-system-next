"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "@/components/ds/toast"

import { useRouter } from "@/i18n/navigation"
import { ApiError, verifyTwoFactor } from "@/lib/api"
import type { AuthMode } from "@/lib/auth-mode"
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
 * Tries, resend and the rest of this page are AUTH-02. Opened without the step in memory it goes back to sign in.
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

  const target = (() => {
    if (kind === "signup") return formatMobile(state.signupMobile)
    if (kind === "reset") {
      const m = normalizeSaudiMobile(state.resetTarget)
      return m ? maskMobile(m) : state.resetTarget
    }
    if (api) return isEmail(state.identifier) ? state.identifier : t("otp.login.yourEmail")
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
      const code = e instanceof ApiError ? e.code : "network"
      if (code === "unauthenticated") {
        // The step ran out of time or was used up: sign in again.
        set({ twoFactorToken: null, expired: true })
        return
      }
      if (code === "validation") {
        // Wrong code. The count is shown only; the API decides when the step is used up (AUTH-02 brings its real number).
        const left = Math.max(0, tries - 1)
        setTries(left)
        setError(left > 0 ? t("otp.wrong", { count: left }) : t("otp.noTriesLeft"))
        setShake((n) => n + 1)
        return
      }
      if (code === "too_many_requests") {
        const seconds = e instanceof ApiError ? (e.retryAfter ?? 60) : 60
        setError(t("login.tooMany", seconds <= 60 ? { unit: "seconds", count: Math.max(1, seconds) } : { unit: "minutes", count: Math.ceil(seconds / 60) }))
        return
      }
      setError(t("login.network"))
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

  async function resend() {
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
        resendOff={api}
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
