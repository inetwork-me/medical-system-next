"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { notify } from "@/components/ds/toast"

import { isModuleEnabled } from "@/lib/modules"
import { bi } from "@/lib/mock/bi"
import { ActionMenu } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { RadioOption } from "@/components/ds/radio-option"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { Patient } from "../data"
import { toggleTag, usePatientsStore } from "../store"

/**
 * Overlay · Row actions menu: View profile · Edit details · Book visit | Mark as VIP · Merge with another file |
 * Ban patient · Archive file (destructive). Dropdown on desktop, bottom sheet (name + MRN) on mobile.
 * Ban / Archive confirm in dialogs.
 */
export function RowActions({ patient, trigger }: { patient: Patient; trigger?: React.ReactElement }) {
  const t = useTranslations("patients")
  const locale = useLocale()
  const { setTags } = usePatientsStore()
  const [dialog, setDialog] = React.useState<null | "ban" | "archive">(null)
  const name = bi(patient.name, locale)
  const isVip = patient.tags.includes("vip")

  return (
    <>
      <ActionMenu
        title={name}
        description={<bdi dir="ltr">MRN {patient.mrn}</bdi>}
        trigger={
          trigger ?? (
            <Button variant="ghost" size="icon-sm" aria-label={t("list.rowActions", { name })}>
              <Icon name="more" size={16} />
            </Button>
          )
        }
        groups={[
          [
            { key: "view", icon: "eye", label: t("rowMenu.view"), href: `/patients/${patient.id}` },
            { key: "edit", icon: "edit-2", label: t("rowMenu.edit"), href: `/patients/${patient.id}/edit` },
            isModuleEnabled("appointments") && { key: "book", icon: "calendar-add", label: t("rowMenu.book"), href: `/patients/${patient.id}?action=book` },
          ],
          [
            {
              key: "vip",
              icon: "star-1",
              label: isVip ? t("rowMenu.unvip") : t("rowMenu.vip"),
              onSelect: () => {
                setTags(patient.id, toggleTag(patient.tags, "vip", !isVip))
                notify.success(isVip ? t("vipToast.off") : t("vipToast.on"), { description: t("vipToast.text", { name }) })
              },
            },
            {
              key: "merge",
              icon: "people",
              label: t("rowMenu.merge"),
              href: `/patients/merge?a=${patient.id}${patient.duplicateOf ? `&b=${patient.duplicateOf}` : ""}`,
            },
          ],
          [
            !patient.tags.includes("banned") && { key: "ban", icon: "lock", label: t("rowMenu.ban"), destructive: true, onSelect: () => setDialog("ban") },
            { key: "archive", icon: "trash", label: t("rowMenu.archive"), destructive: true, onSelect: () => setDialog("archive") },
          ],
        ]}
      />
      <BanDialog patient={patient} open={dialog === "ban"} onOpenChange={(o) => setDialog(o ? "ban" : null)} />
      <ArchiveDialog patient={patient} open={dialog === "archive"} onOpenChange={(o) => setDialog(o ? "archive" : null)} />
    </>
  )
}

/** Overlay · Ban patient: reason (radio cards), internal note, notify by SMS. */
export function BanDialog({ patient, open, onOpenChange }: { patient: Patient; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("patients.ban")
  const tc = useTranslations("common.actions")
  const locale = useLocale()
  const { setTags } = usePatientsStore()
  const [reason, setReason] = React.useState("noShows")
  const [note, setNote] = React.useState("")
  const [sendSms, setSendSms] = React.useState(true)
  const name = bi(patient.name, locale)

  const confirm = () => {
    setTags(patient.id, toggleTag(patient.tags, "banned", true))
    onOpenChange(false)
    notify.success(t("done", { name }), { description: t("doneText") })
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="lock"
      tone="destructive"
      title={t("title", { name })}
      description={t("description")}
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tc("cancel")}
        </Button>
      }
      primary={
        <Button variant="destructive" onClick={confirm}>
          {t("confirm")}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium">{t("reason")}</p>
        <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
          <RadioOption value="noShows" title={t("noShows")} description={t("noShowsHint")} />
          <RadioOption value="unpaid" title={t("unpaid")} />
          <RadioOption value="abusive" title={t("abusive")} />
          <RadioOption value="other" title={t("other")} />
        </RadioGroup>
      </div>
      <Field label={t("note")}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} className="min-h-18" />
      </Field>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-medium">
        <span className="flex-1">{t("notify")}</span>
        <Switch checked={sendSms} onCheckedChange={setSendSms} />
      </label>
    </ResponsiveDialog>
  )
}

/** Overlay · Archive patient: summary (patient, upcoming visits, balance) + acknowledgement checkbox. */
export function ArchiveDialog({
  patient,
  open,
  onOpenChange,
  onArchived,
}: {
  patient: Patient
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Called after the file is archived (the patient page uses it to go back to the list). */
  onArchived?: () => void
}) {
  const t = useTranslations("patients.archive")
  const tc = useTranslations("common.actions")
  const ts = useTranslations("patients.sheet")
  const locale = useLocale()
  const { archive } = usePatientsStore()
  const [ok, setOk] = React.useState(false)
  const name = bi(patient.name, locale)
  // Mock: the design's sample (Fahad) has 1 upcoming visit and SAR 180 due; others none.
  const sample = patient.id === "004891"
  const rows: [string, React.ReactNode][] = [
    [t("patient"), <>{name} · <bdi dir="ltr">{locale === "ar" ? patient.mrn : `MRN ${patient.mrn}`}</bdi></>],
    [t("upcoming"), t("upcomingValue", { count: sample ? 1 : 0 })],
    [t("balance"), ts("sar", { amount: sample ? 180 : 0 })],
  ]

  const confirm = () => {
    archive(patient.id)
    onOpenChange(false)
    onArchived?.()
    notify.success(t("done"), { description: t("doneText", { name }) })
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setOk(false)
      }}
      icon="trash"
      tone="destructive"
      title={t("title")}
      description={t("description")}
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tc("cancel")}
        </Button>
      }
      primary={
        <Button variant="destructive" onClick={confirm} disabled={!ok}>
          {t("confirm")}
        </Button>
      }
    >
      <dl className="overflow-hidden rounded-lg bg-muted">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 border-b px-3 py-2.5 text-xs last:border-0">
            <dt className="flex-1 text-muted-foreground">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={ok} onCheckedChange={(v) => setOk(v === true)} />
        {t("understand")}
      </label>
    </ResponsiveDialog>
  )
}
