"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { Field } from "@/components/ds/field"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { BREAK_GLASS_HOURS, MERGE_UNDO_DAYS, REC_NOW, USERS, addHours, type BreakGlassReason, type ReviewOutcome } from "./data"
import { patientOf } from "./lookup"
import { KvBox, Latin, Strip, useB, useDidLabel } from "./parts"
import { recCan } from "./roles"
import { ME } from "./session"
import { grantAccess, logAccess, saveMerge, saveReview, useAccess, useDuplicates, useRecRole } from "./store"

const REASONS: BreakGlassReason[] = ["emergency", "consult", "covering", "other"]
const OUTCOMES: ReviewOutcome[] = ["justified", "askWhy", "breach"]

/* ------------------------------------------------------------------ restricted file */

/**
 * Overlay · Restricted file (Open on a restricted patient outside the care team). Red note: restricted and you're
 * not in the care team; Why (Emergency care …), details; warning that the privacy officer is told and access ends
 * after 4 hours. Open the file → break the glass logged (flagged) + access for 4 hours → access-granted.
 */
export function RestrictedFileDialog({
  patient,
  onOpenChange,
  onGranted,
  initial,
}: {
  patient: string
  onOpenChange: (open: boolean) => void
  onGranted?: () => void
  initial?: { reason?: BreakGlassReason; details?: string; tried?: boolean }
}) {
  const t = useTranslations("records.restrictedFile")
  const tr = useTranslations("records.restriction")
  const b = useB()
  const [reason, setReason] = React.useState<BreakGlassReason | "">(initial?.reason ?? "")
  const [details, setDetails] = React.useState(initial?.details ?? "")
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  const p = patientOf(patient)
  const name = b(p.name)

  const open = () => {
    setTried(true)
    if (!reason || !details.trim()) return
    const until = addHours(REC_NOW, BREAK_GLASS_HOURS)
    const why = { en: `${t(`reasons.${reason}`)} · ${details.trim()}`, ar: `${t(`reasons.${reason}`)} · ${details.trim()}` }
    // Logged and flagged at once; the privacy officer is told (stub: the flagged row is their notification).
    logAccess({ id: `ax-bg-${patient}-${Date.now()}`, at: REC_NOW, user: ME, patient, action: "breakGlass", why, flag: "breakGlass", until })
    grantAccess(patient, until)
    onOpenChange(false)
    onGranted?.()
    toast.warning(t("toast", { h: BREAK_GLASS_HOURS }), { description: t("toastText") })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={
        <>
          {name}
          {p.restricted && <> · {tr(p.restricted)}</>}
        </>
      }
      icon="lock"
      tone="destructive"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={open}>{t("open")}</Button>}
    >
      <Strip tone="destructive" icon="lock">
        {t("note", { name })}
      </Strip>
      <Field label={t("why")} required error={tried && !reason ? t("whyError") : undefined}>
        {(fp) => (
          <Select value={reason} onValueChange={(v) => setReason(v as BreakGlassReason)}>
            <SelectTrigger {...fp} className="w-full">
              <SelectValue placeholder={t("whyPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`reasons.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label={t("details")} required error={tried && !details.trim() ? t("detailsError") : undefined}>
        <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("detailsPlaceholder")} />
      </Field>
      <Strip tone="warning" icon="warning-2">
        {t("warning", { h: BREAK_GLASS_HOURS })}
      </Strip>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ review access */

/**
 * Overlay · Review this access (Review on flagged rows; privacy officer). Who, patient, what, why flagged; Outcome:
 * Justified / Ask him why / Report a breach; note. Save review → access-reviewed. The log entry itself never changes;
 * the review sits beside it.
 */
export function ReviewAccessDialog({
  eventId,
  onOpenChange,
  initial,
}: {
  eventId: string
  onOpenChange: (open: boolean) => void
  initial?: { outcome?: ReviewOutcome; note?: string; tried?: boolean }
}) {
  const t = useTranslations("records.review")
  const b = useB()
  const did = useDidLabel()
  const role = useRecRole()
  const ev = useAccess().find((x) => x.id === eventId)
  const [outcome, setOutcome] = React.useState<ReviewOutcome | "">(initial?.outcome ?? "")
  const [note, setNote] = React.useState(initial?.note ?? "")
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  const id = React.useId()
  if (!ev) return null
  const u = USERS[ev.user]
  const p = patientOf(ev.patient)
  const female = !!(u as { female?: boolean }).female
  const allowed = recCan(role, "reviewAccess")

  const save = () => {
    setTried(true)
    if (!allowed || !outcome) return
    saveReview(ev.id, { by: ME, at: REC_NOW, outcome, note: note.trim() })
    onOpenChange(false)
    toast.success(t("toast"), { description: t(`toastText.${outcome}`, { name: b(u.name).replace(/^Dr\. |^د\. /, "").split(" ")[0], female: female ? "yes" : "no" }) })
  }

  const what =
    ev.action === "open"
      ? t(p.sex === "f" ? "openedHer" : "openedHis", { time: ev.at.slice(11, 16), min: ev.minutes ?? 1 })
      : `${did(ev.action, ev.pages)} · ${ev.at.slice(11, 16)}`
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t(`subtitle.${ev.flag === "breakGlass" ? "breakGlass" : "unusual"}`)}
      icon="search-zoom-in"
      tone="warning"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={save} disabled={!allowed}>
          {t("save")}
        </Button>
      }
    >
      <KvBox
        rows={[
          [t("who"), `${b(u.name)} · ${b(u.role).toLocaleLowerCase()}`],
          [t("patient"), b(p.name)],
          [t("what"), what],
          [
            t("whyFlagged"),
            <span key="w" className={ev.flag === "breakGlass" ? "text-destructive" : "text-warning-soft-foreground"}>
              {b(ev.why)}
            </span>,
          ],
        ]}
      />
      {!allowed && (
        <Strip tone="warning" icon="warning-2">
          {t("notAllowed")}
        </Strip>
      )}
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-o`} className="text-xs font-medium text-foreground">
          {t("outcome")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </span>
        <Segmented
          value={outcome as ReviewOutcome}
          onValueChange={setOutcome}
          aria-labelledby={`${id}-o`}
          options={OUTCOMES.map((o) => ({ value: o, label: o === "askWhy" ? t(female ? "outcomes.askHer" : "outcomes.askHim") : t(`outcomes.${o}`) }))}
        />
        {tried && !outcome && <p className="text-xs text-destructive">{t("outcomeError")}</p>}
      </div>
      <Field label={t("note")}>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} />
      </Field>
      {outcome === "breach" && (
        <Strip tone="destructive" icon="danger">
          {t("breachNote")}
        </Strip>
      )}
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ merge files */

/**
 * Overlay · Merge duplicate files (Possible duplicate file › Merge; 640). Why they look the same, the two files side
 * by side as radio cards (visits, ID, since; Keep badge), "Move visits, results, documents and invoices", "the old MRN
 * stays as a pointer; undo for 30 days". Merge files → files-merged (with Undo).
 */
export function MergeFilesDialog({ pairId, onOpenChange, initial }: { pairId: string; onOpenChange: (open: boolean) => void; initial?: { keep?: string } }) {
  const t = useTranslations("records.merge")
  const b = useB()
  const dates = useDates()
  const role = useRecRole()
  const pair = useDuplicates().find((d) => d.id === pairId)
  const [keep, setKeep] = React.useState(initial?.keep ?? pair?.files[0].key ?? "")
  const [move, setMove] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const moveId = React.useId()
  if (!pair) return null
  const keepP = patientOf(keep)
  const other = pair.files.find((f) => f.key !== keep)!
  const otherP = patientOf(other.key)
  const allowed = recCan(role, "merge")

  const merge = () => {
    setTried(true)
    if (!allowed || !move) return
    const m = { pair: pair.id, keep: keepP.mrn, old: otherP.mrn, at: REC_NOW }
    saveMerge(m)
    onOpenChange(false)
    toast.success(t("toast"), {
      description: t("toastText", { mrn: `⁦${keepP.mrn}⁩` }),
      action: {
        label: t("undo"),
        onClick: () => {
          saveMerge({ ...m, undone: REC_NOW })
          toast.info(t("undoneToast"), { description: t("undoneText", { mrn: `⁦${otherP.mrn}⁩` }) })
        },
      },
    })
  }
  const since = (iso: string) => (iso.endsWith("-01-01") ? iso.slice(0, 4) : dates.dayMonth(iso))

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={b(keepP.name)}
      icon="profile-2user"
      width="sm:max-w-160"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={merge} disabled={!allowed}>
          {t("merge")}
        </Button>
      }
    >
      <Strip tone="info" icon="info-circle">
        {t(pair.files.some((f) => !patientOf(f.key).nationalIdLast3) ? "whyIdOne" : "why")}
      </Strip>
      {!allowed && (
        <Strip tone="warning" icon="warning-2">
          {t("notAllowed")}
        </Strip>
      )}
      <RadioGroupPrimitive.Root value={keep} onValueChange={setKeep} aria-label={t("keepLabel")} className="grid gap-3 sm:grid-cols-2">
        {pair.files.map((f) => {
          const p = patientOf(f.key)
          const on = f.key === keep
          return (
            <RadioGroupPrimitive.Item
              key={f.key}
              value={f.key}
              className={cn(
                "group/radio flex flex-col gap-1 rounded-xl border bg-card p-4 text-start outline-none transition-colors hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on && "border-primary bg-accent hover:bg-accent"
              )}
            >
              <span className="flex items-center gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card group-data-[state=checked]/radio:border-primary">
                  <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
                </span>
                <Latin className="flex-1 text-sm font-medium text-foreground">{p.mrn}</Latin>
                {on && <StatusBadge tone="success">{t("keep")}</StatusBadge>}
              </span>
              <dl className="flex flex-col">
                {(
                  [
                    [t("visits"), f.visitNote ? `${f.visits} · ${b(f.visitNote)}` : String(f.visits)],
                    [t("id"), p.nationalIdLast3 ? t("idEnds", { n: p.nationalIdLast3 }) : t("idMissing")],
                    [t("since"), since(f.since)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex gap-3 border-b py-2.5 last:border-b-0">
                    <dt className="w-[110px] shrink-0 text-xs text-muted-foreground">{k}</dt>
                    <dd className="text-sm text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </RadioGroupPrimitive.Item>
          )
        })}
      </RadioGroupPrimitive.Root>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={moveId} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox id={moveId} checked={move} onCheckedChange={(v) => setMove(v === true)} aria-invalid={tried && !move} />
          <bdi>{t("move", { mrn: `⁦${keepP.mrn}⁩` })}</bdi>
        </label>
        {tried && !move && <p className="text-xs text-destructive">{t("moveError")}</p>}
      </div>
      <Strip tone="info" icon="info-circle">
        <bdi>{t("pointer", { mrn: `⁦${otherP.mrn}⁩`, days: MERGE_UNDO_DAYS })}</bdi>
      </Strip>
    </ResponsiveDialog>
  )
}
