"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { DropZone } from "@/components/ds/upload"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { BILL_NOW, REJECTION_CODES, type Attachment } from "./data"
import { readyBatch } from "./counts"
import { formatMoney, useMoney } from "./money"
import { nphies, toBundle } from "./nphies"
import { ltrRun } from "./parts"
import { billCan } from "./roles"
import { resendClaim, submitClaim } from "./rules"
import { getClaims, saveClaims, setBatchSent, useBatchSent, useBillRole, useClaim, useClaims } from "./store"
import { useBillText } from "./text"

/** Note strip (info / warning / destructive): soft fill, 18 icon, 12 text. */
export function Strip({ tone, icon, children }: { tone: "info" | "warning" | "destructive"; icon: IconName; children: React.ReactNode }) {
  return (
    <p
      role={tone === "info" ? undefined : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-lg p-3 text-xs",
        tone === "info" ? "bg-info-soft text-info-soft-foreground" : tone === "warning" ? "bg-warning-soft text-warning-soft-foreground" : "bg-destructive-soft text-destructive-soft-foreground"
      )}
    >
      <Icon name={icon} size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  )
}

/** Bordered label / value box (dialog summaries). */
export function KvBox({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <div className="rounded-lg border px-3">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
          <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{k}</span>
          <span className="min-w-0 flex-1 text-sm text-foreground tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ submit */

/**
 * Overlay · Submit claims (Send 12 claims): info note, the batch per insurer + total, the held-back claims (need a
 * pre-auth), "Attach lab results and reports automatically". Send claims → NPHIES (stub) → claims-submitted toast.
 */
export function SubmitClaimsDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("billing.submit")
  const { b, patient, payerName, insurerShort } = useBillText()
  const money = useMoney()
  const role = useBillRole()
  const batch = readyBatch(useClaims(), useBatchSent())
  const [attach, setAttach] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const attachId = React.useId()
  const can = billCan(role, "claims") && batch.count > 0

  const send = async () => {
    if (!can || busy) return
    setBusy(true)
    const fresh = readyBatch(getClaims(), false)
    try {
      await nphies.submit(fresh.rows.map((c) => toBundle(c, "claim-request", BILL_NOW)))
      saveClaims(fresh.rows.map((c) => submitClaim(c, BILL_NOW)))
      setBatchSent()
      onOpenChange(false)
      toast.success(t("toast", { n: batch.count }), { description: t("toastText") })
    } catch {
      setBusy(false)
      toast.error(t("failed"), { description: t("failedText"), retry: () => void send() })
    }
  }

  const held = batch.held
  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={t("title", { n: batch.count })}
      description={t("text", { amount: money(batch.amount, { whole: true }), n: batch.groups.length })}
      icon="send-2"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void send()} disabled={!can || busy}>
          {busy ? t("sending") : t("confirm")}
        </Button>
      }
    >
      <Strip tone="info" icon="info-circle">
        {t("info")}
      </Strip>
      {batch.count === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <KvBox
          rows={[
            ...batch.groups.map((g) => [t("row", { insurer: payerName({ payer: g.insurer }), n: g.count }), money(g.amount, { whole: true })] as [string, string]),
            [t("total", { n: batch.count }), money(batch.amount, { whole: true })],
          ]}
        />
      )}
      {held.length > 0 && (
        <Strip tone="warning" icon="danger">
          {held.length === 1 ? t("heldOne", { name: b(patient(held[0].patient).name), insurer: insurerShort(held[0].insurer) }) : t("heldMany", { n: held.length })}
        </Strip>
      )}
      <label htmlFor={attachId} className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox id={attachId} checked={attach} onCheckedChange={(v) => setAttach(v === true)} />
        {t("attach")}
      </label>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ fix */

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

function AttachmentRow({ title, meta, onRemove, removeLabel }: { title: React.ReactNode; meta: string; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon name="document-text" size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-foreground">{title}</span>
        <span dir="ltr" className="text-xs text-muted-foreground rtl:text-end">
          {meta}
        </span>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={removeLabel}>
        <Icon name="trash" size={20} />
      </Button>
    </div>
  )
}

