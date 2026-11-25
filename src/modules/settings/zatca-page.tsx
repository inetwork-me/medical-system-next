"use client"

import * as React from "react"

import { Link } from "@/i18n/navigation"
import { csvBlob, saveBlob } from "@/lib/export/files"
import { isTabEnabled } from "@/lib/modules"
import { can } from "@/lib/permissions"
import type { ActionItem } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { invoiceHref } from "@/modules/billing/href"
import { canEditSection } from "./access"
import { daysBetween, expiringUnits } from "./checks"
import { SET_TODAY, ZATCA_TODAY, ZATCA_WARNINGS, type ZatcaUnit } from "./data"
import { SettingsFrame } from "./frame"
import { KvRows, Note, SetCard, useUserText } from "./parts"
import { zatca } from "./services/integrations"
import { renewCert, useBranches, useZatcaUnits, writeAudit } from "./store"
import { useHealthCheck } from "./integrations"

/** A certificate renewed today runs a year past the old expiry. */
const nextYear = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4, 10)}`

/**
 * Integration · ZATCA (Integrations ›): header (phase, environment, branches, status), amber note about the expiring
 * certificate, tiles (invoices today, cleared, reported, rejected), invoicing units (one per branch: unit id, certificate
 * until, today's count, status) + Renew <branch> certificate, recent warnings (rule code + invoice). Header: Test connection,
 * Renew certificate. Mobile ⋯: Test connection, Renew certificate, Export log.
 */
export function ZatcaPage() {
  const x = useUserText()
  const { t, b, l, n, dates } = x
  const units = useZatcaUnits()
  const branches = useBranches()
  const edit = canEditSection("integrations")
  const { run, busy } = useHealthCheck()
  const [renewing, setRenewing] = React.useState<ZatcaUnit | null>(null)
  const expiring = expiringUnits(units).sort((a, z) => a.certUntil.localeCompare(z.certUntil))
  const soonest = expiring[0]
  const branchName = (k: string) => {
    const br = branches.find((y) => y.key === k)
    return br ? b(br.name) : k
  }
  const day = (iso: string) => l(dates.dayMonth(iso) + (iso.slice(0, 4) !== SET_TODAY.slice(0, 4) ? ` ${iso.slice(0, 4)}` : ""))
  const longDay = (iso: string) => l(dates.short(iso).replace(/^0/, ""))
  const total = units.reduce((s, u) => s + u.today, 0)
  // Invoice numbers open the invoice when Billing › Invoices is on and the user can see Billing.
  const invoiceOk = isTabEnabled("billing", "invoices") && can("billing", "view")

  const exportLog = () => {
    saveBlob(
      csvBlob(
        ["Branch", "Unit", "Certificate until", "Invoices today", "Warning", "Invoice", "At"],
        [
          ...units.map((u) => [branchName(u.branch), u.unit, u.certUntil, String(u.today), "", "", ""]),
          ...ZATCA_WARNINGS.map((w) => ["", "", "", "", `${w.rule} ${w.what.en}`, w.invoice, w.at.replace("T", " ")]),
        ]
      ),
      `zatca-${SET_TODAY}.csv`
    )
    writeAudit({ kind: "export", what: { en: "Exported the ZATCA log", ar: "صدّر سجل زاتكا" }, where: "integrations" })
    toast.info(t("toasts.exported"), { description: t("toasts.exportedText") })
  }

  const menu: ActionItem[] = [
    { key: "test", icon: "refresh", label: t("zatca.test"), onSelect: () => void run(["zatca"]) },
    edit && { key: "renew", icon: "receipt-2", label: t("zatca.renew"), onSelect: () => setRenewing(soonest ?? units[0]) },
    { key: "export", icon: "export", label: t("zatca.exportLog"), onSelect: exportLog },
  ].filter(Boolean) as ActionItem[]

  return (
    <SettingsFrame
      section="integrations"
      inner="zatca"
      menu={menu}
      actions={
        <>
          <Button variant="outline" onClick={() => void run(["zatca"])} disabled={busy.length > 0}>
            <Icon name="refresh" size={20} />
            {busy.length ? t("integrations.testing") : t("zatca.test")}
          </Button>
          {edit && <Button onClick={() => setRenewing(soonest ?? units[0])}>{t("zatca.renew")}</Button>}
        </>
      }
    >
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <Icon name="receipt-2" size={24} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-xl font-semibold text-foreground">{t("zatca.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("zatca.meta", { n: units.length })}</p>
        </div>
        {expiring.length ? <StatusBadge tone="warning">{t("zatca.expiringN", { n: expiring.length })}</StatusBadge> : <StatusBadge tone="success">{t("zatca.allOk")}</StatusBadge>}
      </section>

      {soonest && <Note tone="warning">{t("zatca.note", { branch: branchName(soonest.branch), date: day(soonest.certUntil) })}</Note>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          [t("zatca.today"), n(total), undefined],
          [t("zatca.cleared"), n(ZATCA_TODAY.cleared), t("zatca.clearedHint")],
          [t("zatca.reported"), n(ZATCA_TODAY.reported), t("zatca.reportedHint")],
          [t("zatca.rejected"), n(ZATCA_TODAY.rejected), undefined],
        ].map(([label, value, hint]) => (
          <div key={label} className="flex flex-col gap-1 rounded-lg bg-muted/70 px-3 py-3">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-lg font-semibold text-foreground tabular-nums">{value}</span>
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          </div>
        ))}
      </div>

      <SetCard title={t("zatca.units")} sub={t("zatca.unitsSub")}>
        <div className="hidden overflow-hidden rounded-lg border xl:block">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="w-[34%] px-4 py-3 text-start font-normal">{t("branches.colBranch")}</th>
                <th className="w-[18%] px-3 py-3 text-start font-normal">{t("zatca.unit")}</th>
                <th className="w-[20%] px-3 py-3 text-start font-normal">{t("zatca.until")}</th>
                <th className="w-[10%] px-3 py-3 text-start font-normal">{t("zatca.todayCol")}</th>
                <th className="px-3 py-3 text-start font-normal">{t("branches.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const warn = expiring.includes(u)
                return (
                  <tr key={u.unit} className="border-t">
                    <td className="px-4 py-2.5 text-foreground">{branchName(u.branch)}</td>
                    <td className="px-3 py-2.5 text-xs text-foreground">{l(u.unit)}</td>
                    <td className={warn ? "px-3 py-2.5 text-warning-soft-foreground" : "px-3 py-2.5 text-foreground"}>{longDay(u.certUntil)}</td>
                    <td className="px-3 py-2.5 text-foreground tabular-nums">{n(u.today)}</td>
                    <td className="px-3 py-2.5">{warn ? <StatusBadge tone="warning">{t("zatca.renewNow")}</StatusBadge> : <StatusBadge tone="success">{t("zatca.ok")}</StatusBadge>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <ul className="flex flex-col divide-y xl:hidden">
          {units.map((u) => {
            const warn = expiring.includes(u)
            return (
              <li key={u.unit} className="flex items-center gap-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <Icon name="receipt-2" size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm text-foreground">{branchName(u.branch)}</span>
                  <span className="text-xs text-muted-foreground">{t("zatca.unitLine", { unit: l(u.unit), date: longDay(u.certUntil) })}</span>
                  {warn ? <StatusBadge tone="warning">{t("zatca.renewNow")}</StatusBadge> : <StatusBadge tone="success">{t("zatca.ok")}</StatusBadge>}
                </span>
              </li>
            )
          })}
        </ul>
        {edit && soonest && (
          <Button className="w-full md:w-fit" onClick={() => setRenewing(soonest)}>
            {t("zatca.renewBranch", { branch: branchName(soonest.branch) })}
          </Button>
        )}
      </SetCard>

      <SetCard title={t("zatca.warnings")} sub={t("zatca.warningsSub")}>
        <ul className="flex flex-col divide-y">
          {ZATCA_WARNINGS.map((w) => (
            <li key={w.invoice} className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning-soft-foreground">
                <Icon name="danger" size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-foreground">
                  {b(w.what)} ·{" "}
                  {invoiceOk ? (
                    <Link href={invoiceHref(w.invoice)} className="text-primary hover:underline">
                      {l(w.invoice)}
                    </Link>
                  ) : (
                    l(w.invoice)
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {l(w.rule)} · {w.at.slice(0, 10) === SET_TODAY ? l(w.at.slice(11, 16)) : x.ago(w.at)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </SetCard>
      {renewing && <RenewDialog unit={renewing} branch={branchName(renewing.branch)} onOpenChange={(o) => !o && setRenewing(null)} />}
    </SettingsFrame>
  )
}

/**
 * Overlay · Renew the ZATCA certificate: unit + expiry, the one-time code from the Fatoora portal (valid 1 hour). Invoices
 * keep working while it renews. → `cert-renewed`.
 */
function RenewDialog({ unit, branch, onOpenChange }: { unit: ZatcaUnit; branch: string; onOpenChange: (o: boolean) => void }) {
  const { t, l, dates } = useUserText()
  const [otp, setOtp] = React.useState("")
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [rejected, setRejected] = React.useState(false)
  const days = daysBetween(SET_TODAY, unit.certUntil)
  const error = !/^\d{6}$/.test(otp) ? t("zatca.errOtp") : rejected ? t("zatca.errOtpRejected") : undefined

  const renew = async () => {
    setTried(true)
    if (!/^\d{6}$/.test(otp) || busy) return
    setBusy(true)
    const r = await zatca.renewCertificate(unit.unit, otp)
    setBusy(false)
    if (!r.ok) {
      setRejected(true)
      return
    }
    const until = nextYear(unit.certUntil)
    renewCert(unit.unit, until)
    writeAudit({ what: { en: `Renewed the ZATCA certificate for ${unit.unit} · valid until ${until}`, ar: `جدّد شهادة زاتكا لـ ${unit.unit} · صالحة لين ${until}` }, where: "integrations" })
    toast.success(t("toasts.certRenewed"), { description: t("toasts.certRenewedText", { branch, date: l(dates.monthYear(until)) }) })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("zatca.renewTitle")}
      description={t("zatca.branchSub", { branch })}
      icon="receipt-2"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          {t("actions.cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void renew()} disabled={busy}>
          {busy ? t("zatca.renewing") : t("zatca.renewBtn")}
        </Button>
      }
    >
      {tried && error && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <KvRows
        boxed
        rows={[
          [t("zatca.unit"), `${l(unit.unit)} · ${branch}`],
          [t("zatca.expires"), t("zatca.expiresValue", { date: l(dates.short(unit.certUntil).replace(/^0/, "")), n: days }), days <= 30 ? "warning" : undefined],
        ]}
      />
      <Field label={t("zatca.otp")} required helper={t("zatca.otpHint")} error={tried ? error : undefined}>
        <Input
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="text-start tracking-widest"
          value={otp}
          onChange={(e) => {
            setOtp(e.target.value.replace(/\D/g, ""))
            setRejected(false)
          }}
          placeholder="000000"
        />
      </Field>
      <Note>{t("zatca.keepsWorking")}</Note>
    </ResponsiveDialog>
  )
}
