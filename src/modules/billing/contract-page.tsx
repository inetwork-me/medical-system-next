"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { CENTER, STAFF, userById, type BillDocument, type Contract, type ContractEvent, type Signer } from "./data"
import { CONTRACTS_HREF } from "./href"
import { FactRow } from "./insurers"
import { formatMoney } from "./money"
import { ContractStatusBadge, InitialsAvatar, SignerBadge, ltrRun } from "./parts"
import { billCan } from "./roles"
import { contractStatus, daysLeft, idTail, maskId, monthlyPay, nextSigner, ordered, signedCount } from "./rules"
import { SignDialog } from "./sign-dialog"
import { clausesOf } from "./templates"
import { visibleContracts } from "./contracts"
import { useBillRole, useContract } from "./store"
import { useBillUser } from "./session"
import { useBillText } from "./text"

const timeOf = (iso: string) => iso.slice(11, 16)

/**
 * The signed-in user signs now when the next signer in order is them (a center signature assigned to their user id),
 * they're an authorized signatory and their role may sign.
 */
export function useMyTurn(c: Contract | undefined) {
  const role = useBillRole()
  const me = useBillUser()
  if (!c || !me) return false
  const next = nextSigner(c)
  return !!next && next.side === "center" && next.userId === me.id && me.signatory && c.sent && !c.locked && billCan(role, "sign")
}

/* ------------------------------------------------------------------ paper */

function PartyBox({ label, name, lines }: { label: string; name: React.ReactNode; lines: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[10px] bg-muted p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{name}</span>
      <span className="text-xs text-muted-foreground">{lines}</span>
    </div>
  )
}

function SignatureBox({ label, s, yourTurn }: { label: string; s: Signer; yourTurn: boolean }) {
  const t = useTranslations("billing.contract.box")
  const { b, date } = useBillText()
  const signed = s.status === "signed"
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-[10px] border p-3",
        signed ? "border-success bg-success-soft" : yourTurn ? "border-dashed border-primary bg-accent" : "border-dashed bg-card"
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">
        {b(s.name)}
        {s.side === "center" && ` · ${b(s.role)}`}
      </span>
      <span className={cn("inline-flex items-center gap-1.5 text-xs", signed ? "text-success" : yourTurn ? "text-primary" : "text-muted-foreground")}>
        <Icon name={signed ? "tick-circle" : "edit-2"} size={16} />
        {signed && s.signedAt
          ? t("signed", { date: date(s.signedAt), time: timeOf(s.signedAt), female: s.female ? "yes" : "no" })
          : yourTurn
            ? t("yourTurn")
            : t("waiting")}
      </span>
    </div>
  )
}

/**
 * Widget / Bill Contract — the contract paper (prints on A4): letterhead, title, no. + version, status; first party
 * (the center + its representative) and second party (employee with SCFHS no. and the national ID masked to its last
 * 3 digits, or the company with its CR); numbered clauses; signature boxes (signed = success with time + Nafath, your
 * turn = dashed primary); the verify line.
 */
