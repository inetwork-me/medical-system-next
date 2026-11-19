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
import { Textarea } from "@/components/ui/textarea"
import { useDoctors } from "@/modules/doctors/store"
import { LAB_NOW, LAB_TODAY, analyteOf, minsBetween, timeOf, type CriticalCall } from "../data"
import { logCall, minsToDeadline, refText, uncalledCriticals, valueText } from "../machine"
import { Latin, ltrRun } from "../parts"
import { labCan } from "../roles"
import { applyStep, useLabOrder, useLabRole } from "../store"
import { useLabText } from "../text"

const HOW: CriticalCall["how"][] = ["phone", "inPerson", "secureMessage"]
const validTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

/** Key–value row (dialog summary): label 12 muted, value 14; `tone` colours the value. */
export function KvRow({ label, children, tone }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-3 border-b py-3.5 first:pt-0 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm", tone ?? "text-foreground")}>{children}</dd>
    </div>
  )
}

/**
 * Overlay · Log critical call (Log call / Log critical call; destructive). Patient, ordering doctor + extension,
 * resulted time and the call-by deadline (resulted + 30 min, red); Spoke to, How, Time of call, "The doctor read the
 * value back" (required), Doctor's instruction. Save logs the call — release is blocked until it's logged — and
 * swaps to the "critical-logged" toast.
 */
export function CriticalCallDialog({ orderNo, onOpenChange }: { orderNo: string; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("labs.call")
  const { b, doctorName } = useLabText()
  const role = useLabRole()
  const doctors = useDoctors()
  const o = useLabOrder(orderNo)
  const [item] = React.useState(() => (o ? uncalledCriticals(o)[0] : undefined))
  const [spokeTo, setSpokeTo] = React.useState(o?.doctorId ?? "")
  const [how, setHow] = React.useState<CriticalCall["how"]>("phone")
  const [time, setTime] = React.useState(timeOf(LAB_NOW))
  const [readBack, setReadBack] = React.useState(false)
  const [instruction, setInstruction] = React.useState("")
  if (!o || !item) return null

  const a = analyteOf(item.result.analyte)!
  const doc = doctors.find((d) => d.key === o.doctorId)
  // The ordering doctor first, then the doctors of the same clinic (covering).
  const options = [o.doctorId, ...doctors.filter((d) => d.active && d.clinic === doc?.clinic && d.key !== o.doctorId).map((d) => d.key)]
  const left = minsToDeadline(item)
  const ok = readBack && !!spokeTo && validTime(time) && labCan(role, "logCall")

  const save = () => {
    if (!ok) return
    const at = `${LAB_TODAY}T${time}`
    const step = applyStep(o.no, (x) => logCall(x, { analyte: item.result.analyte, spokeTo, how, at, readBack, instruction: instruction.trim() || undefined, by: "ali" }))
    if (!step.ok) return
    onOpenChange(false)
    toast.success(t("toast"), { description: t("toastText", { doctor: doctorName(spokeTo), time, n: Math.max(0, minsBetween(item.resultedAt, at)) }) })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={<bdi>{t("text", { analyte: b(a.name), value: ltrRun(`${valueText(item.result.analyte, item.result.value)} ${item.result.unit}`), ref: ltrRun(refText(item.result)) })}</bdi>}
      icon="call-calling"
      tone="destructive"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button variant="destructive" onClick={save} disabled={!ok}>
          {t("confirm")}
        </Button>
      }
    >
      <dl className="flex flex-col">
        <KvRow label={t("patient")}>
          {b(o.patient.name)} · <Latin>{o.patient.mrn}</Latin>
        </KvRow>
        <KvRow label={t("doctor")}>{doc ? t("doctorExt", { doctor: doctorName(o.doctorId), ext: doc.ext }) : doctorName(o.doctorId)}</KvRow>
        <KvRow label={t("resulted")}>
          <Latin>{timeOf(item.resultedAt)}</Latin>
        </KvRow>
        <KvRow label={t("callBy")} tone="text-destructive">
          <bdi>{t(left < 0 ? "overdue" : "left", { time: timeOf(item.deadline), n: Math.abs(left) })}</bdi>
        </KvRow>
      </dl>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("spokeTo")} required>
          {(p) => (
            <Select value={spokeTo} onValueChange={setSpokeTo}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((k) => (
                  <SelectItem key={k} value={k}>
                    {doctorName(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("how")}>
          {(p) => (
            <Select value={how} onValueChange={(v) => setHow(v as CriticalCall["how"])}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOW.map((h) => (
                  <SelectItem key={h} value={h}>
                    {t(`howOpt.${h}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("time")} required className="sm:col-span-2">
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              maxLength={5}
              placeholder="HH:MM"
              value={time}
              onChange={(e) => setTime(e.target.value.replace(/[^\d:]/g, ""))}
              aria-invalid={!validTime(time) || undefined}
              dir="ltr"
              startIcon={<Icon name="clock" size={20} />}
              className="tabular-nums rtl:text-right"
            />
          )}
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <Checkbox checked={readBack} onCheckedChange={(v) => setReadBack(v === true)} />
        {t("readBack")}
      </label>

      <Field label={t("instruction")}>{(p) => <Textarea {...p} rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} />}</Field>
    </ResponsiveDialog>
  )
}
