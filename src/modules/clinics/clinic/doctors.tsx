"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Icon } from "@/components/ds/icon"
import { ActionMenu } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Bi } from "@/lib/mock/bi"
import { DoctorName } from "@/modules/doctors/link"
import type { Clinic, ClinicDoctor } from "../data"
import { arFor } from "../parts"
import { updateClinic, useClinics } from "../store"
import { useClinicText } from "../text"
import { ClinicPage, useCurrentClinic } from "./frame"

/** Clinic page · Doctors: Widget / Clinic Doctors — table when wide (≥ 48rem), compact rows otherwise; Add doctor. */
export function ClinicDoctors() {
  const c = useCurrentClinic()
  return (
    <ClinicPage>
      <DoctorsCard clinic={c} />
    </ClinicPage>
  )
}

function DoctorsCard({ clinic: c }: { clinic: Clinic }) {
  const t = useTranslations("clinics.doctors")
  const { b } = useClinicText()
  const [adding, setAdding] = React.useState(false)
  const remove = (d: ClinicDoctor) => {
    const before = c.doctors
    updateClinic(c.key, { doctors: before.filter((x) => x !== d), doctorCount: before.length - 1 })
    toast.success(t("removed"), {
      description: t("removedText", { name: b(d.name), clinic: b(c.name) }),
      action: { label: t("undo"), onClick: () => updateClinic(c.key, { doctors: before, doctorCount: before.length }) },
    })
  }
  return (
    <Widget
      title={t("title")}
      description={t("text", { n: c.doctors.length })}
      className="gap-4 p-4 md:p-5"
      action={
        <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={() => setAdding(true)}>
          <Icon name="add" size={16} />
          {t("add")}
        </Button>
      }
    >
      {c.doctors.length === 0 ? (
        <EmptyState icon="people" title={t("empty")} description={t("emptyText")} className="py-10" />
      ) : (
        <div className="@container/doc">
          {/* Wide: table */}
          <div className="hidden overflow-hidden rounded-lg border @3xl/doc:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr className="h-10">
                  <th scope="col" className="ps-4 text-start font-medium">{t("col.doctor")}</th>
                  <th scope="col" className="w-34.5 px-3 text-start font-medium">{t("col.days")}</th>
                  <th scope="col" className="w-30.5 px-3 text-start font-medium">{t("col.hours")}</th>
                  <th scope="col" className="w-53 px-3 text-start font-medium">{t("col.today")}</th>
                  <th scope="col" className="w-28 px-3 text-start font-medium">{t("col.month")}</th>
                  <th scope="col" className="w-20.5 px-3 text-start font-medium">{t("col.rating")}</th>
                  <th scope="col" className="w-14 pe-4">
                    <span className="sr-only">{t("col.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {c.doctors.map((d) => (
                  <tr key={d.name.en}>
                    <td className="py-3 ps-4">
                      <Who d={d} />
                    </td>
                    <td className="px-3">{b(d.days)}</td>
                    <td className="px-3 tabular-nums">
                      <bdi dir="ltr">{d.hours}</bdi>
                    </td>
                    <td className="px-3">
                      <StatusBadge tone={d.today.tone}>{b(d.today.label)}</StatusBadge>
                    </td>
                    <td className="px-3 tabular-nums">{d.month}</td>
                    <td className="px-3 tabular-nums">
                      <bdi dir="ltr">★ {d.rating}</bdi>
                    </td>
                    <td className="pe-4 text-end">
                      <RowMenu d={d} onRemove={() => remove(d)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Compact: rows */}
          <ul className="flex flex-col divide-y @3xl/doc:hidden">
            {c.doctors.map((d) => (
              <li key={d.name.en} className="flex items-start gap-2.5 py-3">
                <Avatar size="sm">
                  <AvatarFallback>{d.initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="text-sm font-medium">{b(d.name)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {b(d.days)} · <bdi dir="ltr">{d.hours}</bdi>
                  </span>
                  <StatusBadge tone={d.today.tone}>{b(d.today.label)}</StatusBadge>
                </div>
                <RowMenu d={d} onRemove={() => remove(d)} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {adding && <AddDoctorDialog clinic={c} open={adding} onOpenChange={setAdding} />}
    </Widget>
  )
}

function Who({ d }: { d: ClinicDoctor }) {
  const { b } = useClinicText()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar size="sm">
        <AvatarFallback>{d.initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <DoctorName en={d.name.en} className="truncate font-medium">
          {b(d.name)}
        </DoctorName>
        <span className="truncate text-xs text-muted-foreground">{b(d.role)}</span>
      </div>
    </div>
  )
}

function RowMenu({ d, onRemove }: { d: ClinicDoctor; onRemove: () => void }) {
  const t = useTranslations("clinics.doctors")
  const { b } = useClinicText()
  return (
    <ActionMenu
      title={b(d.name)}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={t("menu")}>
          <Icon name="more" size={16} />
        </Button>
      }
      groups={[[{ key: "remove", icon: "trash", label: t("remove"), destructive: true, onSelect: onRemove }]]}
    />
  )
}

/* ================================================================== Add doctor */

type Candidate = { initials: string; name: Bi; specialty: Bi }
/** Doctors on the branch's staff who can join a clinic (design: Dr. Rana Al-Mutlaq · Pediatrics first). */
const CANDIDATES: Candidate[] = [
  { initials: "RA", name: { en: "Dr. Rana Al-Mutlaq", ar: "د. رنا المطلق" }, specialty: { en: "Pediatrics", ar: "أطفال" } },
  { initials: "HA", name: { en: "Dr. Hatem Al-Juhani", ar: "د. حاتم الجهني" }, specialty: { en: "Family medicine", ar: "طب أسرة" } },
  { initials: "SA", name: { en: "Dr. Sara Al-Otaibi", ar: "د. سارة العتيبي" }, specialty: { en: "General practice", ar: "طب عام" } },
  { initials: "MA", name: { en: "Dr. Mazen Al-Ahmadi", ar: "د. مازن الأحمدي" }, specialty: { en: "Internal medicine", ar: "باطنية" } },
]
const ROLES = ["specialist", "consultant", "resident"] as const
const DAYS = ["sunTueThu", "sunThu", "satWed", "monWed"] as const
const DAY_TEXT: Record<(typeof DAYS)[number], Bi> = {
  sunTueThu: { en: "Sun, Tue, Thu", ar: "الأحد، الثلاثاء، الخميس" },
  sunThu: { en: "Sun–Thu", ar: "الأحد–الخميس" },
  satWed: { en: "Sat–Wed", ar: "السبت–الأربعاء" },
  monWed: { en: "Mon, Wed", ar: "الاثنين، الأربعاء" },
}
const HOURS = ["16:00–22:00", "08:00–16:00", "14:00–22:00", "08:00–14:00"]
const ROLE_TEXT: Record<(typeof ROLES)[number], Bi> = {
  specialist: { en: "Specialist", ar: "أخصائي" },
  consultant: { en: "Consultant", ar: "استشاري" },
  resident: { en: "Resident", ar: "طبيب مقيم" },
}

/** Overlay · Add doctor (dialog / mobile sheet): Doctor* · Role | Room · Days | Hours → toast "Doctor added". */
function AddDoctorDialog({ clinic: c, open, onOpenChange }: { clinic: Clinic; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("clinics.addDoctor")
  const { b, locale } = useClinicText()
  const all = useClinics()
  const taken = new Set(all.flatMap((x) => x.doctors.map((d) => d.name.en)))
  const pool = CANDIDATES.filter((x) => !taken.has(x.name.en))
  const freeRoom = c.rooms.find((r) => r.status === "free")?.number ?? c.rooms[0]?.number ?? ""
  const [doctor, setDoctor] = React.useState(pool[0]?.name.en ?? "")
  const [role, setRole] = React.useState<(typeof ROLES)[number]>("specialist")
  const [room, setRoom] = React.useState(freeRoom)
  const [days, setDays] = React.useState<(typeof DAYS)[number]>("sunTueThu")
  const [hours, setHours] = React.useState(HOURS[0])

  const pick = pool.find((x) => x.name.en === doctor)
  const confirm = () => {
    if (!pick) return
    const d: ClinicDoctor = {
      initials: pick.initials,
      name: pick.name,
      role: ROLE_TEXT[role],
      days: DAY_TEXT[days],
      hours,
      today: { tone: "neutral", label: { en: "Starts tomorrow", ar: "يبدأ بكرة" } },
      month: 0,
      rating: "—",
    }
    updateClinic(c.key, (x) => ({ doctors: [...x.doctors, d], doctorCount: x.doctors.length + 1 }))
    onOpenChange(false)
    toast.success(t("toast"), { description: t("toastText", { name: b(pick.name) }) })
  }
  const name = b(c.name)
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title", { clinic: locale === "ar" ? arFor(name) : name })}
      description={t("text")}
      icon="people"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={confirm} disabled={!pick}>
          {t("confirm")}
        </Button>
      }
    >
      {pool.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noneLeft")}</p>
      ) : (
        <>
          <Field label={t("doctor")} required>
            {(p) => (
              <Select value={doctor} onValueChange={setDoctor}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pool.map((x) => (
                    <SelectItem key={x.name.en} value={x.name.en}>
                      {b(x.name)} · {b(x.specialty)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <div className="grid gap-4 md:grid-cols-2 md:gap-3">
            <Field label={t("role")}>
              {(p) => (
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger {...p} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`roles.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={t("room")}>
              {(p) => (
                <Select value={room || "none"} onValueChange={(v) => setRoom(v === "none" ? "" : v)}>
                  <SelectTrigger {...p} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {c.rooms.map((r) => (
                      <SelectItem key={r.number} value={r.number}>
                        {t("roomValue", { n: r.number })}
                      </SelectItem>
                    ))}
                    <SelectItem value="none">{t("noRoom")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={t("days")}>
              {(p) => (
                <Select value={days} onValueChange={(v) => setDays(v as typeof days)}>
                  <SelectTrigger {...p} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {t(`dayOptions.${d}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={t("hours")}>
              {(p) => (
                <Select value={hours} onValueChange={setHours}>
                  <SelectTrigger {...p} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={h}>
                        <bdi dir="ltr">{h}</bdi>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
        </>
      )}
    </ResponsiveDialog>
  )
}
