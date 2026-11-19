"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Icon } from "@/components/ds/icon"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import {
  COLLECTION_ROOMS,
  LAB_NOW,
  ORDER_OF_DRAW,
  OTHER_REJECTIONS,
  OTHER_SAMPLES,
  TUBES,
  barcodeOf,
  minsBetween,
  timeOf,
  type LabOrder,
  type Tube,
  type TubeState,
} from "./data"
import { CollectDialog } from "./collect-dialog"
import { ReceiveDialog } from "./receive-dialog"
import { LabFrame } from "./frame"
import { tubesToCollect } from "./machine"
import { Latin, PriorityChip, TubeDot, TubeLabel } from "./parts"
import { labCan } from "./roles"
import { useLabOrders, useLabRole } from "./store"
import { useLabText } from "./text"

const PRINTER = "Lab-2"

/* ------------------------------------------------------------------ shared card */

/** Widget card: title 18 SemiBold + 12 muted line, optional ghost action at the end; p-5 (p-4 on compact). */
export function LabCard({
  title,
  text,
  action,
  className,
  children,
}: {
  title: React.ReactNode
  text?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 md:p-5", className)}>
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={id} className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          {text && <p className="text-xs text-muted-foreground tabular-nums">{text}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ queue */

/** Orders waiting at collection: they have a ticket and tubes still to collect, in ticket order. */
export const collectionQueue = (orders: LabOrder[]) =>
  orders.filter((o) => o.ticket && tubesToCollect(o).length).sort((a, z) => a.ticket!.localeCompare(z.ticket!, undefined, { numeric: true }))

/**
 * Widget / Lab Collection Queue: ticket (STAT in destructive soft), patient + STAT chip, "LAB-no · tests" (or
 * "recollect, reason"), tubes needed as dots with names, waiting time (red for STAT), Collect (the first one primary).
 * Wide from a 512px container: waiting time in its own column; compact: under the tubes. Call next: patient-called toast.
 */
export function CollectionQueue({ onCollect }: { onCollect: (no: string) => void }) {
  const t = useTranslations("labs.samples.queue")
  const tw = useTranslations("labs.worklist.line")
  const { b, ar, short, list, t: tl } = useLabText()
  const role = useLabRole()
  const queue = collectionQueue(useLabOrders())
  const rooms = ar ? COLLECTION_ROOMS.join(" و ") : `${COLLECTION_ROOMS.slice(0, -1).join(", ")} and ${COLLECTION_ROOMS.at(-1)}`

  const callNext = () => {
    const o = queue[0]
    if (!o) return
    toast.success(t("called", { name: b(o.patient.name) }), { description: t("calledText", { ticket: o.ticket!, room: COLLECTION_ROOMS[0] }) })
  }
  const lineOf = (o: LabOrder) => {
    const rej = o.tubes.find((x) => x.rejection)?.rejection
    const recollect = tubesToCollect(o).some((x) => x.recollectOf !== undefined)
    if (recollect && rej) return t("recollect", { no: o.no, reason: tl(`reject.${rej.reason}`).toLowerCase() })
    return t("line", { no: o.no, tests: list(o.tests.map(short)) })
  }

  return (
    <LabCard
      title={t("title")}
      text={t("text", { n: queue.length, rooms })}
      action={
        labCan(role, "collect") && (
          <Button variant="ghost" size="sm" onClick={callNext} disabled={!queue.length}>
            <Icon name="call-calling" size={24} />
            {t("callNext")}
          </Button>
        )
      }
      className="@container/q"
    >
      {queue.length === 0 ? (
        <p className="flex flex-col items-center gap-1 py-6 text-center">
          <span className="text-sm font-medium">{t("empty")}</span>
          <span className="text-xs text-muted-foreground">{t("emptyText")}</span>
        </p>
      ) : (
        <ul className="flex flex-col">
          {queue.map((o, i) => {
            const stat = o.priority === "stat"
            const wait = minsBetween(o.queuedAt ?? o.createdAt, LAB_NOW)
            return (
              <li key={o.no} className="flex items-start gap-3 border-b py-3 last:border-b-0 @lg/q:items-center">
                <span
                  className={cn(
                    "flex h-9 w-13 shrink-0 items-center justify-center rounded-lg text-sm font-medium tabular-nums",
                    stat ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-muted text-foreground"
                  )}
                >
                  <Latin>{o.ticket}</Latin>
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{b(o.patient.name)}</span>
                    <PriorityChip priority={o.priority} statOnly />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    <bdi>{lineOf(o)}</bdi>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {tubesToCollect(o).map((x) => (
                      <TubeLabel key={x.no} tube={x.type} gap="gap-1" />
                    ))}
                  </span>
                  <span className={cn("text-xs @lg/q:hidden", stat ? "text-destructive" : "text-muted-foreground")}>{tw("collect", { n: wait, sex: o.patient.sex })}</span>
                </div>
                <div className="hidden w-20 shrink-0 flex-col @lg/q:flex">
                  <span className="text-xs text-muted-foreground">{t("waiting")}</span>
                  <span className={cn("text-sm font-medium tabular-nums", stat ? "text-destructive" : "text-foreground")}>{t("mins", { n: wait })}</span>
                </div>
                {labCan(role, "collect") && (
                  <Button size="sm" variant={i === 0 ? "default" : "outline"} onClick={() => onCollect(o.no)}>
                    {t("collect")}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </LabCard>
  )
}

/* ------------------------------------------------------------------ tracker */

const STATE_TONE: Record<Exclude<TubeState, "pending">, StatusTone> = {
  collected: "warning",
  received: "neutral",
  analyzer: "info",
  resulted: "success",
  rejected: "destructive",
}

type TrackRow = { o: LabOrder; tube: Tube }

/**
 * Tubes on the move today: every collected tube of an order that still has a tube in the lab (not all resulted), by
 * order number (newest first); rejected tubes at the end.
 */
export function trackedTubes(orders: LabOrder[]): TrackRow[] {
  const sorted = [...orders].sort((a, z) => z.no.localeCompare(a.no))
  const live = sorted.flatMap((o) =>
    o.tubes.some((x) => x.collectedAt && x.state !== "resulted" && x.state !== "rejected")
      ? o.tubes.filter((x) => x.collectedAt && x.state !== "rejected").map((tube) => ({ o, tube }))
      : []
  )
  const rejected = sorted.flatMap((o) => o.tubes.filter((x) => x.state === "rejected").map((tube) => ({ o, tube })))
  return [...live, ...rejected]
}

/** Today's sample counts: the sample orders plus the rest of the day. */
export function sampleCounts(orders: LabOrder[]) {
  const tubes = orders.flatMap((o) => o.tubes)
  return {
    collected: OTHER_SAMPLES.collected + tubes.filter((x) => x.collectedAt).length,
    received: OTHER_SAMPLES.received + tubes.filter((x) => x.receivedAt).length,
    transit: tubes.filter((x) => x.state === "collected").length,
  }
}

/**
 * Widget / Lab Sample Tracker ("Samples today"): wide (from a 672px container) = table Barcode · Patient · Tube ·
 * Collected · Received · Status; compact = tube dot, patient, "barcode · collected", status (first 5).
 */
export function SampleTracker() {
  const t = useTranslations("labs.samples.tracker")
  const { b, ar } = useLabText()
  const role = useLabRole()
  const [scanning, setScanning] = React.useState(false)
  const orders = useLabOrders()
  const rows = trackedTubes(orders)
  const c = sampleCounts(orders)
  const state = (x: Tube) => (x.state === "pending" ? "collected" : x.state) as Exclude<TubeState, "pending">
  const th = "h-10 px-1.5 text-start text-xs font-medium text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-1.5 py-2.5 align-middle first:ps-4 last:pe-4"
  return (
    <LabCard
      title={t("title")}
      text={t("text", c)}
      action={
        labCan(role, "receive") && (
          <Button variant="ghost" size="sm" onClick={() => setScanning(true)}>
            <Icon name="scan-barcode" size={24} />
            {t("scan")}
          </Button>
        )
      }
      className="@container/tr"
    >
      <div className="hidden overflow-hidden rounded-lg border @2xl/tr:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[132px]" />
            <col />
            <col className="w-[116px]" />
            <col className="w-[76px]" />
            <col className="w-[76px]" />
            <col className="w-[128px]" />
          </colgroup>
          <thead className="bg-muted">
            <tr>
              {(["barcode", "patient", "tube", "collected", "received", "status"] as const).map((k) => (
                <th key={k} className={th}>
                  {t(`col.${k}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, tube }) => (
              <tr key={`${o.no}-${tube.no}`} className="border-t">
                <td className={cn(td, "text-xs font-medium")}>
                  <Latin>{barcodeOf(o, tube.no)}</Latin>
                </td>
                <td className={td}>{b(o.patient.name)}</td>
                <td className={td}>
                  <TubeLabel tube={tube.type} />
                </td>
                <td className={cn(td, "tabular-nums")}>{tube.collectedAt ? timeOf(tube.collectedAt) : "—"}</td>
                <td className={cn(td, "tabular-nums", !tube.receivedAt && "text-muted-foreground")}>{tube.receivedAt ? timeOf(tube.receivedAt) : "—"}</td>
                <td className={td}>
                  <StatusBadge tone={STATE_TONE[state(tube)]}>{t(`state.${state(tube)}`)}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col @2xl/tr:hidden">
        {rows.slice(0, 5).map(({ o, tube }) => {
          const code = <Latin>{barcodeOf(o, tube.no)}</Latin>
          const at = tube.collectedAt ? timeOf(tube.collectedAt) : "—"
          return (
            <li key={`${o.no}-${tube.no}`} className="flex items-center gap-2.5 border-b py-2.5 last:border-b-0">
              <TubeDot tube={tube.type} size={14} />
              <span className="sr-only">{b(TUBES[tube.type].name)}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">{b(o.patient.name)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {ar ? (
                    <>
                      {at} · {code}
                    </>
                  ) : (
                    <>
                      {code} · {at}
                    </>
                  )}
                </span>
              </div>
              <StatusBadge tone={STATE_TONE[state(tube)]}>{t(`state.${state(tube)}`)}</StatusBadge>
            </li>
          )
        })}
      </ul>
      {scanning && <ReceiveDialog open onOpenChange={setScanning} />}
    </LabCard>
  )
}

/* ------------------------------------------------------------------ rejected */

/**
 * Widget / Lab Rejected Samples ("Rejected today"): patient + outcome badge (Recollecting / Done hh:mm / SMS sent),
 * then reason · tube. Count and share of today's collected samples in the subtitle.
 */
export function RejectedToday() {
  const t = useTranslations("labs.samples.rejected")
  const { b, t: tl } = useLabText()
  const orders = useLabOrders()
  type Item = { key: string; name: string; line: string; at: string; tone: StatusTone; outcome: string }
  const lineOf = (reason: string, tube?: keyof typeof TUBES) => (tube ? t("line", { reason, tube: b(TUBES[tube].the) }) : reason)
  const live: Item[] = orders.flatMap((o) =>
    o.tubes
      .filter((x) => x.rejection)
      .map((x) => {
        const r = x.rejection!
        const redo = o.tubes.find((y) => y.recollectOf === x.no)
        const outcome = !r.recollect ? t("none") : redo?.collectedAt ? t("done", { time: timeOf(redo.collectedAt) }) : t("recollecting")
        const tone: StatusTone = !r.recollect ? "neutral" : redo?.collectedAt ? "success" : "warning"
        return { key: `${o.no}-${x.no}`, name: b(o.patient.name), line: lineOf(tl(`reject.${r.reason}`), x.type), at: r.at, tone, outcome }
      })
  )
  const other: Item[] = OTHER_REJECTIONS.map((r, i) => ({
    key: `other-${i}`,
    name: b(r.name),
    line: lineOf(tl(`reject.${r.reason}`), r.tube),
    at: r.at,
    tone: r.outcome === "done" ? "success" : "neutral",
    outcome: r.outcome === "done" ? t("done", { time: timeOf(r.doneAt!) }) : t("sms"),
  }))
  const items = [...live, ...other].sort((a, z) => z.at.localeCompare(a.at))
  const collected = sampleCounts(orders).collected
  // Latin "2.1%" isolated so the percent sign stays after the number in Arabic.
  const pct = `\u2066${collected ? ((items.length / collected) * 100).toFixed(1) : "0"}%\u2069`
  return (
    <LabCard title={t("title")} text={<bdi>{t("text", { n: items.length, pct })}</bdi>}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((x) => (
            <li key={x.key} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{x.name}</span>
                <StatusBadge tone={x.tone}>{x.outcome}</StatusBadge>
              </div>
              <span className="text-xs text-muted-foreground">{x.line}</span>
            </li>
          ))}
        </ul>
      )}
    </LabCard>
  )
}

/* ------------------------------------------------------------------ tube guide */

/** Widget / Lab Tube Guide: order of draw — number, dot (16), "Colour · additive" and what it's for. */
export function TubeGuide() {
  const t = useTranslations("labs.samples.guide")
  const { b } = useLabText()
  return (
    <LabCard title={t("title")} text={t("text")}>
      <ol className="flex flex-col gap-4">
        {ORDER_OF_DRAW.map((x, i) => (
          <li key={x.tube} className="flex items-center gap-2.5">
            <span className="w-3 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{i + 1}</span>
            <TubeDot tube={x.tube} size={16} />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-foreground">{b(TUBES[x.tube].full)}</span>
              <span className="text-xs text-muted-foreground">{b(x.use)}</span>
            </span>
          </li>
        ))}
      </ol>
    </LabCard>
  )
}

/* ------------------------------------------------------------------ page */

/**
 * Lab · Samples: actions Print labels · Collect next (opens Collect sample for the head of the queue). Desktop: queue
 * and samples today, with Rejected today and the tube guide in a 360px side column; tablet: the side cards side by
 * side under the main column; mobile: one column.
 */
export function Samples() {
  const t = useTranslations("labs.samples")
  const tl = useTranslations("labs.labels")
  const role = useLabRole()
  const orders = useLabOrders()
  const queue = collectionQueue(orders)
  const [collecting, setCollecting] = React.useState<string | null>(null)
  const printLabels = () => {
    const n = queue.reduce((s, o) => s + tubesToCollect(o).length, 0)
    toast.success(tl("toast"), { description: tl("toastText", { n, printer: PRINTER }) })
  }
  return (
    <LabFrame
      actions={
        <>
          {labCan(role, "print") && (
            <Button variant="outline" onClick={printLabels}>
              <Icon name="printer" size={24} />
              {t("printLabels")}
            </Button>
          )}
          {labCan(role, "collect") && (
            <Button onClick={() => queue[0] && setCollecting(queue[0].no)} disabled={!queue.length}>
              <Icon name="drop" size={24} />
              {t("collectNext")}
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <CollectionQueue onCollect={setCollecting} />
          <SampleTracker />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-1">
          <RejectedToday />
          <TubeGuide />
        </div>
      </div>
      {collecting && <CollectDialog orderNo={collecting} onOpenChange={(o) => !o && setCollecting(null)} />}
    </LabFrame>
  )
}
