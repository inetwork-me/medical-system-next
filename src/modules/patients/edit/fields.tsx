"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useText } from "../profile/use-patient"
import { OPTIONS, type AnyKey, type ErrorKey, type FullForm, type OptionKey, type PatientForm } from "./form"

/**
 * Patient form controls shared by Edit patient and the Add-patient wizard: label + control + helper / error
 * (DS Field), wired to the form context. Labels come from patients.edit.fields, errors from patients.edit.errors.
 * Two fields per row inside a `@container/sec` card from 30rem.
 */
export type FormCtxValue = {
  form: PatientForm
  set: <K extends AnyKey>(k: K, v: FullForm[K]) => void
  touch: (k: AnyKey) => void
  error: (k: AnyKey) => ErrorKey | undefined
}
export const FormCtx = React.createContext<FormCtxValue | null>(null)
export const useFormCtx = () => React.useContext(FormCtx)!

export type Control = { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string; "aria-required"?: boolean }

/** Field wrapper: label, control, helper / error; anchor id for "Go to field". */
export function F({
  k,
  required,
  helper,
  wide,
  children,
}: {
  k: AnyKey
  required?: boolean
  helper?: React.ReactNode
  wide?: boolean
  children: (c: Control) => React.ReactNode
}) {
  const t = useTranslations("patients.edit")
  const { error } = useFormCtx()
  const err = error(k)
  return (
    <div id={`field-${k}`} className={cn("scroll-mt-24", wide && "@min-[30rem]/sec:col-span-2")}>
      <Field label={t(`fields.${k}`)} required={required} helper={helper} error={err && t(`errors.${err}`)}>
        {children}
      </Field>
    </div>
  )
}

export function TextField({
  k,
  required,
  icon,
  ...props
}: { k: AnyKey; required?: boolean; icon?: IconName } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "id">) {
  const { form, set, touch } = useFormCtx()
  return (
    <F k={k} required={required}>
      {(c) => (
        <Input
          {...c}
          {...props}
          value={(form[k] as string | undefined) ?? ""}
          onChange={(e) => set(k, e.target.value as never)}
          onBlur={() => touch(k)}
          startIcon={icon ? <Icon name={icon} size={16} /> : undefined}
        />
      )}
    </F>
  )
}

export function SelectField({ k, options, required, disabled }: { k: AnyKey; options: OptionKey; required?: boolean; disabled?: boolean }) {
  const t = useTranslations("patients.edit.fields")
  const { form, set, touch } = useFormCtx()
  const { b } = useText()
  return (
    <F k={k} required={required}>
      {(c) => (
        <Select
          value={(form[k] as string) || undefined}
          onValueChange={(v) => {
            set(k, v as never)
            touch(k)
          }}
          disabled={disabled}
        >
          <SelectTrigger {...c} className="w-full">
            <SelectValue placeholder={t("choose")} />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS[options].map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {b(o.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </F>
  )
}

export function SwitchRow({ k, hint, wide }: { k: "smsReminders" | "whatsappMessages" | "selfPay"; hint?: string; wide?: boolean }) {
  const t = useTranslations("patients.edit.fields")
  const { form, set } = useFormCtx()
  const id = `switch-${k}`
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-3", (wide ?? k === "selfPay") && "@min-[30rem]/sec:col-span-2")}>
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="text-sm font-medium">{t(k)}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={!!form[k]} onCheckedChange={(v) => set(k, v)} />
    </div>
  )
}

const CHIP = {
  destructive: "bg-destructive-soft text-destructive-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
} as const

/** Chips input (sheet 10 style): soft chips with a remove button; Enter or comma adds, Backspace on empty removes the last. */
export function ChipsField({ k, tone, add }: { k: "allergies" | "conditions"; tone: keyof typeof CHIP; add: string }) {
  const t = useTranslations("patients.edit.fields")
  const { form, set } = useFormCtx()
  const [draft, setDraft] = React.useState("")
  const items = form[k] ?? []
  const commit = (raw = draft) => {
    const v = raw.trim().replace(/[,،]$/, "").trim()
    if (v && !items.includes(v)) set(k, [...items, v])
    setDraft("")
  }
  return (
    <F k={k} wide>
      {(c) => (
        <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-xs has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50">
          {items.map((x) => (
            <span key={x} className={cn("inline-flex h-6 items-center gap-1 rounded-sm ps-2 pe-1 text-xs font-medium", CHIP[tone])}>
              {x}
              <button
                type="button"
                aria-label={t("remove", { name: x })}
                onClick={() => set(k, items.filter((y) => y !== x))}
                className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Icon name="close-circle" size={14} />
              </button>
            </span>
          ))}
          <input
            {...c}
            value={draft}
            onChange={(e) => (/[,،]$/.test(e.target.value) ? commit(e.target.value) : setDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commit()
              } else if (e.key === "Backspace" && !draft && items.length) set(k, items.slice(0, -1))
            }}
            onBlur={() => commit()}
            placeholder={add}
            className="h-6 w-0 min-w-28 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
        </div>
      )}
    </F>
  )
}

/** Checkbox row (label after the box), optionally full width in the card. */
export function CheckRow({ k, wide }: { k: "sameWhatsapp" | "noAllergies" | "consent" | "welcomeSms"; wide?: boolean }) {
  const t = useTranslations("patients.edit")
  const { form, set, error } = useFormCtx()
  const err = error(k)
  return (
    <div id={`field-${k}`} className={cn("flex flex-col gap-1", wide && "@min-[30rem]/sec:col-span-2")}>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={!!form[k]} onCheckedChange={(v) => set(k, v === true)} aria-invalid={err ? true : undefined} />
        {t(`fields.${k}`)}
      </label>
      {err && <p className="text-xs text-destructive">{t(`errors.${err}`)}</p>}
    </div>
  )
}
