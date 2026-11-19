"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { DatePicker } from "@/components/ds/pickers"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addToWaitlist } from "@/modules/appointments/waitlist"
import { DEACTIVATE_REASONS, DOCTORS_TODAY, bookingsBetween, openItems, type DeactivateReason, type Doctor } from "./data"
import { useDoctorMoveBookings } from "./move-bookings"
import { updateDoctor, useDoctors } from "./store"
import { ltr, useDoctorText } from "./text"

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fromIso = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** Default last working day: the end of next month (design: 31/12/2026 from Wed 18 Nov). */
const endOfNextMonth = (iso: string) => {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) + 1, 0, 12))
  return d.toISOString().slice(0, 10)
}
/** Bookings already made for the 4 weeks after the last working day (they need moving or cancelling). */
export const bookingsAfter = (d: Doctor, lastDay: string) => bookingsBetween(d, addDays(lastDay, 1), addDays(lastDay, 28))
const stripDr = (s: string) => s.replace(/^(Dr\.|د\.)\s*/, "")

/**
 * Overlay · Deactivate doctor (destructive; desktop dialog, mobile sheet): future bookings · open referrals · unsigned
 * notes; Last working day + Reason; the Move bookings block (another Pediatrics doctor, spread across the department,
 * or cancel); keep read-only access for 30 days. Deactivate sets the last day (no slots after it), moves the bookings
 * (what nobody can fit goes to the Appointments waiting list) and swaps to the "doctor-deactivated" toast.
 */
export function DeactivateDialog({ doctorKey, onOpenChange }: { doctorKey: string; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("doctors.deactivate")
  const tr = useTranslations("common.reassign")
  const { b } = useDoctorText()
  const d = useDoctors().find((x) => x.key === doctorKey)
  const [lastDay, setLastDay] = React.useState<Date | undefined>(() => fromIso(endOfNextMonth(DOCTORS_TODAY)))
  const [reason, setReason] = React.useState<DeactivateReason>("contract")
  const [keep, setKeep] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const iso = lastDay ? isoOf(lastDay) : ""
  // The bookings already made for the 4 weeks after the last working day.
  const move = useDoctorMoveBookings(d, iso ? addDays(iso, 1) : "", iso ? addDays(iso, 28) : "")
  if (!d) return null

  const n = move.count
  const open = openItems(d)
  const error = tried && !iso ? t("required") : iso && iso < DOCTORS_TODAY ? t("past") : undefined
  const name = b(d.name)

  const confirm = () => {
    setTried(true)
    if (!iso || iso < DOCTORS_TODAY) return
    const o = move.outcome()
    const plan = o.kind === "doctor" && o.cover ? { cover: o.cover.key } : o.kind === "spread" ? { spread: true } : { cancelBookings: true }
    updateDoctor(d.key, { deactivation: { lastDay: iso, reason, keepAccess: keep, bookings: n, ...plan } })
    const waiting = o.kind === "cancel" ? 0 : o.waiting
    addToWaitlist({ count: waiting, source: "deactivate", doctor: d.key, from: addDays(iso, 1), to: addDays(iso, 28) })
    onOpenChange(false)
    const after = waiting ? tr("waitingAfter", { n: waiting }) : ""
    const description =
      o.kind === "cancel" || (o.kind === "doctor" && !o.cover)
        ? t("toastCancelledAll", { n })
        : o.kind === "spread"
          ? t("toastSpread", { n: o.covered, k: o.doctors }) + after
          : t("toastMovedTo", { n: o.covered, name: b({ en: o.cover!.name.en, ar: stripDr(o.cover!.name.ar) }), female: String(o.cover!.female) }) + after
    toast.success(t("toast", { name }), { description: ltr(description) })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title", { name })}
      description={t("text", { female: String(d.female) })}
      icon="user-remove"
      tone="destructive"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button variant="destructive" onClick={confirm}>
          {t("confirm")}
        </Button>
      }
    >
      <p className="flex items-center gap-2.5 rounded-lg bg-destructive-soft p-3 text-xs text-destructive-soft-foreground tabular-nums">
        <Icon name="danger" size={16} className="shrink-0" />
        <span>{t("open", { n, r: open.referrals, u: open.notes })}</span>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("lastDay")} required error={error}>
          {(p) => <DatePicker {...p} value={lastDay} onChange={setLastDay} placeholder="dd/mm/yyyy" />}
        </Field>
        <Field label={t("reason")}>
          {(p) => (
            <Select value={reason} onValueChange={(v) => setReason(v as DeactivateReason)}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEACTIVATE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`reasons.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      {move.element}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={keep} onCheckedChange={(v) => setKeep(v === true)} />
        {t("keep", { female: String(d.female) })}
      </label>
    </ResponsiveDialog>
  )
}
