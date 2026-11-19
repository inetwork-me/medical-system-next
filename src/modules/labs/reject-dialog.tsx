"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Icon } from "@/components/ds/icon"
import { RadioOption } from "@/components/ds/radio-option"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup } from "@/components/ui/radio-group"
import { HEMOLYSIS_SENSITIVE, LAB_NOW, TUBES, analyteOf, barcodeOf, type LabOrder, type RejectReason } from "./data"
import { reject, valueText } from "./machine"
import { Latin } from "./parts"
import { labCan } from "./roles"
import { applyStep, nextTicket, useLabOrder, useLabRole } from "./store"
import { useLabText } from "./text"

const REASONS: RejectReason[] = ["hemolyzed", "clotted", "qns", "wrongTube", "label"]

/** The tube to reject by default: the one carrying a raised hemolysis-sensitive result, else the first one in the lab. */
export function defaultRejectTube(o: LabOrder) {
  const live = o.tubes.filter((x) => x.state !== "pending" && x.state !== "rejected")
  const raised = live.find((x) =>
    o.panels.some((p) => x.tests.includes(p.test) && p.results.some((r) => HEMOLYSIS_SENSITIVE.includes(r.analyte) && (r.flag === "H" || r.flag === "C")))
  )
  return (raised ?? live[0])?.no
}

/**
 * Overlay · Reject sample (Order page → Reject sample; destructive). Warns when a raised result may be false from
 * hemolysis (potassium), then Reason radios, "Ask for a new sample now" (→ Recollect with a queue ticket) and
 * "Tell <doctor>". Confirm swaps to the warning-tone "sample-rejected" toast.
 */
export function RejectDialog({ orderNo, tubeNo, onOpenChange }: { orderNo: string; tubeNo?: number; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("labs.reject")
  const { b, t: tl, doctorName } = useLabText()
  const role = useLabRole()
  const o = useLabOrder(orderNo)
  const [no] = React.useState(() => tubeNo ?? (o ? defaultRejectTube(o) : undefined))
  const [reason, setReason] = React.useState<RejectReason>("hemolyzed")
  const [recollect, setRecollect] = React.useState(true)
  const [tell, setTell] = React.useState(true)
  const tube = o?.tubes.find((x) => x.no === no)
  if (!o || !tube) return null

  const doctor = doctorName(o.doctorId)
  const raised = o.panels
    .filter((p) => tube.tests.includes(p.test))
    .flatMap((p) => p.results)
    .find((r) => HEMOLYSIS_SENSITIVE.includes(r.analyte) && (r.flag === "H" || r.flag === "C"))

  const confirm = () => {
    if (!labCan(role, "reject")) return
    const step = applyStep(o.no, (x) => reject(x, tube.no, reason, { recollect, toldDoctor: tell, ticket: nextTicket() }, "ali", LAB_NOW))
    if (!step.ok) return
    onOpenChange(false)
    const description = recollect && tell ? t("toastBoth", { doctor }) : recollect ? t("toastNew") : tell ? t("toastTold", { doctor }) : undefined
    toast.warning(t("toast"), { description })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={
        <>
          {t("text", { no: o.no, tube: b(TUBES[tube.type].the), barcode: "" })}
          <Latin>{barcodeOf(o, tube.no)}</Latin>
        </>
      }
      icon="close-circle"
      tone="destructive"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button variant="destructive" onClick={confirm} disabled={!labCan(role, "reject")}>
          {t("confirm")}
        </Button>
      }
    >
      {raised && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-xs font-medium text-warning-soft-foreground">
          <Icon name="warning-2" size={18} className="shrink-0" />
          <span>{t("falseHigh", { analyte: b(analyteOf(raised.analyte)!.name), value: valueText(raised.analyte, raised.value) })}</span>
        </p>
      )}
      <div className="flex flex-col gap-2">
        <span id="reject-reason" className="text-sm font-medium">
          {t("reason")}
        </span>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as RejectReason)} aria-labelledby="reject-reason" className="gap-3">
          {REASONS.map((r) => (
            <RadioOption key={r} value={r} className="items-center [&_.font-medium]:font-normal" title={tl(`reject.${r}`)} />
          ))}
        </RadioGroup>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <Checkbox checked={recollect} onCheckedChange={(v) => setRecollect(v === true)} />
        {t("recollect")}
      </label>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <Checkbox checked={tell} onCheckedChange={(v) => setTell(v === true)} />
        {t("tell", { doctor })}
      </label>
    </ResponsiveDialog>
  )
}
