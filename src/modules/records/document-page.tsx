"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { pdfDocument, type PdfBlock } from "@/lib/export/pdf"
import { saveBlob } from "@/lib/export/files"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { QrCode } from "@/components/ds/qr-code"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { PageTitle } from "@/components/shell/page-title"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { CENTER, PRESCRIPTIONS, REC_NOW, USERS, drugLabel, drugOf, type RecDocument } from "./data"
import { DOCUMENTS_HREF } from "./href"
import { patientOf } from "./lookup"
import { DocStatusBadge, Latin, Strip, useB } from "./parts"
import { recCan } from "./roles"
import { ME } from "./session"
import { logAccess, saveDocument, useDocument, useEncounter, usePrescriptions, useRecRole } from "./store"

/* ------------------------------------------------------------------ helpers */

/** "To the patient and SABIC HR": who a document goes to, from its shares. */
function useShareList() {
  const t = useTranslations("records.doc")
  const b = useB()
  const locale = useLocale()
  return (d: RecDocument) => {
    const names = (d.shares ?? []).map((s) => (s.to === "patient" ? t("thePatient") : b(s.name)))
    if (!names.length) return t("thePatient")
    return new Intl.ListFormat(locale === "ar" ? "ar" : "en", { type: "conjunction" }).format(names)
  }
}

/** Download PDF (paper and consent): the file is built in the browser, the download is logged → pdf-downloaded. */
function useDownload() {
  const t = useTranslations("records.doc")
  const tk = useTranslations("records.kind")
  const b = useB()
  const locale = useLocale()
  return async (d: RecDocument, what: "paper" | "consent" = "paper") => {
    const p = patientOf(d.patient)
    const name = what === "consent" ? `${d.no}-consent.pdf` : `${d.no}.pdf`
    const blocks: PdfBlock[] = [
      { kind: "brand", title: b(CENTER.name), subtitle: `${b(CENTER.clinic)} · CR ${CENTER.cr} · ${b(CENTER.city)}` },
      { kind: "title", text: what === "consent" ? t("consentFile") : tk(d.kind) },
      { kind: "meta", text: d.no },
      { kind: "kv", rows: [[t("patient"), b(p.name)], [t("mrn"), p.mrn]] },
      ...(what === "paper" ? (d.sections ?? []).map((s): PdfBlock => ({ kind: "note", text: `${t(`section.${s.key}`)}: ${b(s.text)}` })) : []),
      { kind: "note", text: d.verifyCode ? t("verifyLine", { host: CENTER.verifyHost, code: d.verifyCode }) : t("onlyAgreed") },
    ]
    const run = async () => {
      try {
        saveBlob(await pdfDocument(blocks, { dir: locale === "ar" ? "rtl" : "ltr", title: name }), name)
        // Every download is logged (Access log · exported).
        logAccess({ id: `ax-pdf-${d.no}-${Date.now()}`, at: REC_NOW, user: ME, patient: d.patient, action: "export", why: { en: `Downloaded ${d.no}`, ar: `حمّل ${d.no}` }, flag: "normal" })
        toast.success(t("pdfToast"), { description: t("pdfToastText") })
      } catch {
        toast.error(t("pdfFailed"), { description: t("pdfFailedText"), retry: () => void run() })
      }
    }
    await run()
  }
}

/* ------------------------------------------------------------------ paper */

