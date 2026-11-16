"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { LOGIN_ATTEMPTS, isEmail, mockSignIn, normalizeSaudiMobile } from "@/lib/mock/auth"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { PasswordInput } from "@/components/ds/password-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useAuthFlow } from "./flow"
import { AuthAlert, AuthTitle, LinkLine, OrDivider, SubmitButton, TextLink } from "./parts"

/**
 * Auth · Login (+ "Wrong password" state): title, e-mail or mobile, password with "Forgot password?",
 * keep me signed in, Sign in → 2-step code, or Nafath (prototype → code screen; Nafath approval screen not
 * designed yet), "New here? Create an account".
 */
export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth")
  const router = useRouter()
  const { state, set } = useAuthFlow()
  const [identifier, setIdentifier] = React.useState(state.identifier)
  const [password, setPassword] = React.useState("")
  const [keep, setKeep] = React.useState(state.keepSignedIn)
  const [errors, setErrors] = React.useState<{ identifier?: string; password?: string }>({})
  const [wrong, setWrong] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const locked = state.loginAttemptsLeft <= 0

  const goVerify = () => router.push(next ? `/login/verify?next=${encodeURIComponent(next)}` : "/login/verify")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (locked) return
    const v = identifier.trim()
    const errs: typeof errors = {}
    if (!v) errs.identifier = t("errors.required")
    else if (!isEmail(v) && !normalizeSaudiMobile(v)) errs.identifier = t("errors.identifier")
    if (!password) errs.password = t("errors.required")
    setErrors(errs)
    if (Object.keys(errs).length) return

    setLoading(true)
    const ok = await mockSignIn(v, password)
    setLoading(false)
    if (!ok) {
      setWrong(true)
      set({ loginAttemptsLeft: state.loginAttemptsLeft - 1 })
      return
    }
    set({ identifier: v, keepSignedIn: keep, loginAttemptsLeft: LOGIN_ATTEMPTS })
    goVerify()
  }

  return (
    <form onSubmit={submit} noValidate className="contents">
      <AuthTitle title={t("login.title")} subtitle={t("login.subtitle")} />
      {(wrong || locked) && (
        <AuthAlert tone="destructive" icon="danger">
          {locked ? t("login.locked") : t("login.wrong", { count: state.loginAttemptsLeft })}
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
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={goVerify}>
        <Icon name="shield-tick" size={20} />
        {t("login.nafath")}
      </Button>
      <LinkLine question={t("login.newHere")}>
        <TextLink href="/signup">{t("login.createAccount")}</TextLink>
      </LinkLine>
    </form>
  )
}
