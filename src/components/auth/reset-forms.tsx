"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useRouter } from "@/i18n/navigation"
import { isEmail, normalizeSaudiMobile } from "@/lib/auth-utils"
import { mockSend } from "@/lib/mock/auth"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { PasswordInput } from "@/components/ds/password-input"
import { PasswordStrength, scorePassword } from "@/components/ds/password-strength"
import { Input } from "@/components/ui/input"
import { useAuthFlow } from "./flow"
import { AuthTitle, BackLink, SubmitButton } from "./parts"

/** Auth · Reset · Forgot password: e-mail or mobile → Send code → reset code. */
export function ForgotForm() {
  const t = useTranslations("auth")
  const router = useRouter()
  const { state, set } = useAuthFlow()
  const [value, setValue] = React.useState(state.identifier)
  const [error, setError] = React.useState<string>()
  const [loading, setLoading] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = value.trim()
    if (!v) return setError(t("errors.required"))
    if (!isEmail(v) && !normalizeSaudiMobile(v)) return setError(t("errors.identifier"))
    setLoading(true)
    await mockSend()
    setLoading(false)
    set({ resetTarget: v })
    router.push("/forgot-password/verify")
  }

  return (
    <form onSubmit={submit} noValidate className="contents">
      <BackLink href="/login">{t("common.backToSignIn")}</BackLink>
      <AuthTitle icon="lock" title={t("forgot.title")} subtitle={t("forgot.subtitle")} />
      <Field label={t("common.emailOrMobile")} error={error}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          startIcon={<Icon name="sms" size={20} />}
          inputMode="email"
          autoComplete="username"
          dir="ltr"
          autoFocus
        />
      </Field>
      <SubmitButton loading={loading}>{t("forgot.submit")}</SubmitButton>
    </form>
  )
}

/** Auth · Reset · New password: new password + strength, rules checklist, confirm → Password updated. */
export function NewPasswordForm() {
  const t = useTranslations("auth")
  const router = useRouter()
  const [pw, setPw] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [errors, setErrors] = React.useState<{ pw?: string; confirm?: string }>({})
  const [loading, setLoading] = React.useState(false)
  const level = scorePassword(pw)

  const rules = [
    { key: "length", ok: pw.length >= 8 },
    { key: "case", ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { key: "number", ok: /\d/.test(pw) },
    // Password history is checked by the server; shown as pending until then.
    { key: "history", ok: false },
  ] as const

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!pw) errs.pw = t("errors.required")
    else if (!rules.slice(0, 3).every((r) => r.ok)) errs.pw = t("errors.weak")
    if (!confirm) errs.confirm = t("errors.required")
    else if (confirm !== pw) errs.confirm = t("errors.mismatch")
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    await mockSend()
    setLoading(false)
    router.push("/forgot-password/done")
  }

  return (
    <form onSubmit={submit} noValidate className="contents">
      <BackLink href="/forgot-password/verify">{t("common.back")}</BackLink>
      <AuthTitle icon="lock" title={t("newPassword.title")} subtitle={t("newPassword.subtitle")} />
      <div className="flex flex-col gap-1.5">
        <Field label={t("newPassword.label")} error={errors.pw}>
          <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus />
        </Field>
        <PasswordStrength level={level} />
      </div>
      <ul className="flex flex-col gap-1.5 rounded-lg bg-muted p-3" aria-label={t("newPassword.label")}>
        {rules.map((r) => (
          <li key={r.key} className={cn("flex items-center gap-2 text-xs", r.ok ? "text-foreground" : "text-muted-foreground")}>
            <Icon name={r.ok ? "tick-circle" : "close-circle"} size={16} className={r.ok ? "text-success" : "text-muted-foreground"} />
            {t(`newPassword.rules.${r.key}`)}
          </li>
        ))}
      </ul>
      <Field label={t("newPassword.confirm")} error={errors.confirm}>
        <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </Field>
      <SubmitButton loading={loading}>{t("newPassword.submit")}</SubmitButton>
    </form>
  )
}