function Info({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

/**
 * Widget / Rec Report (the paper): letterhead + verify QR, title, number, status, info grid (patient, MRN, age, for
 * whom, visit, doctor), the sections the patient agreed to share, signature block (doctor, SCFHS no., e-signed time)
 * + stamp, footer with the verify link + code. Sick leaves, referrals, discharge summaries and sent prescriptions use
 * the same paper with their own fields.
 */
export function DocumentPaper({ d }: { d: RecDocument }) {
  const t = useTranslations("records.doc")
  const tk = useTranslations("records.kind")
  const tb = useTranslations("records.banner")
  const b = useB()
  const locale = useLocale()
  const dates = useDates()
  const e = useEncounter(d.encounter ?? "")
  const rxs = usePrescriptions()
  const p = patientOf(d.patient)
  const doc = USERS[d.doctor]
  const rx = d.kind === "prescription" ? (rxs.find((r) => r.no === d.no) ?? PRESCRIPTIONS.find((r) => r.no === d.no)) : undefined
  const sections = (d.sections ?? []).filter((s) => !(d.kind === "sickLeave" && s.key === "diagnosis" && !d.seha?.showDiagnosis))
  const issued = d.status === "draft" ? t("draftLine", { no: d.no }) : t("issuedLine", { date: dates.short(d.at) })
  return (
    <article aria-label={tk(d.kind)} className="@container/paper flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm @2xl/paper:p-9">
      <header className="flex items-start gap-3 border-b pb-5">
        <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon name="document-text" size={22} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-lg font-semibold text-foreground">{b(CENTER.name)}</span>
          <span className="text-xs text-muted-foreground">
            {b(CENTER.clinic)} · {t("cr")} <Latin>{CENTER.cr}</Latin> · {b(CENTER.city)}
          </span>
        </div>
        {d.verifyCode && d.status !== "draft" && (
          <div className="hidden flex-col items-center gap-1.5 @lg/paper:flex">
            <span className="rounded-lg border bg-muted p-1.5">
              <QrCode value={`https://${CENTER.verifyHost}/${d.verifyCode}`} size={52} quiet={2} label={t("verifyQr", { no: d.no })} />
            </span>
            <span className="text-xs text-muted-foreground">{t("verify")}</span>
          </div>
        )}
      </header>

      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-xl font-semibold text-foreground">{tk(d.kind)}</h2>
          <p className="text-xs text-muted-foreground">
            {d.status === "draft" ? (
              <bdi>{issued}</bdi>
            ) : (
              <>
                <Latin>{d.no}</Latin> · {issued}
              </>
            )}
          </p>
        </div>
        <DocStatusBadge status={d.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 @xl/paper:grid-cols-3">
        <Info label={t("patient")}>{b(p.name)}</Info>
        <Info label={t("mrn")}>
          <Latin>{p.mrn}</Latin>
        </Info>
        <Info label={t("age")}>{t("ageValue", { age: p.age, sex: tb(`sex.${p.sex}`) })}</Info>
        {d.for && <Info label={t("for")}>{b(d.for)}</Info>}
        {e && (
          <Info label={t("visit")}>
            {dates.short(e.at)} · {b(e.clinic)}
          </Info>
        )}
        <Info label={t("doctor")}>{b(doc.name)}</Info>
        {d.seha && (
          <>
            <Info label={t("leaveFrom")}>{dates.short(d.seha.from)}</Info>
            <Info label={t("leaveDays")}>{t("days", { n: d.seha.days })}</Info>
            <Info label={t("sehaRef")}>
              <Latin>{d.seha.ref}</Latin>
            </Info>
            <Info label={t("worksIn")}>{t(`sector.${d.seha.sector}`)}</Info>
          </>
        )}
        {d.referral && (
          <>
            <Info label={t("referTo")}>{b(d.referral.to)}</Info>
            {d.referral.doctor && <Info label={t("referDoctor")}>{b(d.referral.doctor)}</Info>}
            <Info label={t("howSoon")}>{t(`soon.${d.referral.soon}`)}</Info>
          </>
        )}
      </dl>

      {d.seha && !d.seha.showDiagnosis && (
        <Strip tone="info" icon="eye-slash">
          {t("diagnosisHidden")}
        </Strip>
      )}

      {rx && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t("section.medicines")}</span>
          <ul className="flex flex-col gap-1 text-sm text-foreground">
            {rx.lines.map((l) => {
              const dr = drugOf(l.drug)
              return <li key={l.drug}>{dr ? drugLabel(dr, locale) : l.drug}</li>
            })}
          </ul>
          {rx.code && (
            <span className="text-xs text-muted-foreground">
              {t("rxCode")} <Latin>{rx.code}</Latin>
            </span>
          )}
        </div>
      )}
      {!rx && d.kind === "prescription" && <p className="text-sm text-foreground">{b(d.details)}</p>}

      {sections.map((s) => (
        <div key={s.key} className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t(`section.${s.key}`)}</span>
          <p className="text-sm text-foreground">{b(s.text)}</p>
        </div>
      ))}
      {d.referral?.attach && <p className="text-xs text-muted-foreground">{t("attached")}</p>}

      {d.signedAt && (
        <div className="flex items-end gap-4 pt-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm text-foreground">{b(doc.name)}</span>
            <span className="text-xs text-muted-foreground">
              {doc.title ? b(doc.title) : b(doc.role)}
              {doc.scfhs && (
                <>
                  {" · "}
                  {t("scfhs")} <Latin>{doc.scfhs}</Latin>
                </>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("signedLine", { date: dates.short(d.signedAt) })} <span className="tabular-nums">{d.signedAt.slice(11, 16)}</span>
            </span>
          </div>
          <span aria-hidden className="inline-flex size-[88px] shrink-0 items-center justify-center rounded-full border-2 border-primary/70 text-xs text-primary">
            {b(CENTER.short)}
          </span>
        </div>
      )}

      <footer className="flex flex-col gap-1 text-xs text-muted-foreground">
        {d.verifyCode && d.status !== "draft" && (
          <span>
            {t("verifyAt")} <Latin>{CENTER.verifyHost}</Latin> · {t("code")} <Latin>{d.verifyCode}</Latin>
          </span>
        )}
        <span>{t(d.kind === "report" ? "onlyAgreedReport" : "onlyAgreed")}</span>
      </footer>
    </article>
  )
}

/* ------------------------------------------------------------------ side */

function SideCard({ title, subtitle, children, id }: { title: string; subtitle?: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <header className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

/** Widget / Rec Report Side: Shared with (patient, others with link expiry, verified count), Consent file, History. */
export function DocumentSide({ d, onDownload }: { d: RecDocument; onDownload: (what: "consent") => void }) {
  const t = useTranslations("records.doc")
  const b = useB()
  const dates = useDates()
  const shares = d.shares ?? []
  const rows: [React.ReactNode, React.ReactNode, string?][] = shares.map((s) => [
    s.to === "patient" ? t("thePatientCap") : b(s.name),
    s.via === "sms"
      ? s.openedAt
        ? t("smsOpened", { time: s.openedAt.slice(11, 16) })
        : t("smsSent")
      : s.expires
        ? t("linkExpires", { date: dates.dayMonth(s.expires) })
        : t("link"),
    s.via === "sms" && s.openedAt ? "text-success" : undefined,
  ])
  if (d.verified) rows.push([t("verified"), t("verifiedValue", { n: d.verified.count, date: dates.dayMonth(d.verified.last), time: d.verified.last.slice(11, 16) })])
  return (
    <div className="flex flex-col gap-4">
      <SideCard id="doc-shared" title={t("sharedWith")} subtitle={d.consent ? t("agreedOn", { date: dates.dayMonth(d.consent.at) }) : undefined}>
        {rows.length ? (
          <dl className="flex flex-col">
            {rows.map(([k, v, cls], i) => (
              <div key={i} className="flex items-start gap-3 border-b py-3.5 last:border-b-0">
                <dt className="w-[130px] shrink-0 pt-0.5 text-xs text-muted-foreground">{k}</dt>
                <dd className={cn("min-w-0 flex-1 text-sm text-foreground", cls)}>{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t("notShared")}</p>
        )}
      </SideCard>
      {d.consent && (
        <SideCard id="doc-consent" title={t("consent")}>
          <div className="flex items-center gap-3 py-2">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              <Icon name="document-text" size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm text-foreground">{t("consentSigned")}</span>
              <span className="text-xs text-muted-foreground">{t(d.consent.via === "nafath" ? "consentNafath" : "consentForm", { date: dates.dayMonth(d.consent.at) })}</span>
            </span>
            <Button variant="ghost" size="icon" onClick={() => onDownload("consent")} aria-label={t("downloadConsent")}>
              <Icon name="document-download" size={24} />
            </Button>
          </div>
        </SideCard>
      )}
      {d.history && d.history.length > 0 && (
        <SideCard id="doc-history" title={t("history")}>
          <ol className="flex flex-col gap-3 py-1">
            {d.history.map((h, i) => (
              <li key={i} className="flex gap-4 text-xs">
                <span className="w-10 shrink-0 text-muted-foreground tabular-nums">{h.at.slice(11, 16)}</span>
                <span className="text-foreground">{b(h.text)}</span>
              </li>
            ))}
          </ol>
        </SideCard>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ page */

/**
 * Medical report (`/records/documents/report?no=MR-2611-0057`): header Back · "Medical records / Documents" over
 * "MR-2611-0057 · Abdulaziz Al-Khaldi"; Download PDF · Send again (a draft: Sign and send). The paper beside the side
 * cards (stacked below 1056 px of content). Mobile: Back · "Medical report" · ⋯, and the two actions above the paper.
 */
export function DocumentPage() {
  const t = useTranslations("records.doc")
  const tk = useTranslations("records.kind")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.records")
  const b = useB()
  const role = useRecRole()
  const no = useSearchParams().get("no") ?? ""
  const d = useDocument(no)
  const download = useDownload()
  const shareList = useShareList()
  const [busy, setBusy] = React.useState(false)

  if (!d) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="document-text"
            title={t("notFound")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={DOCUMENTS_HREF}>
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

  const p = patientOf(d.patient)
  const mine = d.doctor === ME && recCan(role, "documents")
  const canSend = mine && d.status !== "expired"
  const draft = d.status === "draft"

  /** Send again (or the first send of a draft): links go out again, the history and the shares follow. */
  const send = async () => {
    if (busy) return
    setBusy(true)
    await new Promise((r) => setTimeout(r, 300))
    const shares = d.shares?.length ? d.shares : [{ to: "patient" as const, name: { en: "Patient", ar: "المريض" }, via: "sms" as const }]
    const to = shareList({ ...d, shares })
    const text = draft ? { en: "Signed and sent to the patient", ar: "انوقّع وانرسل للمريض" } : { en: "Sent again", ar: "انرسل مرة ثانية" }
    saveDocument({
      ...d,
      status: draft ? (d.kind === "report" ? "sent" : "issued") : d.status,
      details: draft && d.kind === "report" ? { en: "For the patient · 1 page", ar: "للمريض · صفحة وحدة" } : d.details,
      signedAt: d.signedAt ?? REC_NOW,
      shares,
      history: [...(d.history ?? []), { at: REC_NOW, text }],
    })
    setBusy(false)
    toast.success(t(draft ? "sentToast" : d.kind === "report" ? "sentAgainReport" : "sentAgainToast"), { description: t("sentToastText", { to }) })
  }

  const actions = (
    <>
      <Button variant="outline" onClick={() => void download(d)}>
        <Icon name="document-download" size={24} />
        {t("download")}
      </Button>
      {canSend && (
        <Button onClick={() => void send()} disabled={busy}>
          <Icon name="send-2" size={20} />
          {t(draft ? "signSend" : "sendAgain")}
        </Button>
      )}
    </>
  )

  return (
    <>
      <PageTitle
        title={t("title", { no: d.no, name: b(p.name) })}
        crumbs={[
          { label: tn("records"), href: "/records" },
          { label: tt("documents"), href: DOCUMENTS_HREF },
        ]}
        back={DOCUMENTS_HREF}
      />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={DOCUMENTS_HREF} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{tk(d.kind)}</h1>
        <ActionMenu
          title={d.no}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[[{ key: "print", icon: "printer", label: t("print"), onSelect: () => window.print() }]]}
        />
      </div>
      <PageContainer className="@container/dp">
        <PageHeader actions={actions} />
        <div className="grid gap-4 @[66rem]/dp:grid-cols-[minmax(0,1fr)_360px] @[66rem]/dp:items-start @[66rem]/dp:gap-6">
          <DocumentPaper d={d} />
          <DocumentSide d={d} onDownload={() => void download(d, "consent")} />
        </div>
      </PageContainer>
    </>
  )
}
