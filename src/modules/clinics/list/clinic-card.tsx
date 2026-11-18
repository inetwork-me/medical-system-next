"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { StatusBadge } from "@/components/ds/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { LONG_WAIT, type Clinic } from "../data"
import { clinicHref } from "../href"
import { ClinicTile, StatBox } from "../parts"
import { STATUS_TONE, useClinicText } from "../text"

/**
 * Widget / Clinic Card (Clinics list): tile · name over "Floor · Wing" · ⋯; status badge; "Seen today" n / booked with a
 * 6px bar; Waiting / Avg wait / Doctors boxes (avg wait > 20 min in warning text); head of clinic + Open. A paused
 * clinic shows its note instead of today's figures. p-5 gap-4, rounded-xl.
 */
export function ClinicCard({ clinic: c }: { clinic: Clinic }) {
  const { t, b, min, place, status } = useClinicText()
  const href = clinicHref(c.key)
  const paused = c.status === "paused"
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5" aria-label={b(c.name)}>
      <div className="flex items-center gap-3">
        <ClinicTile icon={c.icon} tone={c.tone} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-lg leading-6 font-semibold text-foreground">
            <Link href={href} className="rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {b(c.name)}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted-foreground">{place(c)}</p>
        </div>
        <ActionMenu
          title={b(c.name)}
          align="end"
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={t("clinicMenu")} className="self-start">
              <Icon name="more" size={16} />
            </Button>
          }
          groups={[
            [
              { key: "open", icon: "arrow-right-1", label: t("menu.open"), href },
              { key: "settings", icon: "setting-2", label: t("menu.settings"), href: clinicHref(c.key, "settings") },
            ],
          ]}
        />
      </div>

      <StatusBadge tone={STATUS_TONE[c.status]}>{status(c)}</StatusBadge>

      {paused ? (
        c.pauseNote && <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">{b(c.pauseNote)}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{t("card.seenToday")}</span>
              <span className="font-medium text-foreground tabular-nums" dir="ltr">
                {c.today.seen} / {c.today.booked}
              </span>
            </div>
            <Progress
              value={c.today.booked ? (c.today.seen / c.today.booked) * 100 : 0}
              className="h-1.5"
              aria-label={t("card.seenToday")}
            />
          </div>
          <div className="flex gap-2">
            <StatBox label={t("card.waiting")} value={c.today.waiting} />
            <StatBox
              label={t("card.avgWait")}
              value={min(c.today.avgWait)}
              valueClassName={cn(c.today.avgWait > LONG_WAIT && "text-warning-soft-foreground")}
            />
            <StatBox label={t("card.doctors")} value={c.doctorCount} />
          </div>
        </>
      )}

      <div className="mt-auto flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback>{c.headInitials}</AvatarFallback>
          </Avatar>
          <span className="truncate text-xs text-muted-foreground">{b(c.head)}</span>
        </div>
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
