"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { LAB_NOW } from "../data"
import { releasedCount, send } from "../machine"
import { ltrRun } from "../parts"
import { labCan } from "../roles"
import { applyStep, useLabOrder, useLabRole } from "../store"
import { useLabText } from "../text"

type Channel = "app" | "sms" | "email" | "doctor"
type Lang = "both" | "ar" | "en"

function ChannelRow({ label, hint, checked, onCheckedChange, disabled }: { label: string; hint: React.ReactNode; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) {
  const id = React.useId()
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-3", disabled && "opacity-70")}>
      <label htmlFor={id} className={cn("flex min-w-0 flex-1 flex-col gap-0.5", !disabled && "cursor-pointer")}>
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

/**
 * Overlay · Send results (Report → Send results): channels as switches — patient app, SMS with a secure link to the
 * guardian / patient, email the PDF (off when there's no email), the ordering doctor's inbox — and the report
 * language. Only released results go out. Send swaps to the "results-sent" toast ("App, SMS and the doctor's inbox").
 */
export function SendDialog({ orderNo, onOpenChange }: { orderNo: string; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("labs.send")
  const { b, ar, doctorName } = useLabText()
  const role = useLabRole()
  const o = useLabOrder(orderNo)
  const child = (o?.patient.ageMonths ?? 0) < 18 * 12
  const [on, setOn] = React.useState<Record<Channel, boolean>>({ app: true, sms: !!o?.patient.contact, email: false, doctor: true })
  const [lang, setLang] = React.useState<Lang>("both")
  if (!o) return null

  const released = releasedCount(o) > 0
  const first = b(o.patient.name).split(" ")[0]
  const picked = (["app", "sms", "email", "doctor"] as Channel[]).filter((c) => on[c])
  const canSend = released && picked.length > 0 && labCan(role, "send")
  const set = (c: Channel) => (v: boolean) => setOn((s) => ({ ...s, [c]: v }))

  const confirm = () => {
    if (!canSend) return
    const step = applyStep(o.no, (x) => send(x, "salma", LAB_NOW))
    if (!step.ok) return
    onOpenChange(false)
    const names = picked.filter((c) => c !== "email").map((c) => t(`via.${c as "app"}`))
    // "App, SMS and the doctor's inbox" — "التطبيق والرسالة وبريد الطبيب".
    const joined = ar ? names.join(" و") : names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} ${t("via.and")} ${names.at(-1)}`
    toast.success(t("toast"), { description: joined.charAt(0).toUpperCase() + joined.slice(1) })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={<bdi>{t("text", { no: ltrRun(o.no), name: b(o.patient.name) })}</bdi>}
      icon="send-2"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={confirm} disabled={!canSend}>
          {t("confirm")}
        </Button>
      }
    >
      {!released && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-xs font-medium text-warning-soft-foreground">
          <Icon name="warning-2" size={18} className="shrink-0" />
          {t("notReleased")}
        </p>
      )}
      <ChannelRow label={t("app")} hint={child ? t("appGuardian", { name: first }) : t("appPatient", { name: first })} checked={on.app} onCheckedChange={set("app")} />
      <ChannelRow
        label={t("sms")}
        hint={o.patient.contact ? <bdi>{t("smsTo", { phone: ltrRun(o.patient.contact.phone), rel: b(o.patient.contact.relation) })}</bdi> : t("noMobile")}
        checked={on.sms}
        onCheckedChange={set("sms")}
        disabled={!o.patient.contact}
      />
      <ChannelRow label={t("email")} hint={o.patient.email ?? t("noEmail")} checked={on.email} onCheckedChange={set("email")} disabled={!o.patient.email} />
      <ChannelRow label={t("doctor")} hint={doctorName(o.doctorId)} checked={on.doctor} onCheckedChange={set("doctor")} />
      <Field label={t("language")}>
        {(p) => (
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger {...p} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["both", "ar", "en"] as Lang[]).map((l) => (
                <SelectItem key={l} value={l}>
                  {t(`lang.${l}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
    </ResponsiveDialog>
  )
}
