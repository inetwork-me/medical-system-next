"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { RejectDialog, defaultRejectTube } from "../reject-dialog"
import { labCan } from "../roles"
import { useLabRole } from "../store"
import { CriticalCallDialog } from "./call-dialog"
import { OrderPage, useCurrentOrder } from "./frame"
import { OrderHeader } from "./header"
import { ReleaseDialog } from "./release-dialog"
import { LabResults } from "./results"
import { OrderSide } from "./side"

type Open = "reject" | "release" | "call" | null

/**
 * Lab order page · Results: actions Reject sample · Validate & release; the order header with the stepper; the results
 * (critical banner, panels, pending tests) with the clinical details and previous orders in a 360px side column
 * (under the results on tablet and mobile).
 */
export function OrderResults() {
  const t = useTranslations("labs.order")
  const role = useLabRole()
  const o = useCurrentOrder()
  const [open, setOpen] = React.useState<Open>(null)
  const close = (v: boolean) => !v && setOpen(null)
  const canReject = labCan(role, "reject") && defaultRejectTube(o) !== undefined
  return (
    <OrderPage
      actions={
        <>
          {canReject && (
            <Button variant="outline" onClick={() => setOpen("reject")}>
              <Icon name="close-circle" size={24} />
              {t("reject")}
            </Button>
          )}
          {labCan(role, "validate") && (
            <Button onClick={() => setOpen("release")}>
              <Icon name="tick-circle" size={24} />
              {t("validate")}
            </Button>
          )}
        </>
      }
    >
      <OrderHeader order={o} />
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <LabResults order={o} onLogCall={() => setOpen("call")} />
        <OrderSide order={o} />
      </div>
      {open === "reject" && <RejectDialog orderNo={o.no} onOpenChange={close} />}
      {open === "release" && <ReleaseDialog orderNo={o.no} onOpenChange={close} onLogCall={() => setOpen("call")} />}
      {open === "call" && <CriticalCallDialog orderNo={o.no} onOpenChange={close} />}
    </OrderPage>
  )
}

/** Order tabs built in later steps (Sample, Report, Enter results). */
export function OrderSoon({ step }: { step: number }) {
  const t = useTranslations("labs.order")
  const ts = useTranslations("labs.soon")
  return (
    <OrderPage>
      <div className="rounded-xl border bg-card">
        <EmptyState icon="glass" title={ts("title")} description={t("soon", { n: step })} className="py-16" />
      </div>
    </OrderPage>
  )
}
