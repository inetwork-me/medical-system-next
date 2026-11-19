"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import type { Bi } from "@/lib/mock/bi"
import { Icon } from "@/components/ds/icon"
import { Field } from "@/components/ds/field"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ClinicPage, useCurrentClinic } from "./clinic/frame"
import type { Clinic, Room, RoomStatus } from "./data"
import { ClinicsFrame } from "./frame"
import { clinicHref } from "./href"
import { updateClinic, useClinics } from "./store"
import { useClinicText } from "./text"

/** Room state colours (brief §5): in use = primary/accent, free = success-soft, cleaning = warning-soft, closed = muted. */
export const ROOM_TILE: Record<RoomStatus, string> = {
  inUse: "bg-accent text-primary",
  free: "bg-success-soft text-success-soft-foreground",
  cleaning: "bg-warning-soft text-warning-soft-foreground",
  closed: "bg-muted text-muted-foreground",
}
const ROOM_TONE: Record<RoomStatus, StatusTone> = { inUse: "info", free: "success", cleaning: "warning", closed: "neutral" }
const SWATCH: Record<RoomStatus, string> = { inUse: "bg-primary", free: "bg-success", cleaning: "bg-warning", closed: "bg-muted-foreground" }
const STATES: RoomStatus[] = ["inUse", "free", "cleaning", "closed"]

/* ================================================================== clinic page · Rooms */

/** Clinic page · Rooms: Widget / Clinic Rooms — room cards (2 per row when wide, 1 on mobile) with status and equipment chips; Add room. */
export function ClinicRoomsPage() {
  const c = useCurrentClinic()
  const t = useTranslations("clinics.rooms")
  const [adding, setAdding] = React.useState(false)
  return (
    <ClinicPage>
      <Widget
        title={t("title")}
        description={t("text", { n: c.rooms.length })}
        className="gap-4 p-4 md:p-5"
        action={
          <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={() => setAdding(true)}>
            <Icon name="add" size={16} />
            {t("add")}
          </Button>
        }
      >
        {c.rooms.length === 0 ? (
          <EmptyState icon="hospital" title={t("empty")} description={t("emptyText")} className="py-10" />
        ) : (
          <ul className="grid grid-cols-1 gap-4 @xl/widget:grid-cols-2">
            {c.rooms.map((r) => (
              <RoomCard key={r.number} room={r} />
            ))}
          </ul>
        )}
      </Widget>
      {adding && <AddRoomDialog clinic={c} onOpenChange={setAdding} />}
    </ClinicPage>
  )
}

