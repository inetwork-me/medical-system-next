"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { REP_NOW } from "./data"
import { useB } from "./parts"
import { PIN_LENGTH, PORTALS, validPin, verifySigningPin } from "./portal"
import { AUTHORITY, FACILITY_CODE, type OfficialReturn } from "./returns-data"
import { logReport, markSubmitted, useReturnNotes } from "./store"
import { Strip } from "./strip"

const ME = "mansour"

/**
 * Overlay · Sign off and submit (Sign off and submit on the return, Submit on the tab): the return, period, sections
 * filled, warnings explained; "I checked the numbers and the two warnings"; the signing PIN (the named role only —
 * the caller only opens this for them); the note that it goes to the portal with the facility code and a reference
 * comes back. Every warning must be explained first. Submit → PIN check (stub) → portal client (stub) → the
 * reference is archived with the return, logged, and return-submitted shows it.
 */
export function SubmitReturnDialog({
  r,
  onOpenChange,
  initial,
}: {
  r: OfficialReturn
  onOpenChange: (open: boolean) => void
  /** Stories: open with the drawn state (box ticked, PIN typed) or the errors showing. */
  initial?: { checked?: boolean; pin?: string; tried?: boolean; wrong?: boolean }
}) {
  const t = useTranslations("reports.submit")
  const tr = useTranslations("reports.ret")
  const b = useB()
  const notes = useReturnNotes(r.id)
  const [checked, setChecked] = React.useState(initial?.checked ?? false)
  const [pin, setPin] = React.useState(initial?.pin ?? "")
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  const [wrong, setWrong] = React.useState(initial?.wrong ?? false)
  const [busy, setBusy] = React.useState(false)
  const id = React.useId()
  const warnings = r.checks.length
  const explained = r.checks.filter((c) => notes[c.id]).length
  const allExplained = explained === warnings
  const role = tr(`role.${AUTHORITY[r.authority].signer}`)
  const name = b(r.title).split(" · ")[0]

  const submit = async () => {
    setTried(true)
    if (!checked || !validPin(pin) || !allExplained || busy) return
    setBusy(true)
    const pinOk = await verifySigningPin(ME, pin)
    if (!pinOk.ok) {
      setBusy(false)
      setWrong(true)
      setPin("")
      return
    }
    const res = await PORTALS[r.authority].submit(r, null)
    setBusy(false)
    if (!res.ok) {
      toast.error(t("portalDown"), { description: t("portalDownText"), retry: submit })
      return
    }
    markSubmitted(r.id, { at: REP_NOW, ref: res.reference, by: ME })
    logReport({ at: REP_NOW, kind: "submit", what: r.id, detail: res.reference })
    onOpenChange(false)
    toast.success(t(`toast.${r.authority}`), { description: t("toastText", { ref: res.reference }) })
  }

  const pinError = tried && !validPin(pin) && !wrong ? t("pinError") : wrong ? t("pinWrong") : undefined
  const missing = tried && (!checked || !validPin(pin))

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={b(r.title)}
      icon="send-2"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={submit} disabled={busy}>
          {busy ? t("submitting") : t(`to.${r.authority}`)}
        </Button>
      }
    >
      {tried && !allExplained && (
        <Strip tone="destructive" icon="info-circle">
          {t("explainFirst", { n: warnings })}
        </Strip>
      )}
      {missing && allExplained && (
        <Strip tone="destructive" icon="info-circle">
          {t("missing")}
        </Strip>
      )}
      <dl className="flex flex-col rounded-lg border px-3">
        {(
          [
            [t("return"), name],
            [t("period"), b(r.periodLong)],
            [t("sections"), <span key="s" className="text-success">{t("sectionsValue", { n: r.sections.length })}</span>],
            [
              t("warnings"),
              <span key="w" className={cn(warnings ? "text-warning" : "text-foreground")}>
                {allExplained ? t("warningsAll", { n: warnings }) : t("warningsSome", { n: warnings, explained })}
              </span>,
            ],
          ] as [string, React.ReactNode][]
        ).map(([k, v]) => (
          <div key={k} className="flex items-start gap-3 border-b py-2.5 last:border-b-0">
            <dt className="w-[130px] shrink-0 text-xs text-muted-foreground">{k}</dt>
            <dd className="min-w-0 flex-1 text-sm text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-c`} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox id={`${id}-c`} checked={checked} onCheckedChange={(v) => setChecked(v === true)} aria-invalid={tried && !checked ? true : undefined} />
          {t("confirm", { n: warnings })}
        </label>
        {tried && !checked && <p className="text-xs text-destructive">{t("confirmError")}</p>}
      </div>
      <Field label={t("pin")} required helper={t("pinHint", { role: role.charAt(0).toUpperCase() + role.slice(1) })} error={pinError}>
        {(fp) => (
          <Input
            {...fp}
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={PIN_LENGTH}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))
              setWrong(false)
            }}
            startIcon={<Icon name="lock" size={20} className="text-muted-foreground" />}
            dir="ltr"
          />
        )}
      </Field>
      <Strip tone="info" icon="info-circle">
        {t("portal", { portal: b(AUTHORITY[r.authority].portal), code: FACILITY_CODE })}
      </Strip>
    </ResponsiveDialog>
  )
}
