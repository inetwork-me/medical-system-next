"use client"

import { usePatientId } from "@/modules/patients/href"
import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { useIsMobile } from "@/hooks/use-media-query"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { notify } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useRouter } from "@/i18n/navigation"
import { PCard } from "../profile/side"
import { usePatient, useText } from "../profile/use-patient"
import { insuranceSummary, procedureBy, specialtyHref, toothName, type DentalRecord } from "./data"
import { DentalActions } from "./dental-actions"
import { sendPreApproval, setConsent, useDentalRecord, useSelectedTooth } from "./dental-store"
import { PlanCompact, useSarFn } from "./dental-tab"
import { PlanTable } from "./plan"
import { Workspace } from "./workspace"

/**
 * Patients · Dental · Treatment plan (1440 / 768). Desktop: wide plan table + patient consent, Insurance & approvals on
 * the side. Tablet: compact plan, then insurance and consent side by side. Send for pre-approval → dialog → toast.
 */
export function PlanWorkspace() {
  const t = useTranslations("specialties.chartWs")
  const id = usePatientId()
  const rec = useDentalRecord(id)
  const [selected, setSelected] = useSelectedTooth(id)
  const router = useRouter()
  const mobile = useIsMobile()
  return (
    <Workspace kind="dental" mode="plan" actions={rec && <DentalActions />}>
      {!rec ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon="health" title={t("emptyTitle")} description={t("emptyText")} className="py-16" />
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4" data-print-area>
            <PlanTable
              rec={rec}
              selected={selected}
              onSelect={(fdi) => {
                setSelected(fdi)
                router.push(specialtyHref.dentalChart(id, fdi))
              }}
              onAdd={mobile ? undefined : () => router.push(specialtyHref.dentalChart(id, selected ?? undefined))}
              className="max-xl:hidden"
            />
            <PlanCompact rec={rec} addHref={specialtyHref.dentalChart(id, selected ?? undefined)} className="xl:hidden" />
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-1">
              <InsuranceCard id={id} rec={rec} readOnly={mobile} className="xl:hidden" />
              <ConsentCard id={id} rec={rec} readOnly={mobile} />
            </div>
          </div>
          <InsuranceCard id={id} rec={rec} readOnly={mobile} className="max-xl:hidden xl:sticky xl:top-20" />
        </div>
      )}
    </Workspace>
  )
}

/* ---------------------------------------------------------------- insurance & approvals */

