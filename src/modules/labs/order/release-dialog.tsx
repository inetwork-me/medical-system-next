"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { LAB_NOW, analyteOf, testOf, timeOf, type Flag, type Panel } from "../data"
import { canRelease, release, uncalledCriticals } from "../machine"
import { labCan } from "../roles"
import { applyStep, useLabOrder, useLabRole } from "../store"
import { useLabText } from "../text"
import { KvRow } from "./call-dialog"

const countFlags = (p: Panel) => {
  const c: Record<Flag, number> = { C: 0, H: 0, L: 0 }
  for (const r of p.results) if (r.flag) c[r.flag]++
  if (p.mockFlags) for (const k of ["C", "H", "L"] as Flag[]) c[k] += p.mockFlags[k] ?? 0
  return c
}

/**
 * Overlay · Validate & release (primary). Info summary of the flags (and when the critical call was logged), one row
 * per submitted panel with its flag counts, the panels not ready as "Release later", "Show in the patient app now"
 * and a comment for the report. Releases the submitted panels (partial release: the rest go later) and swaps to the
 * "results-released" toast. While a critical value isn't called in, the dialog says so, offers Log call and can't
 * release.
 */
export function ReleaseDialog({ orderNo, onOpenChange, onLogCall }: { orderNo: string; onOpenChange: (open: boolean) => void; onLogCall: () => void }) {
  const t = useTranslations("labs.release")
  const { b, short, doctorName } = useLabText()
  const role = useLabRole()
  const o = useLabOrder(orderNo)
  const [app, setApp] = React.useState(true)
  const [comment, setComment] = React.useState("")
  if (!o) return null

  const ready = o.panels.filter((p) => p.state === "validate")
  const later = o.panels.filter((p) => p.state !== "validate" && p.state !== "released")
  const doneCount = o.panels.filter((p) => p.state === "validate" || p.state === "released").length
  const uncalled = uncalledCriticals(o)
  const guard = canRelease(o)
  const total = ready.reduce(
    (s, p) => {
      const c = countFlags(p)
      return { C: s.C + c.C, H: s.H + c.H, L: s.L + c.L }
    },
    { C: 0, H: 0, L: 0 } as Record<Flag, number>
  )
  const call = o.calls.filter((c) => c.readBack).sort((a, z) => z.at.localeCompare(a.at))[0]
  const flags = total.C || total.H ? t("flags", { c: total.C, h: total.H, both: String(!!total.C && !!total.H) }) : t("noFlags").replace(/\.$/, "")
  const info = call && total.C ? t("info", { flags, time: timeOf(call.at) }) : t("infoNoCall", { flags })

  /** Row label: a titled panel lists its analytes ("HbA1c · fasting glucose"), else the test name. */
  const label = (p: Panel) =>
    p.title && p.results.length
      ? p.results.map((r, i) => (i === 0 ? b(analyteOf(r.analyte)!.name) : lowerFirst(b(analyteOf(r.analyte)!.name)))).join(" · ")
      : b(testOf(p.test)?.name ?? { en: p.test, ar: p.test })
  const laterLabel = later.map((p, i) => (i === 0 ? b(testOf(p.test)?.name ?? { en: p.test, ar: p.test }) : short(p.test))).join(" · ")

  const summary = (p: Panel) => {
    const c = countFlags(p)
    const parts = [c.C && t("critical", { n: c.C }), c.H && t("high", { n: c.H }), c.L && t("low", { n: c.L })].filter(Boolean) as string[]
    const tone = c.C ? "text-destructive" : c.H ? "text-warning-soft-foreground" : c.L ? "text-info-soft-foreground" : "text-foreground"
    return { text: parts.length ? parts.join(" · ") : t("normal"), tone }
  }

  const confirm = () => {
    if (!guard.ok || !labCan(role, "release")) return
    const step = applyStep(o.no, (x) => release(x, ready.map((p) => p.test), "salma", LAB_NOW, { inPatientApp: app, comment: comment.trim() || undefined }))
    if (!step.ok) return
    onOpenChange(false)
    toast.success(t("toast"), { description: app ? t("toastApp", { doctor: doctorName(o.doctorId) }) : t("toastDoctor", { doctor: doctorName(o.doctorId) }) })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={<bdi>{t("text", { no: o.no, ready: doneCount, total: o.panels.length })}</bdi>}
      icon="tick-circle"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={confirm} disabled={!guard.ok || !labCan(role, "release")}>
          {t("confirm")}
        </Button>
      }
    >
      {!ready.length ? (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t("nothing")}</p>
      ) : uncalled.length ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg bg-destructive-soft p-3 text-xs font-medium text-destructive-soft-foreground sm:flex-row sm:items-center">
          <span className="flex min-w-0 flex-1 items-start gap-2">
            <Icon name="danger" size={18} className="shrink-0" />
            {t("blocked", { n: uncalled.length })}
          </span>
          {labCan(role, "logCall") && (
            <Button variant="destructive" size="sm" onClick={onLogCall}>
              <Icon name="call-calling" size={20} />
              {t("logCall")}
            </Button>
          )}
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs font-medium text-info-soft-foreground">
          <Icon name="info-circle" size={18} className="shrink-0" />
          <bdi>{info}</bdi>
        </p>
      )}

      {(ready.length > 0 || later.length > 0) && (
        <dl className="flex flex-col">
          {ready.map((p) => {
            const s = summary(p)
            return (
              <KvRow key={p.test} label={label(p)} tone={s.tone}>
                {s.text}
              </KvRow>
            )
          })}
          {later.length > 0 && (
            <KvRow label={laterLabel} tone="text-muted-foreground">
              {t("later")}
            </KvRow>
          )}
        </dl>
      )}

      <SwitchRow label={t("app")} hint={o.patient.ageMonths < 18 * 12 ? t("appGuardian") : t("appPatient")} checked={app} onCheckedChange={setApp} />
      <Field label={t("comment")}>{(p) => <Textarea {...p} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
    </ResponsiveDialog>
  )
}

const lowerFirst = (s: string) => (/[A-Z].*[A-Z0-9]/.test(s) || /[؀-ۿ]/.test(s) ? s : s.toLowerCase())

function SwitchRow({ label, hint, checked, onCheckedChange }: { label: string; hint?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  const id = React.useId()
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-3")}>
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

