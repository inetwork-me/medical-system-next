"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { isModuleEnabled } from "@/lib/modules"
import { saveBlob, stamp, xlsxBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { PageTitle } from "@/components/shell/page-title"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { patientHref } from "@/modules/patients/href"
import { LAB_NOW, analyteOf, minsBetween, testOf, timeOf, type LabOrder } from "./data"
import { dayCounts } from "./counts"
import { LabFrame } from "./frame"
import { orderHref } from "./href"
import { flagCounts, statusOf, uncalledCriticals, valueText } from "./machine"
import { CriticalCallDialog } from "./order/call-dialog"
import { LabChip, Latin, ltrRun } from "./parts"
import { LabCard } from "./samples"
import { labCan } from "./roles"
import { useLabOrders, useLabRole } from "./store"
import { useLabText } from "./text"

/** Waiting time turns red past an hour. */
const LATE_MIN = 60

/** Orders waiting for the pathologist: the newest result time among their submitted panels. */
const resultedOf = (o: LabOrder) =>
  o.panels
    .filter((p) => p.state === "validate" && p.resultedAt)
    .map((p) => p.resultedAt!)
    .sort()
    .at(-1) ?? o.createdAt

/** Uncalled criticals first, then by order number (the design's row order). */
export function validationQueue(orders: LabOrder[]) {
  return orders
    .filter((o) => statusOf(o) === "validate")
    .sort((a, z) => Number(uncalledCriticals(z).length > 0) - Number(uncalledCriticals(a).length > 0) || z.no.localeCompare(a.no))
}

function useWait() {
  const t = useTranslations("labs.results")
  return (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h === 0 ? t("mins", { n: m }) : m === 0 ? t("hoursOnly", { h }) : t("hours", { h, m })
  }
}

/** Flags summary badge: "1 critical · 3 high" (destructive), any high/low (warning), Normal (success). */
function useFlags() {
  const t = useTranslations("labs.results.flags")
  return (o: LabOrder): { text: string; tone: StatusTone } => {
    const c = flagCounts(o)
    const parts = [c.C && t("critical", { n: c.C }), c.H && t("high", { n: c.H }), c.L && t("low", { n: c.L })].filter(Boolean) as string[]
    return { text: parts.length ? parts.join(" · ") : t("normal"), tone: c.C ? "destructive" : c.H || c.L ? "warning" : "success" }
  }
}

/**
 * Widget / Lab Validation Queue: the critical alert strip (until every critical value is called in; Log call), then
 * "Waiting for validation" — wide table Order · Patient · Tests · Flags · Resulted · Waiting (red past 60 min) · Review,
 * or compact cards (name, "LAB-no · waiting …", flags, chevron). Wide from a 896px container.
 */
export function ValidationQueue({ onLogCall }: { onLogCall: (no: string) => void }) {
  const t = useTranslations("labs.results")
  const { b, doctorName } = useLabText()
  const role = useLabRole()
  const orders = useLabOrders()
  const rows = validationQueue(orders)
  const total = dayCounts(orders).validate
  const wait = useWait()
  const flags = useFlags()
  const crit = orders.flatMap((o) => uncalledCriticals(o).map((c) => ({ o, c }))).sort((a, z) => a.c.deadline.localeCompare(z.c.deadline))
  const first = crit[0]
  const th = "h-10 px-1.5 text-start text-xs font-medium text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-1.5 py-2.5 align-middle first:ps-4 last:pe-4"

  return (
    <div className="@container/vq flex min-w-0 flex-col gap-4">
      {first && (
        <div className="flex flex-col gap-3">
          <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-destructive-soft px-4 py-3 text-destructive-soft-foreground @4xl/vq:items-center">
            <Icon name="danger" size={20} className="shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium">{t("alert", { n: crit.length })}</span>
              <span className="text-xs">
                <bdi>
                  {t("alertLine", {
                    analyte: b(analyteOf(first.c.result.analyte)!.name),
                    value: ltrRun(valueText(first.c.result.analyte, first.c.result.value)),
                    patient: b(first.o.patient.name),
                    doctor: doctorName(first.o.doctorId),
                    time: timeOf(first.c.deadline),
                  })}
                </bdi>
              </span>
            </div>
            {labCan(role, "logCall") && (
              <Button variant="destructive" size="sm" className="hidden @4xl/vq:inline-flex" onClick={() => onLogCall(first.o.no)}>
                <Icon name="call-calling" size={24} />
                {t("logCall")}
              </Button>
            )}
          </div>
          {labCan(role, "logCall") && (
            <Button variant="destructive" className="w-full @4xl/vq:hidden" onClick={() => onLogCall(first.o.no)}>
              <Icon name="call-calling" size={24} />
              {t("logCall")}
            </Button>
          )}
        </div>
      )}

      <LabCard title={t("title")} text={t("text", { n: total })}>
        {rows.length === 0 ? (
          <p className="flex flex-col items-center gap-1 py-6 text-center">
            <span className="text-sm font-medium">{t("empty")}</span>
            <span className="text-xs text-muted-foreground">{t("emptyText")}</span>
          </p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-lg border @4xl/vq:block">
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[108px]" />
                  <col />
                  <col className="w-[242px]" />
                  <col className="w-[182px]" />
                  <col className="w-[92px]" />
                  <col className="w-[122px]" />
                  <col className="w-[110px]" />
                </colgroup>
                <thead className="bg-muted">
                  <tr>
                    {(["order", "patient", "tests", "flags", "resulted", "waiting"] as const).map((k) => (
                      <th key={k} className={th}>
                        {t(`col.${k}`)}
                      </th>
                    ))}
                    <th className={th}>
                      <span className="sr-only">{t("review")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o, i) => {
                    const w = minsBetween(resultedOf(o), LAB_NOW)
                    const f = flags(o)
                    return (
                      <tr key={o.no} className="border-t">
                        <td className={cn(td, "text-xs font-medium")}>
                          <Latin>{o.no}</Latin>
                        </td>
                        <td className={td}>
                          <Who o={o} />
                        </td>
                        <td className={td}>
                          <div className="flex items-center gap-1 overflow-hidden">
                            {o.tests.slice(0, 3).map((k) => (
                              <LabChip key={k} className="h-6">
                                {b(testOf(k)?.name ?? { en: k, ar: k })}
                              </LabChip>
                            ))}
                          </div>
                        </td>
                        <td className={td}>
                          <StatusBadge tone={f.tone}>{f.text}</StatusBadge>
                        </td>
                        <td className={cn(td, "tabular-nums")}>{timeOf(resultedOf(o))}</td>
                        <td className={cn(td, "tabular-nums", w > LATE_MIN ? "text-destructive" : "text-foreground")}>{wait(w)}</td>
                        <td className={cn(td, "text-end")}>
                          <Button size="sm" variant={i === 0 ? "default" : "outline"} asChild>
                            <Link href={orderHref(o.no)}>{t("review")}</Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col @4xl/vq:hidden">
              {rows.map((o) => {
                const f = flags(o)
                return (
                  <li key={o.no} className="flex items-start gap-2.5 border-b py-3 last:border-b-0">
                    <Avatar size="sm">
                      <AvatarFallback>{o.patient.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">{b(o.patient.name)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        <bdi>{t("cardLine", { no: ltrRun(o.no), wait: wait(minsBetween(resultedOf(o), LAB_NOW)) })}</bdi>
                      </span>
                      <StatusBadge tone={f.tone}>{f.text}</StatusBadge>
                    </div>
                    <Button variant="ghost" size="icon-sm" asChild>
                      <Link href={orderHref(o.no)} aria-label={t("openOrder", { no: o.no })}>
                        <Icon name="arrow-right-1" size={24} />
                      </Link>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </LabCard>
    </div>
  )
}

function Who({ o }: { o: LabOrder }) {
  const { b } = useLabText()
  const linked = o.patient.patientId && isModuleEnabled("patients")
  const name = <span className="truncate text-sm font-medium text-foreground">{b(o.patient.name)}</span>
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar size="sm">
        <AvatarFallback>{o.patient.initials}</AvatarFallback>
      </Avatar>
      {linked ? (
        <Link href={patientHref(o.patient.patientId!)} className="min-w-0 truncate rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {name}
        </Link>
      ) : (
        name
      )}
    </div>
  )
}

/** Lab · Results to validate (module tab): Export; the validation queue; Log call opens Log critical call. */
export function ResultsToValidate() {
  const t = useTranslations("labs.results")
  const tn = useTranslations("shell.nav")
  const { b, ar } = useLabText()
  const wait = useWait()
  const flags = useFlags()
  const orders = useLabOrders()
  const [calling, setCalling] = React.useState<string | null>(null)
  const exportList = () => {
    const file = `lab-validation-${stamp()}.xlsx`
    const head = (["order", "patient", "tests", "flags", "resulted", "waiting"] as const).map((k) => t(`col.${k}`))
    const body = validationQueue(orders).map((o) => [
      o.no,
      `${b(o.patient.name)} · ${o.patient.mrn}`,
      o.tests.map((k) => b(testOf(k)?.name ?? { en: k, ar: k })).join(", "),
      flags(o).text,
      timeOf(resultedOf(o)),
      wait(minsBetween(resultedOf(o), LAB_NOW)),
    ])
    saveBlob(xlsxBlob(head, body, { sheet: t("title"), rtl: ar }), file)
    toast.success(t("exported"), { description: file })
  }
  return (
    <LabFrame
      actions={
        <Button variant="outline" onClick={exportList}>
          <Icon name="export" size={24} />
          {t("export")}
        </Button>
      }
    >
      <PageTitle title={t("pageTitle")} crumbs={[{ label: tn("lab"), href: "/lab" }]} />
      <ValidationQueue onLogCall={setCalling} />
      {calling && <CriticalCallDialog orderNo={calling} onOpenChange={(o) => !o && setCalling(null)} />}
    </LabFrame>
  )
}
