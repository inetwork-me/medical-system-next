"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { saveBlob, stamp, xlsxBlob } from "@/lib/export/files"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { RENEWAL_WINDOW, credBucket, credStatus, daysUntil, type CredBucket, type Credential, type CredentialType, type Doctor } from "./data"
import { DoctorsFrame } from "./frame"
import { DoctorName } from "./link"
import { RenewDialog } from "./renew-dialog"
import { useDoctors } from "./store"
import { ltr, useDoctorText } from "./text"

type Row = { d: Doctor; c: Credential }
const TILES: { k: CredBucket; icon: IconName; tile: string }[] = [
  { k: "expired", icon: "danger", tile: "bg-destructive-soft text-destructive-soft-foreground" },
  { k: "d30", icon: "timer-1", tile: "bg-warning-soft text-warning-soft-foreground" },
  { k: "d60", icon: "calendar-2", tile: "bg-info-soft text-info-soft-foreground" },
  { k: "valid", icon: "shield-tick", tile: "bg-success-soft text-success-soft-foreground" },
]
/** Board status tone: expired → destructive, ≤ 45 days → warning, ≤ 60 → info, later → success. */
const toneOf = (c: Credential) => {
  const s = credStatus(c)
  return s === "expired" ? "destructive" : s === "due" ? "warning" : s === "soon" ? "info" : "success"
}

/**
 * Doctors · Credentials (module tab): 4 summary tiles (Expired · Within 30 days · Within 60 days · Valid; captions when
 * wide), then Widget / Credentials Board — "Renewals due" for the next 120 days sorted by expiry: table when wide
 * (doctor, credential, expiry, status, Remind + Renew for anything due), rows with Renew otherwise. Remind all in the
 * card header; Export in the tabs row.
 */
export function CredentialsBoard() {
  const t = useTranslations("doctors.board")
  const tn = useTranslations("doctors.creds.name")
  const { b, dates, locale } = useDoctorText()
  const doctors = useDoctors().filter((d) => d.active)
  const [renewing, setRenewing] = React.useState<{ doctor: string; type: CredentialType } | null>(null)
  const all: Row[] = doctors.flatMap((d) => d.credentials.map((c) => ({ d, c })))
  const count = (k: CredBucket) => all.filter((r) => credBucket(r.c) === k).length
  const rows = all.filter((r) => daysUntil(r.c.expires) <= RENEWAL_WINDOW).sort((a, z) => a.c.expires.localeCompare(z.c.expires))
  const due = rows.filter((r) => credStatus(r.c) !== "valid")
  const status = (c: Credential) => {
    const n = daysUntil(c.expires)
    return n < 0 ? t("expiredAgo", { n: -n }) : t("left", { n })
  }
  const caption = (k: CredBucket) =>
    k === "expired" ? t("cap.expired", { n: new Set(all.filter((r) => credBucket(r.c) === "expired").map((r) => r.d.key)).size }) : k === "valid" ? t("cap.valid", { n: doctors.length }) : t(`cap.${k}`)

  const remind = () => toast.success(t("reminded"), { description: t("remindedText") })
  const remindAll = () => toast.success(t("remindedAll"), { description: t("remindedAllText", { n: new Set(due.map((r) => r.d.key)).size }) })
  const exportList = () => {
    const file = `credentials-${stamp()}.xlsx`
    const head = [t("col.doctor"), t("col.credential"), t("col.expires"), t("col.status")]
    const body = rows.map((r) => [b(r.d.name), tn(r.c.type), dates.short(r.c.expires), status(r.c)])
    saveBlob(xlsxBlob(head, body, { sheet: t("sheet"), rtl: locale === "ar" }), file)
    toast.success(t("exported"), { description: t("exportedText", { file }) })
  }
  const who = (d: Doctor) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar size="sm">
        <AvatarFallback>{d.initials}</AvatarFallback>
      </Avatar>
      <DoctorName en={d.name.en} className="truncate text-sm font-medium">
        {b(d.name)}
      </DoctorName>
    </div>
  )
  const renewBtn = (r: Row) => (
    <Button variant="outline" size="sm" onClick={() => setRenewing({ doctor: r.d.key, type: r.c.type })}>
      {t("renew")}
    </Button>
  )

  return (
    <DoctorsFrame
      actions={
        <Button variant="outline" onClick={exportList}>
          <Icon name="export" size={24} />
          {t("export")}
        </Button>
      }
    >
      <div className="@container/tiles">
        <div className="grid grid-cols-2 gap-3 @3xl/tiles:grid-cols-4 @3xl/tiles:gap-4">
          {TILES.map((x) => (
            <div key={x.k} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 @5xl/tiles:flex-row @5xl/tiles:items-center @5xl/tiles:gap-3">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", x.tile)}>
                <Icon name={x.icon} size={20} />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{t(`tile.${x.k}`)}</span>
                <span className="text-lg font-semibold tabular-nums">{count(x.k)}</span>
                <span className="hidden truncate text-xs text-muted-foreground @5xl/tiles:block">{caption(x.k)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Widget
        title={t("title")}
        description={t("text", { n: RENEWAL_WINDOW })}
        className="gap-4 p-4 md:p-5"
        action={
          due.length > 0 && (
            <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={remindAll}>
              <Icon name="sms" size={16} />
              {t("remindAll")}
            </Button>
          )
        }
      >
        {rows.length === 0 ? (
          <EmptyState icon="shield-tick" title={t("empty", { n: RENEWAL_WINDOW })} className="py-10" />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-lg border @4xl/widget:block">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr className="h-10">
                    <th scope="col" className="ps-4 text-start font-medium">{t("col.doctor")}</th>
                    <th scope="col" className="w-52 px-3 text-start font-medium">{t("col.credential")}</th>
                    <th scope="col" className="w-33 px-3 text-start font-medium">{t("col.expires")}</th>
                    <th scope="col" className="w-44 px-3 text-start font-medium">{t("col.status")}</th>
                    <th scope="col" className="w-48 pe-4">
                      <span className="sr-only">{t("renew")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.d.key + r.c.type} className="h-13">
                      <td className="ps-4">{who(r.d)}</td>
                      <td className="px-3">
                        <bdi>{tn(r.c.type)}</bdi>
                      </td>
                      <td className="px-3 tabular-nums">{dates.short(r.c.expires)}</td>
                      <td className="px-3">
                        <StatusBadge tone={toneOf(r.c)}>{status(r.c)}</StatusBadge>
                      </td>
                      <td className="pe-4">
                        {credStatus(r.c) !== "valid" && (
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={remind}>
                              <Icon name="sms" size={16} />
                              {t("remind")}
                            </Button>
                            {renewBtn(r)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col divide-y @4xl/widget:hidden">
              {rows.map((r) => (
                <li key={r.d.key + r.c.type} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start gap-2.5">
                    <Avatar size="sm">
                      <AvatarFallback>{r.d.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <DoctorName en={r.d.name.en} className="text-sm font-medium">
                        {b(r.d.name)}
                      </DoctorName>
                      <span className="text-xs text-muted-foreground tabular-nums">{ltr(t("line", { credential: tn(r.c.type), date: dates.short(r.c.expires) }))}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge tone={toneOf(r.c)}>{status(r.c)}</StatusBadge>
                    {credStatus(r.c) !== "valid" && renewBtn(r)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Widget>
      {renewing && <RenewDialog doctorKey={renewing.doctor} type={renewing.type} onOpenChange={(o) => !o && setRenewing(null)} />}
    </DoctorsFrame>
  )
}
