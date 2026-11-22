"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isTabEnabled } from "@/lib/modules"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { BILL_NOW, BILL_TODAY, type BillDocument, type Insurer, type InsurerClass } from "./data"
import { claimsHref, INSURERS_HREF } from "./href"
import { FactRow } from "./insurers"
import { formatMoney, num, useMoney } from "./money"
import { DocStatusBadge, InitialsTile, InsurerStatusBadge, Latin, ltrRun } from "./parts"
import { billCan } from "./roles"
import { daysLeft, docStatus, insurerStatus } from "./rules"
import { getInsurer, saveInsurer, useBillRole, useInsurer } from "./store"
import { useBillText } from "./text"
import { currentUser } from "./session"

const pct = (n: number) => ltrRun(`${n}%`)

/** "VIP, A, B, C" / "B and C" — "VIP و A و B و C" / "B و C". */
function useClassList() {
  const locale = useLocale()
  return (xs: InsurerClass[], and = false) => {
    if (locale === "ar") return xs.map(ltrRun).join(" و ")
    if (!and || xs.length < 2) return xs.join(", ")
    return `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`
  }
}

function Card({ title, description, action, children, className }: { title: string; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border bg-card p-4 @3xl/ins:p-5", className)}>
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub: React.ReactNode; tone?: "warning" | "success" | "destructive" }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[10px] bg-muted p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground tabular-nums">{value}</span>
      <span className={cn("text-xs", tone === "warning" ? "text-warning-soft-foreground" : tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-muted-foreground")}>{sub}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ header */

/**
 * Widget / Bill Insurer Header: initials tile, name, agreement no. + since, classes · branches, tags (status, Until …);
 * tiles: owed to us (+ claims over the payment days), claims this month, approved % vs target, pay days vs agreement.
 */
export function InsurerHeader({ ins }: { ins: Insurer }) {
  const t = useTranslations("billing.insurer")
  const { b, date } = useBillText()
  const money = useMoney()
  const classes = useClassList()
  const s = ins.stats
  const status = insurerStatus(ins)
  const tags = (
    <div className="flex flex-wrap items-center gap-2">
      <InsurerStatusBadge status={status} days={ins.validTo ? daysLeft(ins.validTo) : undefined} />
      {ins.signed && ins.validTo && (
        <span className="inline-flex h-5 items-center gap-1.5 rounded-sm bg-secondary px-2 text-xs font-medium text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground" />
          {t("until", { date: date(ins.validTo) })}
        </span>
      )}
    </div>
  )
  return (
    <section className="@container/ih flex flex-col gap-4 rounded-xl border bg-card p-4 @3xl/ih:p-5">
      <div className="flex items-start gap-4">
        <InitialsTile initials={ins.initials} size={56} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-xl font-semibold text-foreground">{b(ins.name)}</h2>
          <p className="text-sm text-muted-foreground">
            <bdi>
              {ins.signed && ins.validFrom
                ? t("agreement", { no: ltrRun(ins.agreementNo), date: date(ins.validFrom) })
                : t("agreementUnsigned", { no: ltrRun(ins.agreementNo) })}
            </bdi>
          </p>
          <p className="text-xs text-muted-foreground">
            <bdi>{t("classes", { list: classes(ins.classes), branches: t("allBranches") })}</bdi>
          </p>
          <div className="pt-1 @3xl/ih:hidden">{tags}</div>
        </div>
        <div className="hidden shrink-0 @3xl/ih:block">{tags}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 @3xl/ih:grid-cols-4">
        <Tile
          label={t("tile.owed")}
          value={money(s.owed, { whole: true })}
          sub={s.owedOverdueClaims ? t("tile.owedText", { n: s.owedOverdueClaims, days: ins.paymentDays }) : t("tile.owedNone")}
          tone={s.owedOverdueClaims ? "warning" : undefined}
        />
        <Tile label={t("tile.claims")} value={s.claimsThisMonth ? num(s.claimsThisMonth) : t("noData")} sub={s.claimsThisMonthAmount ? money(s.claimsThisMonthAmount, { whole: true }) : t("noData")} />
        <Tile
          label={t("tile.approved")}
          value={s.approvedPct != null ? <bdi>{pct(s.approvedPct)}</bdi> : t("noData")}
          sub={s.targetPct != null ? <bdi>{t("tile.target", { pct: pct(s.targetPct) })}</bdi> : t("noData")}
          tone={s.approvedPct != null && s.targetPct != null ? (s.approvedPct >= s.targetPct ? "success" : "destructive") : undefined}
        />
        <Tile
          label={t("tile.payIn")}
          value={s.paysInDays != null ? t("tile.payInValue", { n: s.paysInDays }) : t("noData")}
          sub={t("tile.agreementSays", { n: ins.paymentDays })}
          tone={s.paysInDays != null ? (s.paysInDays <= ins.paymentDays ? "success" : "destructive") : undefined}
        />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ terms + papers */

/** Download (toast-only): the paper's file, then pdf-downloaded. */
function useDownload() {
  const t = useTranslations("billing")
  return () => toast.success(t("pdf.done"), { description: t("pdf.doneText") })
}

/** Upload document (toast-only flow): pick a file → kept with the agreement as "being checked" → document-uploaded. */
export function useUploadDocument(insurerId: string) {
  const t = useTranslations("billing.insurer")
  const input = React.useRef<HTMLInputElement>(null)
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    const ins = getInsurer(insurerId)
    if (!f || !ins) return
    const ext = (f.name.split(".").pop() ?? "pdf").toUpperCase()
    const doc: BillDocument = {
      id: `${insurerId}-${Date.now()}`,
      kind: "other",
      title: { en: f.name.replace(/\.[^.]+$/, ""), ar: f.name.replace(/\.[^.]+$/, "") },
      file: f.name,
      format: ext === "XLSX" || ext === "XLS" ? "XLSX" : ext === "DOCX" || ext === "DOC" ? "DOCX" : "PDF",
      status: "checking",
      uploadedBy: currentUser()?.id ?? "session",
      uploadedAt: BILL_NOW,
      version: 1,
    }
    saveInsurer({ ...ins, documents: [...ins.documents, doc] })
    toast.success(t("uploaded"), { description: t("uploadedText") })
  }
  const field = <input ref={input} type="file" hidden accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.png" onChange={onChange} />
  return { open: () => input.current?.click(), field }
}

/** Widget / Bill Insurer Terms: Agreement terms (6 rows) and Papers (status, download, Upload). */
export function InsurerTerms({ ins, onUpload }: { ins: Insurer; onUpload?: () => void }) {
  const t = useTranslations("billing.insurer")
  const { b, insurerShort, locale, date } = useBillText()
  const dates = useDates()
  const classes = useClassList()
  const download = useDownload()
  const role = useBillRole()
  const sar = (n: number) => formatMoney(n, locale, { whole: true })
  const c = ins.copay
  const r = ins.preauthRule
  const preauth = r.above != null && r.imaging ? t("terms.preauthBoth", { amount: sar(r.above) }) : r.above != null ? t("terms.preauthAmount", { amount: sar(r.above) }) : r.imaging ? t("terms.preauthImaging") : t("terms.preauthNone")

  const meta = (d: BillDocument) => {
    const parts: string[] = [d.format]
    if (d.pages) parts.push(t("papers.pages", { n: d.pages }))
    if (d.detail) parts.push(b(d.detail))
    if (d.signedVia) parts.push(t("papers.signed", { date: date(d.signedVia.at) }))
    else if (d.validTo) parts.push(t("papers.ends", { date: date(d.validTo) }))
    if (d.uploadedAt && d.status === "checking") parts.push(t("papers.uploadedBy", { date: dates.dayMonth(d.uploadedAt) }))
    return parts.join(" · ")
  }

  return (
    <div className="flex flex-col gap-4 @3xl/ins:gap-6">
      <Card title={t("terms.title")} description={t("terms.text", { insurer: insurerShort(ins.id) })}>
        <div className="flex flex-col">
          <FactRow label={t("terms.discount")}>
            <bdi>{pct(ins.discountPct)}</bdi>
          </FactRow>
          <FactRow label={t("terms.copay")}>
            <bdi>
              {c.capPerVisit != null
                ? t("terms.copayValue", { pct: pct(c.pct), cap: sar(c.capPerVisit), classes: classes(c.classes, true) })
                : t("terms.copayNoCap", { pct: pct(c.pct), classes: classes(c.classes, true) })}
            </bdi>
          </FactRow>
          <FactRow label={t("terms.preauth")}>{preauth}</FactRow>
          <FactRow label={t("terms.deadline")}>{t("terms.deadlineValue", { n: ins.claimDeadlineDays })}</FactRow>
          <FactRow label={t("terms.payment")}>{t("terms.paymentValue", { n: ins.paymentDays })}</FactRow>
          <FactRow label={t("terms.notice")} last>
            {t("terms.noticeValue", { n: ins.noticeDays })}
          </FactRow>
        </div>
      </Card>

      <Card
        title={t("papers.title")}
        description={t("papers.text", { n: ins.documents.length })}
        action={
          onUpload && billCan(role, "upload") ? (
            <Button variant="ghost" size="sm" onClick={onUpload}>
              <Icon name="document-upload" size={24} />
              {t("papers.upload")}
            </Button>
          ) : undefined
        }
      >
        {ins.documents.length === 0 ? (
          <EmptyState icon="document-text" title={t("papers.empty")} description={t("papers.emptyText")} className="py-8" />
        ) : (
          <ul className="flex flex-col">
            {ins.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
                <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon name="document-text" size={20} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm text-foreground">{b(d.title)}</span>
                  <span className="text-xs text-muted-foreground">{meta(d)}</span>
                </div>
                <DocStatusBadge status={docStatus(d)} kind={d.kind} validTo={d.validTo} />
                <Button variant="ghost" size="icon-sm" onClick={download} aria-label={t("papers.download", { name: b(d.title) })}>
                  <Icon name="document-download" size={24} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ side */

/** Widget / Bill Insurer Side: claims bars for the last 6 months (this month highlighted), the split, View claims; Who to call. */
export function InsurerSide({ ins }: { ins: Insurer }) {
  const t = useTranslations("billing.insurer")
  const tb = useTranslations("billing")
  const { insurerShort, b } = useBillText()
  const months = tb("monthsShort").split(",")
  const m = Number(BILL_TODAY.slice(5, 7)) - 1
  const labels = Array.from({ length: 6 }, (_, i) => months[(m - 5 + i + 12) % 12])
  const s = ins.stats
  const max = 300
  const hasClaims = s.months.some((v) => v > 0)
  return (
    <div className="flex flex-col gap-4 @3xl/ins:gap-6">
      <Card title={t("chart.title")} description={t("chart.text")}>
        {hasClaims ? (
          <div className="flex gap-3">
            <div className="flex h-30 w-7 flex-col justify-between text-xs text-muted-foreground tabular-nums">
              {[300, 200, 100, 0].map((v) => (
                <span key={v} className="leading-4">
                  {v}
                </span>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="relative flex h-30 items-end">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} aria-hidden className="absolute inset-x-0 h-px bg-border" style={{ bottom: `${(i * 100) / 4}%` }} />
                ))}
                {s.months.map((v, i) => (
                  <div key={i} className="relative flex h-full flex-1 items-end justify-center">
                    <span
                      className={cn("w-[18px] rounded-t-[4px]", i === 5 ? "bg-primary" : "bg-blue-200 dark:bg-blue-900")}
                      style={{ height: `${Math.min(100, (v / max) * 100)}%` }}
                      title={`${labels[i]} · ${v}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex text-xs text-muted-foreground">
                {labels.map((l, i) => (
                  <span key={i} className="flex-1 text-center">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("chart.empty")}</p>
        )}
        <div className="flex flex-col">
          <FactRow label={t("chart.approved")} tone="success">
            <bdi>{pct(s.split.approved)}</bdi>
          </FactRow>
          <FactRow label={t("chart.part")}>
            <bdi>{pct(s.split.part)}</bdi>
          </FactRow>
          <FactRow label={t("chart.rejected")} tone="destructive" last>
            <bdi>{pct(s.split.rejected)}</bdi>
          </FactRow>
        </div>
        {isTabEnabled("billing", "claims") && (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={claimsHref({ q: b(ins.name) })}>{t("chart.view", { insurer: insurerShort(ins.id) })}</Link>
          </Button>
        )}
      </Card>

      {ins.contacts.length > 0 && (
        <Card title={t("contacts.title")}>
          <ul className="flex flex-col">
            {ins.contacts.map((c, i) => (
              <li key={i} className="flex flex-col gap-0.5 border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
                <span className="text-xs text-muted-foreground">{b(c.role)}</span>
                {c.name && <span className="text-sm text-foreground">{b(c.name)}</span>}
                {c.phone && (
                  <a href={`tel:${c.phone.replace(/\s/g, "")}`} className={cn("w-fit hover:underline", c.name ? "text-xs text-muted-foreground" : "text-sm text-foreground")}>
                    <Latin>{c.phone}</Latin>
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="w-fit text-sm text-foreground hover:underline">
                    <Latin>{c.email}</Latin>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ page */

function MobileBar({ ins, onUpload, onDownload }: { ins: Insurer; onUpload?: () => void; onDownload: () => void }) {
  const t = useTranslations("billing.insurer")
  const { b } = useBillText()
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href={INSURERS_HREF} aria-label={t("back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{b(ins.name)}</h1>
      <ActionMenu
        title={b(ins.name)}
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("more")}>
            <Icon name="more" size={20} />
          </Button>
        }
        groups={[
          [
            { key: "download", icon: "document-download", label: t("download"), onSelect: onDownload },
            ...(onUpload ? [{ key: "upload", icon: "document-upload" as const, label: t("upload"), onSelect: onUpload }] : []),
          ],
        ]}
      />
    </div>
  )
}

/**
 * Insurer page (`/billing/insurers/insurer?id=bupa`): header Back · "Billing / Insurers" over the name; actions
 * Download agreement · Upload document; the header card, then terms + papers beside the claims chart + contacts
 * (stacked below 1120 px of content). Mobile: Back · name · ⋯.
 */
export function InsurerPage() {
  const t = useTranslations("billing.insurer")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.billing")
  const { b } = useBillText()
  const role = useBillRole()
  const id = useSearchParams().get("id") ?? ""
  const ins = useInsurer(id)
  const upload = useUploadDocument(id)
  const download = useDownload()

  if (!ins) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="shield-tick"
            title={t("notFound")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={INSURERS_HREF}>
                  <Icon name="arrow-left" size={16} />
                  {t("backToList")}
                </Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    )
  }

  const canUpload = billCan(role, "upload")
  return (
    <>
      <PageTitle
        title={b(ins.name)}
        crumbs={[
          { label: tn("billing"), href: "/billing" },
          { label: tt("insurers"), href: INSURERS_HREF },
        ]}
        back={INSURERS_HREF}
      />
      <MobileBar ins={ins} onUpload={canUpload ? upload.open : undefined} onDownload={download} />
      {upload.field}
      <PageContainer className="@container/ins">
        <PageHeader
          actions={
            <>
              <Button variant="outline" className="min-w-0 max-md:gap-1.5 max-md:px-2.5!" onClick={download} disabled={!ins.documents.some((d) => d.kind === "agreement")}>
                <Icon name="document-download" size={24} />
                <span className="truncate">{t("download")}</span>
              </Button>
              {canUpload && (
                <Button className="min-w-0 max-md:gap-1.5 max-md:px-2.5!" onClick={upload.open}>
                  <Icon name="document-upload" size={24} />
                  <span className="truncate">{t("upload")}</span>
                </Button>
              )}
            </>
          }
        />
        <InsurerHeader ins={ins} />
        <div className="grid gap-4 @[70rem]/ins:grid-cols-[minmax(0,1fr)_360px] @[70rem]/ins:items-start @[70rem]/ins:gap-6">
          <InsurerTerms ins={ins} onUpload={canUpload ? upload.open : undefined} />
          <InsurerSide ins={ins} />
        </div>
      </PageContainer>
    </>
  )
}
