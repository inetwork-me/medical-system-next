"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { BILL_NOW, CENTER, type Contract } from "./data"
import { KvBox, Strip } from "./claim-dialogs"
import { formatMoney } from "./money"
import { nafath, NAFATH_POLL_MS, NAFATH_TTL_SEC, type NafathStart } from "./nafath"
import { ltrRun } from "./parts"
import { billCan } from "./roles"
import { canSignNow, maskId, monthlyPay, nextSigner, pdfHashOf, signContract } from "./rules"
import { clausesOf } from "./templates"
import { getContract, saveContract, useBillRole, useContract } from "./store"
import { useBillText } from "./text"

type Phase = { step: 1 } | { step: 2; req: NafathStart; left: number } | { step: "expired" | "rejected" }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

/** "2 years from 1 Dec 2026" from the contract's dates. */
function useTerm() {
  const t = useTranslations("billing.sign")
  const { date } = useBillText()
  return (c: Contract) => {
    const months = (Number(c.end.slice(0, 4)) - Number(c.start.slice(0, 4))) * 12 + (Number(c.end.slice(5, 7)) - Number(c.start.slice(5, 7))) + 1
    return months % 12 === 0 ? t("termValue", { n: months / 12, date: date(c.start) }) : t("termMonths", { n: months, date: date(c.start) })
  }
}

/**
 * Overlay · Sign contract (Sign, Sign with Nafath). Step 1: summary (the other side shows as already signed), "I read
 * the whole contract", the national ID from the profile (masked), what is stored, Send to Nafath. Step 2 (swaps in):
 * the number to pick in Nafath, the expiry countdown, 3 steps, "Waiting for your approval… updates by itself" — polls
 * the Nafath stub until approved (→ contract-signed toast) or expired / declined. Signers sign in order.
 */
