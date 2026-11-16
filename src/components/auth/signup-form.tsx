"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { isEmail, mockSend, normalizeSaudiMobile } from "@/lib/mock/auth"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { PasswordInput } from "@/components/ds/password-input"
import { PasswordStrength, scorePassword } from "@/components/ds/password-strength"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuthFlow } from "./flow"
import { AuthTitle, LinkLine, SubmitButton, TextLink } from "./parts"

const ROLES = ["receptionist", "doctor", "nurse", "accountant", "admin"] as const
const BRANCHES = ["main", "olaya", "jeddah"] as const

type Values = { name: string; email: string; mobile: string; role: string; branch: string; password: string; confirm: string; terms: boolean }
type Errors = Partial<Record<keyof Values, string>>

/**
 * Auth · Sign up: full name, work e-mail, mobile + role (side by side from md; stacked on mobile),
 * clinic / branch, password + strength, confirm password, terms, Create account → verify mobile.
 */
export function SignupForm() {
  const t = useTranslations("auth")
  const router = useRouter()
  const { set } = useAuthFlow()
  const [v, setV] = React.useState<Values>({ name: "", email: "", mobile: "", role: "", branch: "", password: "", confirm: "", terms: false })
  const [errors, setErrors] = React.useState<Errors>({})
  const [loading, setLoading] = React.useState(false)
  const on = <K extends keyof Values>(k: K) => (val: Values[K]) => setV((s) => ({ ...s, [k]: val }))
  const level = scorePassword(v.password)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const req = t("errors.required")
    const errs: Errors = {}
    if (!v.name.trim()) errs.name = req
    if (!v.email.trim()) errs.email = req
    else if (!isEmail(v.email)) errs.email = t("errors.email")
    if (!v.mobile.trim()) errs.mobile = req
    else if (!normalizeSaudiMobile(v.mobile)) errs.mobile = t("errors.mobile")
    if (!v.role) errs.role = req
    if (!v.branch) errs.branch = req
    if (!v.password) errs.password = req
    else if (level === "weak") errs.password = t("errors.weak")
    if (!v.confirm) errs.confirm = req
    else if (v.confirm !== v.password) errs.confirm = t("errors.mismatch")
    if (!v.terms) errs.terms = t("errors.terms")
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    await mockSend()
    setLoading(false)
    set({ signupMobile: normalizeSaudiMobile(v.mobile)! })
    router.push("/signup/verify")
  }

  return (
    <form onSubmit={submit} noValidate className="contents">
      <AuthTitle title={t("signup.title")} subtitle={t("signup.subtitle")} />
      <Field label={t("signup.fullName")} required error={errors.name}>
        <Input value={v.name} onChange={(e) => on("name")(e.target.value)} startIcon={<Icon name="user" size={20} />} autoComplete="name" />
      </Field>
      <Field label={t("signup.workEmail")} required error={errors.email}>
        <Input
          value={v.email}
          onChange={(e) => on("email")(e.target.value)}
          startIcon={<Icon name="sms" size={20} />}
          type="email"
          autoComplete="email"
          dir="ltr"
        />
      </Field>
      <div className="grid gap-5 md:grid-cols-2 md:gap-3">
        <Field label={t("signup.mobile")} required error={errors.mobile}>
          <Input
            value={v.mobile}
            onChange={(e) => on("mobile")(e.target.value)}
            startIcon={<Icon name="call" size={20} />}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="05XXXXXXXX"
            dir="ltr"
          />
        </Field>
        <Field label={t("signup.role")} required error={errors.role}>
          {(control) => (
            <Select value={v.role} onValueChange={on("role")}>
              <SelectTrigger {...control}>
                <SelectValue placeholder={t("signup.choose")} />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`signup.roles.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <Field label={t("signup.branch")} required error={errors.branch}>
        {(control) => (
          <Select value={v.branch} onValueChange={on("branch")}>
            <SelectTrigger {...control}>
              <SelectValue placeholder={t("signup.choose")} />
            </SelectTrigger>
            <SelectContent>
              {BRANCHES.map((b) => (
                <SelectItem key={b} value={b}>
                  {t(`signup.branches.${b}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <div className="flex flex-col gap-1.5">
        <Field label={t("common.password")} error={errors.password}>
          <PasswordInput value={v.password} onChange={(e) => on("password")(e.target.value)} autoComplete="new-password" />
        </Field>
        <PasswordStrength level={level} />
      </div>
      <Field label={t("signup.confirmPassword")} error={errors.confirm}>
        <PasswordInput value={v.confirm} onChange={(e) => on("confirm")(e.target.value)} autoComplete="new-password" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <Checkbox checked={v.terms} onCheckedChange={(c) => on("terms")(c === true)} aria-invalid={errors.terms ? true : undefined} />
          {t("signup.terms")}
        </label>
        {errors.terms && <p className="text-xs text-destructive">{errors.terms}</p>}
      </div>
      <SubmitButton loading={loading}>{t("signup.submit")}</SubmitButton>
      <LinkLine question={t("signup.haveAccount")}>
        <TextLink href="/login">{t("signup.signIn")}</TextLink>
      </LinkLine>
    </form>
  )
}