/**
 * Overlay · Fix claim (Fix, Fix & resend): destructive strip with the insurer's reason + code; service / visit /
 * amount; pre-authorization no.* , the approval letter (attached file or drop zone), note to the insurer.
 * Resend claim → NPHIES (stub) → claim-resent toast. `initial` prefills the form (dev stories).
 */
export function FixClaimDialog({
  claimNo,
  onOpenChange,
  initial,
}: {
  claimNo: string
  onOpenChange: (open: boolean) => void
  initial?: { preauthNo?: string; attachments?: Attachment[]; note?: string }
}) {
  const t = useTranslations("billing.fix")
  const { b, patient, insurerShort, doctorName, locale } = useBillText()
  const dates = useDates()
  const money = useMoney()
  const role = useBillRole()
  const c = useClaim(claimNo)
  const [preauth, setPreauth] = React.useState(initial?.preauthNo ?? c?.preauthNo ?? "")
  const [files, setFiles] = React.useState<Attachment[]>(initial?.attachments ?? c?.attachments ?? [])
  const [note, setNote] = React.useState(initial?.note ?? c?.note ?? "")
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  if (!c) return null

  const ins = insurerShort(c.insurer)
  const reason = c.reasonCode ? (REJECTION_CODES[c.reasonCode] ? b(REJECTION_CODES[c.reasonCode]) : c.reasonText ? b(c.reasonText) : "") : c.reasonText ? b(c.reasonText) : ""
  const missing = !preauth.trim()

  const resend = async () => {
    setTried(true)
    if (missing || busy || !billCan(role, "claims")) return
    setBusy(true)
    const next = resendClaim(c, { preauthNo: preauth, attachments: files, note }, BILL_NOW)
    try {
      await nphies.submit([toBundle(next, "claim-request", BILL_NOW)])
      saveClaims([next])
      onOpenChange(false)
      toast.success(t("toast", { insurer: ins }), { description: t("toastText", { no: ltrRun(next.preauthNo ?? "") }) })
    } catch {
      setBusy(false)
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={t("title")}
      description={<bdi>{t("text", { no: ltrRun(c.no), name: b(patient(c.patient).name), amount: formatMoney(c.amount, locale, { whole: true }) })}</bdi>}
      icon="refresh"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void resend()} disabled={busy}>
          {busy ? t("sending") : t("confirm")}
        </Button>
      }
    >
      {reason && (
        <Strip tone="destructive" icon="warning-2">
          <bdi>{c.reasonCode ? t("reason", { insurer: ins, reason, code: ltrRun(c.reasonCode) }) : `${ins}: ${reason}`}</bdi>
        </Strip>
      )}
      <KvBox
        rows={[
          [t("service"), b(c.service)],
          [t("visit"), t("visitText", { date: dates.dayMonth(c.visitAt), doctor: doctorName(c.doctor) })],
          [t("amount"), money(c.amount)],
        ]}
      />
      <Field label={t("preauth")} required error={tried && missing ? t("preauthError") : undefined}>
        <Input dir="ltr" value={preauth} onChange={(e) => setPreauth(e.target.value.toUpperCase())} placeholder="PA-000000" />
      </Field>
      {files.length > 0 ? (
        files.map((f, i) => (
          <AttachmentRow
            key={i}
            title={<bdi>{preauth.trim() ? t("attachment", { insurer: ins, no: ltrRun(preauth.trim()) }) : f.name}</bdi>}
            meta={`${f.format} · ${f.size}`}
            removeLabel={t("removeFile", { name: f.name })}
            onRemove={() => setFiles((xs) => xs.filter((_, j) => j !== i))}
          />
        ))
      ) : (
        <DropZone
          multiple={false}
          accept=".pdf,.jpg,.jpeg,.png"
          maxBytes={10 * 1024 * 1024}
          onFiles={(fs) =>
            setFiles(
              fs.slice(0, 1).map((f) => {
                const ext = f.name.split(".").pop()?.toUpperCase() ?? "PDF"
                return { name: f.name, format: (ext === "JPEG" ? "JPG" : ext) as Attachment["format"], size: kb(f.size) }
              })
            )
          }
        />
      )}
      <Field label={t("note", { insurer: ins })}>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </ResponsiveDialog>
  )
}