export function SignDialog({ contractNo, onOpenChange, initialStep }: { contractNo: string; onOpenChange: (open: boolean) => void; initialStep?: 2 }) {
  const t = useTranslations("billing.sign")
  const tc = useTranslations("billing.contract")
  const { b, locale, date } = useBillText()
  const role = useBillRole()
  const c = useContract(contractNo)
  const term = useTerm()
  const [read, setRead] = React.useState(false)
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [phase, setPhase] = React.useState<Phase>(initialStep === 2 ? { step: 2, req: { transId: "NFD-DEMO", random: "47", expiresInSec: 161 }, left: 161 } : { step: 1 })
  const readId = React.useId()
  const me = c ? nextSigner(c) : undefined
  const polling = React.useRef(false)

  const finish = React.useCallback(
    (no: string, order: number, transId: string) => {
      const cur = getContract(no)
      if (!cur) return
      const next = signContract(cur, order, { at: BILL_NOW, nafathTxn: transId, pdfHash: pdfHashOf(cur, BILL_NOW) })
      saveContract(next)
      onOpenChange(false)
      if (next.locked) {
        const party = b(cur.party.short ?? cur.party.name)
        toast.success(t("toast"), { description: t("toastAll", { n: next.signers.length, to: tc(`copiesTo.${cur.kind}`, { party }) }) })
      } else {
        const n = nextSigner(next)
        toast.success(t("toastNext", { name: n ? b(n.name) : "" }), { description: t("toastNextText") })
      }
    },
    [b, onOpenChange, t, tc]
  )

  const poll = React.useCallback(async () => {
    if (phase.step !== 2 || polling.current || !c || !me) return
    polling.current = true
    try {
      const { status } = await nafath.status({ nationalId: me.nationalId, transId: phase.req.transId, random: phase.req.random })
      if (status === "COMPLETED") finish(c.no, me.order, phase.req.transId)
      else if (status === "EXPIRED") setPhase({ step: "expired" })
      else if (status === "REJECTED") setPhase({ step: "rejected" })
    } catch {
      // A missed poll is retried on the next tick.
    } finally {
      polling.current = false
    }
  }, [phase, c, me, finish])

  // Step 2: count down every second, poll every NAFATH_POLL_MS ("this updates by itself"). The timers read the
  // latest poll through a ref, so the countdown re-render doesn't restart them.
  const pollRef = React.useRef(poll)
  React.useEffect(() => {
    pollRef.current = poll
  }, [poll])
  const step2 = phase.step === 2
  React.useEffect(() => {
    if (!step2 || initialStep === 2) return
    const tick = setInterval(() => setPhase((p) => (p.step === 2 ? (p.left <= 1 ? { step: "expired" } : { ...p, left: p.left - 1 }) : p)), 1000)
    const id = setInterval(() => void pollRef.current(), NAFATH_POLL_MS)
    return () => {
      clearInterval(tick)
      clearInterval(id)
    }
  }, [step2, initialStep])

  if (!c || !me) return null
  const refusal = canSignNow(c, me)
  const allowed = !refusal && me.side === "center" && billCan(role, "sign")
  const other = c.signers.find((s) => s.side === "party")
  const clauses = clausesOf(c).length

  const send = async () => {
    setTried(true)
    if (!read || !allowed || busy) return
    setBusy(true)
    try {
      const req = await nafath.start({ nationalId: me.nationalId, service: "DigitalSigning", local: locale === "ar" ? "ar" : "en", requestId: c.no })
      setPhase({ step: 2, req, left: req.expiresInSec ?? NAFATH_TTL_SEC })
    } catch {
      toast.error(t("failed"), { description: t("failedText"), retry: () => void send() })
    } finally {
      setBusy(false)
    }
  }

  const close = (
    <Button variant="outline" onClick={() => onOpenChange(false)}>
      {t("cancel")}
    </Button>
  )

  if (phase.step === 1) {
    const rows: [string, React.ReactNode][] = [
      [t("contract"), <bdi key="c">{t("contractValue", { kind: t(`kindShort.${c.kind}`), no: ltrRun(c.no) })}</bdi>],
    ]
    if (other)
      rows.push([
        t(`otherSide.${c.kind}`),
        <span key="o" className={cn(other.status === "signed" && "text-success")}>
          {other.status === "signed" && other.signedAt
            ? t("otherSigned", { name: b(other.name), date: date(other.signedAt).replace(/\s\d{4}$/, ""), female: other.female ? "yes" : "no" })
            : t("otherWaiting", { name: b(other.name) })}
        </span>,
      ])
    rows.push([t("term"), term(c)])
    if (c.terms.staff) rows.push([t("pay"), t("payValue", { amount: formatMoney(monthlyPay(c.terms.staff), locale, { whole: true }) })])
    else if (c.terms.partner) rows.push([t("pricing"), b(c.terms.partner.pricing)])

    return (
      <ResponsiveDialog
        open
        onOpenChange={onOpenChange}
        title={t("title")}
        description={<bdi>{t("text", { no: ltrRun(c.no), kind: t(`kindLower.${c.kind}`) })}</bdi>}
        icon="finger-scan"
        width="sm:max-w-140"
        secondary={close}
        primary={
          <Button onClick={() => void send()} disabled={!allowed || busy}>
            {busy ? t("sending") : t("send")}
          </Button>
        }
      >
        <KvBox rows={rows} />
        {!allowed && (
          <Strip tone="warning" icon="warning-2">
            {t("notYourTurn")}
          </Strip>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={readId} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox id={readId} checked={read} onCheckedChange={(v) => setRead(v === true)} aria-invalid={tried && !read} />
            {t("read", { clauses, pages: c.pages })}
          </label>
          {tried && !read && <p className="text-xs text-destructive">{t("readError")}</p>}
        </div>
        <Field label={t("id")} required helper={t("idHint")}>
          <Input dir="ltr" readOnly value={maskId(me.nationalId)} startIcon={<Icon name="personalcard" size={20} className="text-muted-foreground" />} className="tabular-nums" />
        </Field>
        <Strip tone="info" icon="info-circle">
          {t("info")}
        </Strip>
      </ResponsiveDialog>
    )
  }

  if (phase.step === "expired" || phase.step === "rejected") {
    const k = phase.step
    return (
      <ResponsiveDialog
        open
        onOpenChange={onOpenChange}
        title={t("approveTitle")}
        description={t("approveText")}
        icon="finger-scan"
        width="sm:max-w-140"
        secondary={close}
        primary={<Button onClick={() => setPhase({ step: 1 })}>{t("again")}</Button>}
      >
        <Strip tone="destructive" icon="warning-2">
          <span className="font-medium">{t(k)}</span> · {t(`${k}Text`)}
        </Strip>
      </ResponsiveDialog>
    )
  }

  if (phase.step !== 2) return null
  const n = phase.req.random
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("approveTitle")}
      description={t("approveText")}
      icon="finger-scan"
      width="sm:max-w-140"
      secondary={close}
      primary={<Button onClick={() => void poll()}>{t("check")}</Button>}
    >
      <div className="flex flex-col items-center gap-1 rounded-xl bg-accent px-4 py-6 text-center">
        <span className="text-sm text-foreground">{t("pick")}</span>
        <span className="text-5xl leading-tight font-bold text-primary tabular-nums" aria-live="polite">
          {n}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums" role="timer">
          <Icon name="timer-1" size={16} />
          {t("expires", { time: ltrRun(mmss(phase.left)) })}
        </span>
      </div>
      <ol className="flex flex-col gap-3">
        {[t("step1"), t("step2", { center: b(CENTER.name) }), t("step3", { n })].map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-sm text-foreground">
            <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <Strip tone="info" icon="timer-1">
        {t("waiting")}
      </Strip>
    </ResponsiveDialog>
  )
}