export function ContractPaper({ c, className }: { c: Contract; className?: string }) {
  const t = useTranslations("billing.contract")
  const { b, date } = useBillText()
  const myTurn = useMyTurn(c)
  const status = contractStatus(c)
  const p = c.party
  const center = c.signers.find((s) => s.side === "center")
  const party = c.signers.find((s) => s.side === "party")
  // The center is represented by the user who signs for it on this contract.
  const rep = userById(center?.userId) ?? STAFF[CENTER.signatory]
  const idText = p.nationalId
    ? p.licence
      ? t("employeeIds", { id: ltrRun(maskId(p.nationalId)), tail: ltrRun(idTail(p.nationalId)), licence: ltrRun(p.licence.no) })
      : t("employeeId", { id: ltrRun(maskId(p.nationalId)), tail: ltrRun(idTail(p.nationalId)) })
    : t("companyIds", { cr: ltrRun(p.cr ?? "—"), city: p.city ? b(p.city) : b(CENTER.city) })
  const next = nextSigner(c)
  return (
    <article data-bill-paper aria-label={t(`kindTitle.${c.kind}`)} className={cn("@container/paper rounded-lg border bg-card shadow-md", className)}>
      <div className="flex flex-col gap-5 p-4 @xl/paper:p-9">
        <header className="flex items-start gap-3">
          <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-accent text-primary">
            <Icon name="document-text" size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-lg font-semibold text-foreground">{b(CENTER.name)}</p>
            <p className="text-xs text-muted-foreground">
              <bdi>{t("letterhead", { cr: ltrRun(CENTER.cr), city: b(CENTER.city), email: ltrRun(c.kind === "staff" ? CENTER.hrEmail : CENTER.billingEmail) })}</bdi>
            </p>
          </div>
        </header>

        <div aria-hidden className="h-px bg-border" />

        <div className="flex flex-col items-start gap-2 @xl/paper:flex-row @xl/paper:gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-xl font-semibold text-foreground">{t(`kindTitle.${c.kind}`)}</h2>
            <p className="text-xs text-muted-foreground">
              <bdi>{t("meta", { no: ltrRun(c.no), date: date(c.draftedAt), v: c.version })}</bdi>
            </p>
          </div>
          <ContractStatusBadge status={status} days={daysLeft(c.end)} label={t(`paperStatus.${myTurn || status !== "awaitingYou" ? status : "awaitingThem"}`, { n: daysLeft(c.end) })} />
        </div>

        <div className="grid gap-3 @xl/paper:grid-cols-2">
          <PartyBox
            label={c.kind === "staff" ? t("firstRole") : t("firstRoleCompany")}
            name={b(CENTER.name)}
            lines={t("represented", { name: b(rep.name), role: b(rep.role) })}
          />
          <PartyBox label={t(`secondRole.${c.kind}`, { female: p.female ? "yes" : "no" })} name={b(p.name)} lines={<bdi>{idText}</bdi>} />
        </div>

        <ol className="flex flex-col gap-4">
          {clausesOf(c).map((x, i) => (
            <li key={x.key} className="flex flex-col gap-1 text-sm text-foreground">
              <span>{t("clause", { n: i + 1, title: b(x.title) })}</span>
              <span>{b(x.text)}</span>
            </li>
          ))}
        </ol>

        <div className="grid gap-3 @xl/paper:grid-cols-2">
          {center && <SignatureBox label={t("firstParty")} s={center} yourTurn={myTurn && next?.order === center.order} />}
          {party && <SignatureBox label={t("secondParty")} s={party} yourTurn={false} />}
        </div>

        <p className="text-xs text-muted-foreground">
          <bdi>{t("verify", { pages: c.pages, url: ltrRun(CENTER.verifyUrl), code: ltrRun(c.verifyCode) })}</bdi>
        </p>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ side */

function Card({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 @3xl/cp:p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  )
}

function useEventText() {
  const t = useTranslations("billing.contract")
  const { b } = useBillText()
  return (c: Contract, e: ContractEvent) => {
    if (e.text) return b(e.text)
    switch (e.kind) {
      case "signed":
        return t("event.signed", { name: e.who ? b(e.who) : "" })
      case "locked":
        return t("event.locked")
      case "copies":
        return t("event.copies", { to: t(`copiesTo.${c.kind}`, { party: e.who ? b(e.who) : "" }) })
      case "filed":
        return t("event.filed", { place: t(`filedIn.${c.kind}`) })
      case "drafted":
        return t("event.drafted", { name: e.who ? b(e.who) : "" })
      case "sent":
        return t("event.sent", { name: e.who ? b(e.who) : "" })
      default:
        return ""
    }
  }
}

function fileMetaKey(f: BillDocument) {
  return f.pages ? "pages" : f.validTo ? "ends" : "plain"
}

/**
 * Widget / Bill Contract Side: Signatures (progress, ordered signers, Sign with Nafath), Details, Attached files,
 * Activity.
 */
export function ContractSide({ c, onSign }: { c: Contract; onSign?: () => void }) {
  const t = useTranslations("billing.contract")
  const tk = useTranslations("billing.kind")
  const { b, date, locale } = useBillText()
  const dates = useDates()
  const myTurn = useMyTurn(c)
  const me = useBillUser()
  const eventText = useEventText()
  const signed = signedCount(c)
  const total = c.signers.length
  const next = nextSigner(c)
  const tp = useTranslations("billing.pdf")
  const download = () => toast.success(tp("done"), { description: tp("doneText") })
  const by = STAFF[c.draftedBy]

  return (
    <div className="flex flex-col gap-4 @3xl/cp:gap-6">
      <Card title={t("signatures")} description={t("signaturesText", { n: signed, total })}>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={signed}>
          <div className="h-full rounded-full bg-success" style={{ width: `${(signed / total) * 100}%` }} />
        </div>
        <ol className="flex flex-col">
          {ordered(c).map((s) => {
            const mine = myTurn && next?.order === s.order
            return (
              <li key={s.order} className="flex items-center gap-2.5 border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
                <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  {s.order}
                </span>
                <InitialsAvatar initials={s.initials} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-foreground">{b(s.name)}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.status === "signed" && s.signedAt
                      ? t("signerSigned", { role: b(s.role), date: dates.dayMonth(s.signedAt), time: timeOf(s.signedAt) })
                      : s.side === "center" && s.userId === me?.id
                        ? t("you", { role: b(s.role) })
                        : b(s.role)}
                  </span>
                </div>
                <SignerBadge signer={s} yourTurn={mine} />
              </li>
            )
          })}
        </ol>
        {myTurn && onSign && (
          <Button className="w-full" onClick={onSign}>
            <Icon name="finger-scan" size={24} />
            {t("signNafath")}
          </Button>
        )}
      </Card>

      <Card title={t("details")}>
        <div className="flex flex-col">
          <FactRow label={t("d.type")}>{t("d.typeValue", { kind: tk(c.kind), detail: b(c.kindDetail) })}</FactRow>
          {c.department && <FactRow label={t("d.department")}>{b(c.department)}</FactRow>}
          <FactRow label={t("d.starts")}>{date(c.start)}</FactRow>
          <FactRow label={t("d.ends")}>{c.autoRenew ? t("d.endsRenews", { date: date(c.end) }) : date(c.end)}</FactRow>
          {c.terms.staff && <FactRow label={t("d.pay")}>{t("d.payValue", { amount: formatMoney(monthlyPay(c.terms.staff), locale, { whole: true }) })}</FactRow>}
          {c.terms.partner && <FactRow label={t("d.pricing")}>{b(c.terms.partner.pricing)}</FactRow>}
          {c.terms.insurer && (
            <FactRow label={t("d.discount")}>
              <bdi>{ltrRun(`${c.terms.insurer.discountPct}%`)}</bdi>
            </FactRow>
          )}
          <FactRow label={t("d.preparedBy")} last>
            {t("d.preparedValue", { name: b(by.name), role: b(by.role) })}
          </FactRow>
        </div>
      </Card>

      <Card title={t("attached")}>
        {c.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noFiles")}</p>
        ) : (
          <ul className="flex flex-col">
            {c.files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
                <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon name="document-text" size={20} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm text-foreground">{b(f.title)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`fileMeta.${fileMetaKey(f)}`, { format: f.format, n: f.pages ?? 0, year: f.validTo?.slice(0, 4) ?? "" })}
                  </span>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={download} aria-label={t("downloadFile", { name: b(f.title) })}>
                  <Icon name="document-download" size={24} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("activity")}>
        {c.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {c.events.map((e, i) => (
              <li key={i} className="flex gap-2.5 text-xs">
                <span className="w-16 shrink-0 text-muted-foreground tabular-nums">{dates.dayMonth(e.at)}</span>
                <span className="min-w-0 flex-1 text-foreground">{eventText(c, e)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ page */

function MobileBar({ c, onDownload, onSign }: { c: Contract; onDownload: () => void; onSign?: () => void }) {
  const t = useTranslations("billing.contract")
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href={CONTRACTS_HREF} aria-label={t("back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
      <ActionMenu
        title={c.no}
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("more")}>
            <Icon name="more" size={20} />
          </Button>
        }
        groups={[
          [
            { key: "download", icon: "document-download", label: t("download"), onSelect: onDownload },
            { key: "print", icon: "printer", label: t("print"), onSelect: () => window.print() },
            ...(onSign ? [{ key: "sign", icon: "finger-scan" as const, label: t("signNafath"), onSelect: onSign }] : []),
          ],
        ]}
      />
    </div>
  )
}

/**
 * Contract page (`/billing/contracts/contract?no=CTR-26-031`): header Back · "Billing / Contracts" over
 * "CTR-26-031 · Dr. Lama Al-Saud"; actions Download PDF · Sign with Nafath (your turn only). Desktop: paper beside the
 * side column; tablet: paper, then the side column; mobile: the side column first, then the paper (as drawn).
 * Doctors open only their own contract.
 */
export function ContractPage() {
  const t = useTranslations("billing.contract")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.billing")
  const tp = useTranslations("billing.pdf")
  const { b } = useBillText()
  const role = useBillRole()
  const found = useContract(useSearchParams().get("no") ?? "")
  const c = found && visibleContracts([found], role).length ? found : undefined
  const myTurn = useMyTurn(c)
  const [signing, setSigning] = React.useState(false)
  const download = () => toast.success(tp("done"), { description: tp("doneText") })

  if (!c) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="note-2"
            title={t("notFound")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={CONTRACTS_HREF}>
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

  const sign = myTurn ? () => setSigning(true) : undefined
  return (
    <>
      <PageTitle
        title={t("title", { no: c.no, name: b(c.party.name) })}
        crumbs={[
          { label: tn("billing"), href: "/billing" },
          { label: tt("contracts"), href: CONTRACTS_HREF },
        ]}
        back={CONTRACTS_HREF}
      />
      <MobileBar c={c} onDownload={download} onSign={sign} />
      <PageContainer className="@container/cp">
        <PageHeader
          actions={
            <>
              <Button variant="outline" className="min-w-0 max-md:gap-1.5 max-md:px-2.5!" onClick={download}>
                <Icon name="document-download" size={24} />
                <span className="truncate">{t("download")}</span>
              </Button>
              {sign && (
                <Button className="min-w-0 max-md:gap-1.5 max-md:px-2.5!" onClick={sign}>
                  <Icon name="finger-scan" size={24} />
                  <span className="truncate">{t("signNafath")}</span>
                </Button>
              )}
            </>
          }
        />
        <div className="grid gap-4 @[68rem]/cp:grid-cols-[minmax(0,1fr)_360px] @[68rem]/cp:items-start @[68rem]/cp:gap-6">
          <ContractPaper c={c} className="order-2 md:order-1" />
          <div className="order-1 md:order-2">
            <ContractSide c={c} onSign={sign} />
          </div>
        </div>
      </PageContainer>
      {signing && <SignDialog contractNo={c.no} onOpenChange={setSigning} />}
    </>
  )
}