function RoomCard({ room: r }: { room: Room }) {
  const t = useTranslations("clinics.rooms")
  const { b } = useClinicText()
  const line =
    r.status === "inUse"
      ? r.occupant
        ? t("since", { who: b(r.occupant), time: r.since ?? "" })
        : t("inUseSince", { time: r.since ?? "" })
      : r.status === "free"
        ? t("ready")
        : r.status === "cleaning"
          ? t("readyIn", { n: r.readyIn ?? 5 })
          : t("closedText")
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg text-sm font-medium tabular-nums", ROOM_TILE[r.status])}>{r.number}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{b(r.type)}</span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">{line}</span>
        </div>
        <StatusBadge tone={ROOM_TONE[r.status]}>{t(`status.${r.status}`)}</StatusBadge>
      </div>
      {r.equipment.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {r.equipment.map((e) => (
            <li key={e.en} className="inline-flex h-6 items-center rounded-full border bg-card px-2.5 text-xs font-medium">
              {b(e)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/* ================================================================== module tab · Rooms board */

/** Clinics · Rooms (module tab): Widget / Rooms Board — legend, then every clinic's rooms by floor; a tile opens that clinic's Rooms tab. */
export function RoomsBoardPage() {
  const t = useTranslations("clinics.board")
  const tr = useTranslations("clinics.rooms")
  const clinics = useClinics()
  const rooms = clinics.flatMap((c) => c.rooms.map((r) => ({ c, r })))
  const floors = [...new Set(rooms.map(({ r }) => Number(r.number[0])))].sort()
  const name = (c: Clinic) => (t.has(`names.${c.key}` as "names.peds") ? t(`names.${c.key}` as "names.peds") : null)
  const { b } = useClinicText()
  return (
    <ClinicsFrame>
      <Widget title={t("title")} description={t("text")} className="gap-4 p-4 md:p-5">
        <ul className="flex flex-wrap gap-x-3.5 gap-y-2" aria-label={t("legend")}>
          {STATES.map((s) => (
            <li key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2.5 rounded-[3px]", SWATCH[s])} aria-hidden />
              {tr(`status.${s}`)}
            </li>
          ))}
        </ul>
        {floors.map((f) => (
          <section key={f} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium">{t("floor", { n: f })}</h3>
            <ul className="flex flex-wrap gap-2">
              {rooms
                .filter(({ r }) => Number(r.number[0]) === f)
                .sort((x, y) => x.r.number.localeCompare(y.r.number))
                .map(({ c, r }) => {
                  const clinic = name(c) ?? b(c.short)
                  return (
                    <li key={r.number}>
                      <Link
                        href={clinicHref(c.key, "rooms")}
                        aria-label={t("open", { n: r.number, clinic, status: tr(`status.${r.status}`) })}
                        className={cn(
                          "flex w-18 flex-col gap-0.5 rounded-lg p-2.5 outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50 @xl/widget:w-24",
                          ROOM_TILE[r.status]
                        )}
                      >
                        <span className="text-sm font-medium tabular-nums">{r.number}</span>
                        <span className="text-xs break-words">{clinic}</span>
                      </Link>
                    </li>
                  )
                })}
            </ul>
          </section>
        ))}
      </Widget>
    </ClinicsFrame>
  )
}

/* ================================================================== Add room */

const TYPES: Record<string, Bi> = {
  consultation: { en: "Consultation", ar: "كشف" },
  procedures: { en: "Procedures", ar: "إجراءات" },
  vaccination: { en: "Vaccination", ar: "تطعيمات" },
  dental: { en: "Dental chair", ar: "كرسي أسنان" },
  eye: { en: "Eye exam", ar: "فحص عيون" },
}

/** Overlay · Add room: Room number* | Type · Equipment (comma separated) → toast "Room 105 added". */
function AddRoomDialog({ clinic: c, onOpenChange }: { clinic: Clinic; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("clinics.addRoom")
  const clinics = useClinics()
  const taken = new Set(clinics.flatMap((x) => x.rooms.map((r) => r.number)))
  const suggest = (() => {
    const mine = c.rooms.map((r) => Number(r.number)).filter(Boolean)
    let n = mine.length ? Math.max(...mine) + 1 : c.floor * 100 + 1
    while (taken.has(String(n))) n++
    return String(n)
  })()
  const [number, setNumber] = React.useState(suggest)
  const [type, setType] = React.useState("consultation")
  const [equipment, setEquipment] = React.useState("")
  const [tried, setTried] = React.useState(false)
  const n = number.trim()
  const error = tried && !n ? t("required") : n && taken.has(n) ? t("taken", { n }) : undefined
  const confirm = () => {
    setTried(true)
    if (!n || taken.has(n)) return
    const items = equipment
      .split(/[,،]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => ({ en: x, ar: x }))
    const room: Room = { number: n, type: TYPES[type], status: "free", equipment: items }
    updateClinic(c.key, (x) => ({ rooms: [...x.rooms, room], roomCount: x.rooms.length + 1 }))
    onOpenChange(false)
    toast.success(t("toast", { n }), { description: t("toastText") })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="add"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={confirm}>{t("confirm")}</Button>}
    >
      <div className="grid gap-4 md:grid-cols-2 md:gap-3">
        <Field label={t("number")} required error={error}>
          <Input inputMode="numeric" dir="ltr" value={number} onChange={(e) => setNumber(e.target.value.replace(/[^\dA-Za-z-]/g, ""))} />
        </Field>
        <Field label={t("type")}>
          {(p) => (
            <Select value={type} onValueChange={setType}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(TYPES).map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`types.${k}` as "types.consultation")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <Field label={t("equipment")}>
        <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder={t("equipmentPh")} />
      </Field>
    </ResponsiveDialog>
  )
}
