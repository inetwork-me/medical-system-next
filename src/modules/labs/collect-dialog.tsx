"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { LAB_NOW, LAB_STAFF, LAB_TODAY, TUBES, timeOf, type Tube } from "./data"
import { collect, tubesToCollect } from "./machine"
import { TubeDot } from "./parts"
import { labCan } from "./roles"
import { applyStep, useLabOrder, useLabRole } from "./store"
import { useLabText } from "./text"

/** Volume is printed for blood tubes only (the design leaves it off the urine cup and culture bottles). */
const showsMl = (t: Tube) => t.volumeMl && t.type !== "urine" && t.type !== "bottle"

/**
 * Overlay · Collect sample (Collect / Collect next / Recollect; desktop dialog 520, mobile sheet). Patient-ID check
 * with 2 identifiers, the tubes still to collect (all ticked), collected by + time, fasting confirmed (when the order
 * asks for fasting). An unticked tube stays "to collect" (info note). Confirm needs the ID check and at least one
 * tube; it collects the ticked tubes, prints their labels and swaps to the "sample-collected" toast.
 */
export function CollectDialog({ orderNo, onOpenChange }: { orderNo: string; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("labs.collect")
  const tp = useTranslations("labs.priority")
  const { b, short, list } = useLabText()
  const o = useLabOrder(orderNo)
  const role = useLabRole()
  // The tubes to collect when the dialog opened (they stay listed while ticking).
  const [tubes] = React.useState(() => (o ? tubesToCollect(o) : []))
  const [idChecked, setIdChecked] = React.useState(false)
  const [picked, setPicked] = React.useState<Set<number>>(() => new Set(tubes.map((x) => x.no)))
  const phlebotomists = LAB_STAFF.filter((s) => s.role === "phlebotomy")
  const [by, setBy] = React.useState(phlebotomists[0]?.key ?? "")
  const [time, setTime] = React.useState(timeOf(LAB_NOW))
  const [fasting, setFasting] = React.useState(!!o?.fasting)
  if (!o) return null

  const left = tubes.filter((x) => !picked.has(x.no))
  const canSubmit = idChecked && picked.size > 0 && !!by && validTime(time) && labCan(role, "collect")
  const toggle = (no: number, on: boolean) =>
    setPicked((s) => {
      const n = new Set(s)
      if (on) n.add(no)
      else n.delete(no)
      return n
    })

  const confirm = () => {
    if (!canSubmit) return
    const step = applyStep(o.no, (x) => collect(x, [...picked], by, `${LAB_TODAY}T${time}`, { fastingConfirmed: o.fasting ? fasting : undefined }))
    if (!step.ok) return
    onOpenChange(false)
    const remaining = tubesToCollect(step.order)
    toast.success(t("toast", { n: picked.size }), {
      description:
        remaining.length === 0 ? t("toastAll") : remaining.length === 1 ? t("toastOne", { tube: b(TUBES[remaining[0].type].the) }) : t("toastMany", { n: remaining.length }),
    })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title", { name: b(o.patient.name) })}
      description={
        <bdi>
          {t("text", { no: o.no, n: o.tests.length, priority: tp(o.priority) })}
        </bdi>
      }
      icon="drop"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={confirm} disabled={!canSubmit}>
          {t("confirm")}
        </Button>
      }
    >
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <Checkbox checked={idChecked} onCheckedChange={(v) => setIdChecked(v === true)} />
        <span>{t("idCheck")}</span>
      </label>

      <ul aria-label={t("tubes")} className="flex flex-col overflow-hidden rounded-lg border">
        {tubes.map((x) => {
          const tests = list(x.tests.map(short))
          return (
            <li key={x.no} className="border-b last:border-b-0">
              <label className="flex cursor-pointer items-center gap-2.5 p-3 text-sm">
                <Checkbox checked={picked.has(x.no)} onCheckedChange={(v) => toggle(x.no, v === true)} />
                <TubeDot tube={x.type} size={14} />
                <span className="min-w-0 flex-1">
                  {showsMl(x) ? t("tube", { tube: b(TUBES[x.type].full), ml: x.volumeMl!, tests }) : t("tubeNoMl", { tube: b(TUBES[x.type].full), tests })}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("by")}>
          {(p) => (
            <Select value={by} onValueChange={setBy}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {phlebotomists.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {b(s.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("time")}>
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              maxLength={5}
              placeholder="HH:MM"
              value={time}
              onChange={(e) => setTime(e.target.value.replace(/[^d:]/g, ""))}
              aria-invalid={!validTime(time) || undefined}
              dir="ltr"
              startIcon={<Icon name="clock" size={20} />}
              className="text-start tabular-nums rtl:text-right"
            />
          )}
        </Field>
      </div>

      {o.fasting && (
        <SwitchCard
          label={t("fasting")}
          hint={o.fastingHours && o.fastingSince ? t("fastingText", { h: o.fastingHours, since: b(o.fastingSince) }) : undefined}
          checked={fasting}
          onCheckedChange={setFasting}
        />
      )}

      {left.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs font-medium text-info-soft-foreground">
          <Icon name="info-circle" size={18} className="shrink-0" />
          <span>{left.length === 1 ? capFirst(t("oneLeft", { tube: b(TUBES[left[0].type].the), plural: String(left[0].type === "bottle") })) : t("manyLeft", { n: left.length })}</span>
        </p>
      )}
    </ResponsiveDialog>
  )
}

/** 24-hour HH:MM. */
const validTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Bordered switch row: label + hint, switch at the end (Fasting confirmed). */
function SwitchCard({ label, hint, checked, onCheckedChange, className }: { label: React.ReactNode; hint?: React.ReactNode; checked: boolean; onCheckedChange: (v: boolean) => void; className?: string }) {
  const id = React.useId()
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-3", className)}>
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
