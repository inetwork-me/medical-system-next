"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { IfModule } from "@/lib/modules"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { StatusBadge } from "@/components/ds/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { StatBox } from "@/modules/clinics/parts"
import { cardAlert, credStatus, isAway, isBlocked, type Doctor } from "../data"
import { bookHref, doctorHref } from "../href"
import { STATUS_TONE, useDoctorText } from "../text"

/**
 * Widget / Doctor Card (Doctors list): avatar · name over title · ⋯; status badge + "Clinic · Room"; "Patients today"
 * seen / booked with a 6px bar (warning while running late) — or, when off / on leave, who has their patients; Next free /
 * Rating / This month boxes; the most urgent credential alert (expired = destructive, ≤ 45 days = warning); Book + Open.
 * p-5 gap-4, rounded-xl. An expired required credential blocks booking.
 */
export function DoctorCard({ doctor: d }: { doctor: Doctor }) {
  const { t, b, place, nextFree, credAlert } = useDoctorText()
  const href = doctorHref(d.key)
  const alert = cardAlert(d)
  const expired = alert && credStatus(alert) === "expired"
  const blocked = isBlocked(d)
  const alertId = `doctor-${d.key}-alert`
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5" aria-label={b(d.name)}>
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback>{d.initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-lg leading-6 font-semibold text-foreground">
            <Link href={href} className="rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {b(d.name)}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted-foreground">{b(d.title)}</p>
        </div>
        <ActionMenu
          title={b(d.name)}
          align="end"
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={t("doctorMenu")} className="self-start">
              <Icon name="more" size={16} />
            </Button>
          }
          groups={[
            [
              { key: "open", icon: "arrow-right-1", label: t("menu.open"), href },
              { key: "schedule", icon: "calendar-2", label: t("menu.schedule"), href: doctorHref(d.key, "schedule") },
              { key: "settings", icon: "setting-2", label: t("menu.settings"), href: doctorHref(d.key, "settings") },
            ],
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <StatusBadge tone={STATUS_TONE[d.status]}>{b(d.statusLabel)}</StatusBadge>
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="hospital" size={14} className="shrink-0" />
          <span className="truncate">{place(d)}</span>
        </span>
      </div>

      {isAway(d) ? (
        d.awayNote && <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">{b(d.awayNote)}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{t("card.patientsToday")}</span>
            <span className="font-medium text-foreground tabular-nums" dir="ltr">
              {d.today.seen} / {d.today.booked}
            </span>
          </div>
          <Progress
            value={d.today.booked ? Math.max(2, (d.today.seen / d.today.booked) * 100) : 0}
            tone={d.status === "late" ? "warning" : "default"}
            className="h-1.5"
            aria-label={t("card.patientsToday")}
          />
        </div>
      )}

      <div className="flex gap-2">
        <StatBox label={t("card.nextFree")} value={<bdi>{nextFree(d)}</bdi>} />
        <StatBox label={t("card.rating")} value={<bdi dir="ltr">★ {d.month.rating}</bdi>} />
        <StatBox label={t("card.thisMonth")} value={d.month.visits} />
      </div>

      {alert && (
        <p
          id={alertId}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium",
            expired ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-warning-soft text-warning-soft-foreground"
          )}
        >
          <Icon name={expired ? "danger" : "shield-tick"} size={16} className="shrink-0" />
          <span className="min-w-0">{credAlert(alert)}</span>
        </p>
      )}

      <div className="mt-auto flex items-center justify-end gap-2">
        <IfModule id="appointments">
          {blocked ? (
            <Button variant="outline" size="sm" disabled aria-describedby={alertId} title={t("cred.blocked")}>
              <Icon name="calendar-add" size={16} />
              {t("book")}
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href={bookHref(d.key)}>
                <Icon name="calendar-add" size={16} />
                {t("book")}
              </Link>
            </Button>
          )}
        </IfModule>
        <Button variant="outline" size="sm" asChild>
          <Link href={href}>
            {t("open")}
            <Icon name="arrow-right-1" size={16} />
          </Link>
        </Button>
      </div>
    </article>
  )
}