/** Widget / Dental Insurance: annual dental limit, pre-approval steps, Send for pre-approval. */
export function InsuranceCard({ id, rec, readOnly, className }: { id: string; rec: DentalRecord; readOnly?: boolean; className?: string }) {
  const t = useTranslations("specialties.ins")
  const { b } = useText()
  const sar = useSarFn()
  const format = useFormatter()
  const dates = useDates()
  const [open, setOpen] = React.useState(false)
  const s = insuranceSummary(rec)
  const pa = rec.preApproval
  const items = pa ? rec.plan.filter((i) => pa.items.includes(i.id)) : []
  const amount = items.reduce((x, i) => x + i.fee, 0)
  const sent = !!pa?.steps.find((x) => x.key === "sent")?.at
  const when = (iso: string) => `${dates.dayMonth(iso)} · ${iso.slice(11, 16)}`
  if (!rec.insurance.insured)
    return (
      <PCard title={t("title")} description={b(rec.insurance.payer)} className={className}>
        <p className="flex items-start gap-2 rounded-[10px] bg-muted p-3 text-xs text-muted-foreground">
          <Icon name="info-circle" size={18} className="shrink-0" />
          {t("noInsurance")}
        </p>
      </PCard>
    )
  return (
    <PCard title={t("title")} description={<bdi>{t("description", { payer: b(rec.insurance.payer), cls: rec.insurance.className, policy: rec.insurance.policy })}</bdi>} className={className}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium">{t("limit")}</span>
          <span className="text-muted-foreground tabular-nums">{t("used", { used: format.number(s.used, "integer"), limit: format.number(s.annualLimit, "integer") })}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={s.used} aria-valuemax={s.annualLimit} aria-label={t("limit")}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${s.usedPct}%` }} />
        </div>
        <span className={cn("text-xs tabular-nums", s.leftAfter < 0 ? "text-destructive" : "text-warning-soft-foreground")}>
          {s.leftAfter < 0 ? t("overBy", { amount: sar(-s.leftAfter) }) : t("leftAfter", { amount: sar(s.leftAfter) })}
        </span>
      </div>
      {pa && (
        <div className="flex flex-col rounded-[10px] border p-3.5">
          <span className="text-sm font-medium">{t("paTitle", { teeth: pa.teeth.join(", ") })}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("paWhat", { what: cap(items.map((i) => b(procedureBy(i.cdt)?.short ?? i.procedure)).join(" + ")), amount: sar(amount) })}
          </span>
          <ol className="flex flex-col gap-2.5 pt-3">
            {pa.steps.map((st) => {
              const done = !!st.at || (st.key === "decision" && pa.status !== "pending")
              const now = !done && st.key === pa.current
              return (
                <li key={st.key} className="flex items-center gap-2.5" aria-current={now ? "step" : undefined}>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full",
                      done ? "bg-success text-primary-foreground" : now ? "bg-primary" : "bg-muted",
                    )}
                  >
                    {done && <Icon name="tick-circle" size={14} />}
                  </span>
                  <span className={cn("flex-1 text-xs", now && "font-medium", !done && !now && "text-muted-foreground")}>{t(`step.${st.key}`, { payer: b(rec.insurance.payerShort) })}</span>
                  {st.at && <span className="text-xs text-muted-foreground tabular-nums">{when(st.at)}</span>}
                </li>
              )
            })}
          </ol>
        </div>
      )}
      {pa && !readOnly && (
        <Button onClick={() => setOpen(true)} disabled={sent} className="w-full">
          <Icon name={sent ? "clock" : "send-2"} size={20} />
          {sent ? t("waiting", { payer: b(rec.insurance.payerShort) }) : t("send")}
        </Button>
      )}
      {pa && <PreApprovalDialog id={id} rec={rec} open={open} onOpenChange={setOpen} />}
    </PCard>
  )
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

/** Overlay · Send pre-approval → swaps to the "Pre-approval sent to Bupa" toast. */
function PreApprovalDialog({ id, rec, open, onOpenChange }: { id: string; rec: DentalRecord; open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations("specialties.ins")
  const tc = useTranslations("common.actions")
  const { b } = useText()
  const sar = useSarFn()
  const pa = rec.preApproval!
  const [notifyGuardian, setNotify] = React.useState(pa.notifyGuardian)
  const items = rec.plan.filter((i) => pa.items.includes(i.id))
  const payer = b(rec.insurance.payerShort)
  const xrays = 2
  const rows: [string, React.ReactNode][] = [
    [t("dlg.tooth"), `${pa.teeth.join(", ")} · ${pa.teeth.map((f) => b(toothName(f))).join(", ")}`],
    [
      t("dlg.procedures"),
      items.map((i, k) => (
        <React.Fragment key={i.id}>
          {k > 0 && " + "}
          <bdi dir="ltr">{i.cdt}</bdi> {b(procedureBy(i.cdt)?.short ?? i.procedure)}
        </React.Fragment>
      )),
    ],
    [
      t("dlg.diagnosis"),
      <>
        <bdi dir="ltr">{pa.diagnosis}</bdi> · {b(pa.diagnosisName)}
      </>,
    ],
    [t("dlg.amount"), sar(items.reduce((x, i) => x + i.fee, 0))],
  ]
  const send = () => {
    sendPreApproval(id, notifyGuardian)
    onOpenChange(false)
    notify.success(t("sentTitle", { payer }), { description: t("sentText") })
  }
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="shield-tick"
      tone="primary"
      title={t("dlg.title")}
      description={<bdi>{t("description", { payer: b(rec.insurance.payer), cls: rec.insurance.className, policy: rec.insurance.policy })}</bdi>}
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tc("cancel")}
        </Button>
      }
      primary={
        <Button onClick={send}>
          <Icon name="send-2" size={20} />
          {t("dlg.send", { payer })}
        </Button>
      }
    >
      <dl>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start gap-3 border-b py-2.5 last:border-0">
            <dt className="w-[110px] shrink-0 pt-0.5 text-xs text-muted-foreground">{k}</dt>
            <dd className="min-w-0 flex-1 text-sm font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium">{t("dlg.attached")}</span>
        {[t("dlg.xrays", { count: xrays }), t("dlg.chart"), t("dlg.note")].map((x) => (
          <span key={x} className="flex items-center gap-2 text-sm">
            <Icon name="tick-circle" size={18} className="text-success" />
            {x}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="pa-notify" checked={notifyGuardian} onCheckedChange={(v) => setNotify(v === true)} />
        <Label htmlFor="pa-notify" className="text-sm font-normal">
          {t("dlg.notify", { payer })}
        </Label>
      </div>
    </ResponsiveDialog>
  )
}

/* ---------------------------------------------------------------- consent */

/** Patient consent: under 18 the guardian signs — WhatsApp link or signature on this device. */
export function ConsentCard({ id, rec, readOnly, className }: { id: string; rec: DentalRecord; readOnly?: boolean; className?: string }) {
  const t = useTranslations("specialties.consent")
  const { b } = useText()
  const data = usePatient()
  const [sign, setSign] = React.useState(false)
  const c = rec.consent
  const g = c.guardian
  if (!data) return null
  const tone = c.status === "signed" ? "success" : c.status === "sent" ? "info" : "warning"
  return (
    <PCard
      title={t("title")}
      description={g ? t("minor", { name: b(data.patient.name).split(" ")[0], age: data.patient.age, gender: data.patient.gender }) : t("adult")}
      className={className}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground" aria-hidden>
          {g?.initials ?? data.patient.initials}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{g ? b(g.name) : b(data.patient.name)}</span>
          <span className="text-xs text-muted-foreground">{g ? b(g.relation) : t("patient")}</span>
        </div>
        <StatusBadge tone={tone}>{t(`status.${c.status}`)}</StatusBadge>
      </div>
      {!readOnly && c.status !== "signed" && (
        <div className="flex flex-wrap gap-2 *:min-w-0 *:flex-1 *:basis-40">
          <Button
            variant="outline"
            onClick={() => {
              setConsent(id, "sent")
              notify.success(t("sentTitle"), { description: t("sentText", { name: g ? b(g.name) : b(data.patient.name) }) })
            }}
          >
            <Icon name="message" size={20} />
            <span className="truncate">{c.status === "sent" ? t("resend") : t("whatsapp")}</span>
          </Button>
          <Button onClick={() => setSign(true)}>
            <Icon name="edit-2" size={20} />
            <span className="truncate">{t("sign")}</span>
          </Button>
        </div>
      )}
      <SignDialog
        open={sign}
        onOpenChange={setSign}
        signer={g ? b(g.name) : b(data.patient.name)}
        onSigned={() => {
          setConsent(id, "signed")
          notify.success(t("signedTitle"), { description: t("signedText") })
        }}
      />
    </PCard>
  )
}

/** Signature pad (not in the design): draw with finger / mouse, Clear, Sign. */
function SignDialog({ open, onOpenChange, signer, onSigned }: { open: boolean; onOpenChange: (v: boolean) => void; signer: string; onSigned: () => void }) {
  const t = useTranslations("specialties.consent")
  const ref = React.useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = React.useState(false)
  const last = React.useRef<{ x: number; y: number } | null>(null)
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * e.currentTarget.width) / r.width, y: ((e.clientY - r.top) * e.currentTarget.height) / r.height }
  }
  const clear = () => {
    const c = ref.current
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height)
    setDrawn(false)
  }
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) clear()
        onOpenChange(v)
      }}
      icon="edit-2"
      tone="primary"
      title={t("signTitle")}
      description={t("signText", { name: signer })}
      secondary={
        <Button variant="outline" onClick={clear}>
          {t("clearSig")}
        </Button>
      }
      primary={
        <Button
          disabled={!drawn}
          onClick={() => {
            onSigned()
            onOpenChange(false)
          }}
        >
          <Icon name="tick-circle" size={20} />
          {t("confirmSign")}
        </Button>
      }
    >
      <canvas
        ref={ref}
        width={880}
        height={320}
        aria-label={t("pad")}
        className="h-40 w-full touch-none rounded-lg border border-dashed bg-muted/40"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          last.current = pos(e)
        }}
        onPointerMove={(e) => {
          if (!last.current) return
          const ctx = e.currentTarget.getContext("2d")!
          const p = pos(e)
          ctx.strokeStyle = "#0f172a"
          ctx.lineWidth = 4
          ctx.lineCap = "round"
          ctx.beginPath()
          ctx.moveTo(last.current.x, last.current.y)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
          last.current = p
          if (!drawn) setDrawn(true)
        }}
        onPointerUp={() => (last.current = null)}
      />
    </ResponsiveDialog>
  )
}
