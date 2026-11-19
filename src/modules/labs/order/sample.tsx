"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Barcode } from "@/components/ds/barcode"
import { Icon } from "@/components/ds/icon"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { useClinics } from "@/modules/clinics/store"
import { ANALYZER, TUBES, barcodeOf, staffOf, timeOf, type LabEvent, type LabOrder, type Tube } from "../data"
import { defaultRejectTube, RejectDialog } from "../reject-dialog"
import { Latin } from "../parts"
import { labCan } from "../roles"
import { useLabRole } from "../store"
import { LabCard } from "../samples"
import { useLabText } from "../text"
import { OrderPage, useCurrentOrder } from "./frame"
import { OrderHeader } from "./header"
import { OrderSide } from "./side"

const PRINTER = "Lab-2"

const TONE: Record<Tube["state"], StatusTone> = {
  pending: "neutral",
  collected: "warning",
  received: "neutral",
  analyzer: "info",
  resulted: "success",
  rejected: "destructive",
}

/**
 * Widget / Lab Sample Detail: Tubes (one card per tube: cap colour + type, the printed label with barcode and
 * S-code, volume and tests, status) and the chain of custody (every hand-off, newest last).
 */
export function SampleDetail({ order: o, onPrint }: { order: LabOrder; onPrint?: () => void }) {
  const t = useTranslations("labs.sample")
  const { b, short, list, doctorName, t: tl } = useLabText()
  const clinics = useClinics()
  const tubes = o.tubes
  const firstCollect = tubes.filter((x) => x.collectedAt).sort((a, z) => a.collectedAt!.localeCompare(z.collectedAt!))[0]

  const stateText = (x: Tube) => {
    if (x.state === "analyzer") return t("state.analyzer", { analyzer: ANALYZER })
    if (x.state === "resulted") return x.rack ? t("state.resultedRack", { rack: x.rack }) : t("state.resulted")
    if (x.state === "rejected") return t("state.rejected", { reason: tl(`reject.${x.rejection!.reason}`).toLowerCase() })
    return t(`state.${x.state}`)
  }
  const who = (key?: string) => (key ? (staffOf(key) ? b(staffOf(key)!.name) : doctorName(key)) : "")
  const detail = (e: LabEvent) => {
    if (e.kind === "ordered") {
      const c = clinics.find((x) => x.key === o.clinicId)
      return [doctorName(o.doctorId), c ? b(c.name) : ""].filter(Boolean).join(" · ")
    }
    return [who(e.by), e.note ? b(e.note) : ""].filter(Boolean).join(" · ")
  }
  const events = [...o.events].sort((a, z) => a.at.localeCompare(z.at))

  return (
    <div className="@container/sd flex min-w-0 flex-col gap-4 md:gap-6">
      <LabCard
        title={t("tubes")}
        text={
          firstCollect
            ? t("tubesText", { n: tubes.length, time: timeOf(firstCollect.collectedAt!), by: who(firstCollect.collectedBy) })
            : t("tubesTextNone", { n: tubes.length })
        }
        action={
          onPrint && (
            <Button variant="ghost" size="sm" onClick={onPrint}>
              <Icon name="printer" size={24} />
              {t("printLabels")}
            </Button>
          )
        }
      >
        <ul className="grid grid-cols-1 gap-3 @2xl/sd:grid-cols-3">
          {tubes.map((x) => {
            const code = barcodeOf(o, x.no)
            const tests = list(x.tests.map(short))
            return (
              <li key={x.no} className={cn("flex flex-col gap-2.5 rounded-xl border bg-card p-3.5", x.state === "rejected" && "opacity-70")}>
                <div className="flex items-center gap-2">
                  <span aria-hidden className="size-4 shrink-0 rounded-full border border-border" style={{ backgroundColor: TUBES[x.type].hex }} />
                  <span className="text-sm font-medium text-foreground">{b(TUBES[x.type].full)}</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg bg-muted p-2.5" role="img" aria-label={t("barcodeLabel", { code })}>
                  <Barcode value={code} />
                  <Latin className="text-xs font-medium text-foreground">{code}</Latin>
                </div>
                <span className="text-xs text-muted-foreground">
                  <bdi>{x.volumeMl && x.type !== "bottle" ? t("volume", { ml: x.volumeMl, tests }) : tests}</bdi>
                </span>
                <StatusBadge tone={TONE[x.state]}>
                  <bdi>{stateText(x)}</bdi>
                </StatusBadge>
              </li>
            )
          })}
        </ul>
      </LabCard>

      <LabCard title={t("custody")} text={t("custodyText")}>
        <ol className="flex flex-col gap-4">
          {events.map((e, i) => {
            const last = i === events.length - 1
            return (
              <li key={`${e.kind}-${e.at}-${i}`} className="flex items-start gap-3">
                <span className="w-10 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground tabular-nums">{timeOf(e.at)}</span>
                <span className={cn("mt-1 size-3 shrink-0 rounded-full", e.kind === "rejected" ? "bg-destructive" : last ? "bg-primary" : "bg-success")} aria-hidden />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{t(`event.${e.kind}`)}</span>
                  {detail(e) && (
                    <span className="text-xs text-muted-foreground">
                      <bdi>{detail(e)}</bdi>
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </LabCard>
    </div>
  )
}

/** Lab order page · Sample: actions Reject sample · Print labels; the order header, tubes + custody, the side column. */
export function OrderSample() {
  const t = useTranslations("labs.sample")
  const tr = useTranslations("labs.order")
  const tl = useTranslations("labs.labels")
  const role = useLabRole()
  const o = useCurrentOrder()
  const [rejecting, setRejecting] = React.useState(false)
  const print = () => {
    const n = o.tubes.filter((x) => x.state !== "rejected").length
    toast.success(tl("toast"), { description: t("labels", { n, printer: PRINTER }) })
  }
  const canPrint = labCan(role, "print")
  return (
    <OrderPage
      actions={
        <>
          {labCan(role, "reject") && defaultRejectTube(o) !== undefined && (
            <Button variant="outline" onClick={() => setRejecting(true)}>
              <Icon name="close-circle" size={24} />
              {tr("reject")}
            </Button>
          )}
          {canPrint && (
            <Button onClick={print}>
              <Icon name="printer" size={24} />
              {t("printLabels")}
            </Button>
          )}
        </>
      }
    >
      <OrderHeader order={o} />
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SampleDetail order={o} onPrint={canPrint ? print : undefined} />
        <OrderSide order={o} />
      </div>
      {rejecting && <RejectDialog orderNo={o.no} onOpenChange={setRejecting} />}
    </OrderPage>
  )
}
