"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { useRouter } from "@/i18n/navigation"
import { CODE_ATTEMPTS, DEMO_ACCOUNT, formatMobile, isEmail, maskMobile, mockSend, mockVerifyCode, normalizeSaudiMobile } from "@/lib/mock/auth"
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session"
import { useAuthFlow } from "./flow"
import { OtpField } from "./otp-field"
import { AuthAlert, AuthTitle, BackLink, LinkLine, LtrTarget, SubmitButton, TextLink } from "./parts"

type Kind = "login" | "signup" | "reset"

const BACK: Record<Kind, { href: string; key: "backToSignIn" | "back" }> = {
  login: { href: "/login", key: "backToSignIn" },
  signup: { href: "/signup", key: "back" },
  reset: { href: "/forgot-password", key: "back" },
}

/**
 * Auth · Verification code (login 2-step / sign-up mobile / password reset) + "Wrong code" state.
 * Login success sets the session and opens the dashboard (prototype: Verify code → Dashboard).
 */
export function VerifyForm({ kind, next }: { kind: Kind; next?: string }) {
  const t = useTranslations("auth")
  const router = useRouter()
  const { state } = useAuthFlow()
  const [code, setCode] = React.useState("")
  const [error, setError] = React.useState<string>()
  const [tries, setTries] = React.useState(CODE_ATTEMPTS)
  const [shake, setShake] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [viaEmail, setViaEmail] = React.useState(false)

  const target = (() => {
    if (kind === "signup") return formatMobile(state.signupMobile)
    if (kind === "reset") {
      const m = normalizeSaudiMobile(state.resetTarget)
      return m ? maskMobile(m) : state.resetTarget
    }
    if (viaEmail) return isEmail(state.identifier) ? state.identifier : DEMO_ACCOUNT.email
    return maskMobile(normalizeSaudiMobile(state.identifier) ?? DEMO_ACCOUNT.mobile)
  })()

  async function verify(value = code) {
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
      />
      {/* No backend yet: nothing is sent, so say so and offer the demo code. Remove with the mock auth. */}
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
      <SubmitButton loading={loading}>{t(`otp.${kind}.submit`)}</SubmitButton>
      {kind === "login" && (
        <LinkLine question={t("otp.login.noPhone")}>
          <TextLink onClick={() => setViaEmail((v) => !v)}>{viaEmail ? t("otp.login.usePhone") : t("otp.login.useEmail")}</TextLink>
        </LinkLine>
      )}
    </form>
  )
}
