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
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { PageTitle } from "@/components/shell/page-title"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CENTER, REC_NOW, REQUEST_STEPS, USERS, type CopyPart, type Paper, type RecordsRequest, type RequestStep } from "./data"
import { REQUESTS_HREF } from "./href"
import { patientOf } from "./lookup"
import { Latin, Strip, useB } from "./parts"
import { ReleaseDialog } from "./req-dialogs"
import { useDueText } from "./requests"
import { recCan } from "./roles"
import { canInclude, canRelease, consentBy, copyPages, currentStep, dueIn, dueSoon, isOpenRequest, requestStatus } from "./rules"
import { ME } from "./session"
import { getRequest, logAccess, saveRequest, useRecRole, useRequest } from "./store"

const PARTS: CopyPart[] = ["notes", "labs", "prescriptions", "imaging", "mental"]
/** Pages a part comes to once prepared (stub for the records office's page count). */
const PAGES_STUB: Record<CopyPart, number> = { notes: 6, labs: 4, prescriptions: 2, imaging: 3, mental: 5 }

/* ------------------------------------------------------------------ helpers */

/** Download a paper or the request as a PDF: every page carries the request number; the download is logged. */
function useRequestPdf() {
  const t = useTranslations("records.request")
  const b = useB()
  const locale = useLocale()
  return async (r: RecordsRequest, paper?: Paper) => {
    const p = patientOf(r.patient)
    const name = paper ? `${r.no}-${paper.id}.pdf` : `${r.no}.pdf`
    const blocks: PdfBlock[] = [
      { kind: "brand", title: b(CENTER.name), subtitle: `${b(CENTER.clinic)} · CR ${CENTER.cr} · ${b(CENTER.city)}` },
      { kind: "title", text: paper ? b(paper.name) : t("sideTitle") },
      { kind: "meta", text: t("watermark", { no: r.no }) },
      { kind: "kv", rows: [[t("patient"), `${b(p.name)} · ${p.mrn}`], [t("from"), b(r.requester)], [t("why"), b(r.purpose)]] },
      { kind: "note", text: t("watermark", { no: r.no }) },
    ]
    const run = async () => {
      try {
        saveBlob(await pdfDocument(blocks, { dir: locale === "ar" ? "rtl" : "ltr", title: name }), name)
        logAccess({ id: `ax-req-${r.no}-${Date.now()}`, at: REC_NOW, user: ME, patient: r.patient, action: "export", why: { en: `Request ${r.no}`, ar: `الطلب ${r.no}` }, flag: "normal" })
        toast.success(t("pdfToast"), { description: t("pdfToastText") })
      } catch {
        toast.error(t("pdfFailed"), { description: t("pdfFailedText"), retry: () => void run() })
      }
    }
    await run()
  }
}

function Card({ id, title, subtitle, children, className }: { id: string; title: string; subtitle?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-4 rounded-xl border bg-card p-5 md:p-6", className)}>
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

/* ------------------------------------------------------------------ progress */

/**
 * Progress: Received → Identity checked → Patient consent → Prepared → Doctor review → Released (done = green tick
 * with what happened; the current step = its number). The records office marks the current step done; Released
 * goes through Release records.
 */
export function RequestProgress({ r, onRelease }: { r: RecordsRequest; onRelease?: () => void }) {
  const t = useTranslations("records.request")
  const b = useB()
  const dates = useDates()
  const role = useRecRole()
  const due = useDueText()
  const cur = currentStep(r)
  const done = REQUEST_STEPS.filter((s) => r.steps[s]).length
  const canWork = recCan(role, "requests") && isOpenRequest(r)
  const p = patientOf(r.patient)

  /** Mark the current step done (identity, consent, prepare, doctor review). */
  const markDone = (s: RequestStep) => {
    const x = getRequest(r.no)
    if (!x) return
    const me = b(USERS[ME].name)
    const day = dates.dayMonth(REC_NOW)
    const mk = (en: string, ar: string, act?: { en: string; ar: string }) => ({ at: REC_NOW, text: { en, ar }, activity: act })
    if (s === "identity") return saveRequest({ ...x, steps: { ...x.steps, identity: mk("Checked today", "انتحقق منها اليوم", { en: "Identity checked", ar: "تأكدنا من الهوية" }) } })
    if (s === "consent") {
      // Consent covers what was asked; mental health notes only with a court order; the guardian signs for a minor.
      const covers = r.asked.filter((x2) => x2 !== "mental" || r.courtOrder)
      const who = r.courtOrder ? "court" : consentBy(p)
      const text =
        who === "court"
          ? { en: "Court order on file", ar: "أمر المحكمة موجود" }
          : who === "guardian"
            ? { en: `Guardian signed with Nafath ${day}`, ar: `وقّع ولي الأمر عبر نفاذ ${day}` }
            : { en: `Signed with Nafath ${day}`, ar: `انوقّعت عبر نفاذ ${day}` }
      return saveRequest({ ...x, consentCovers: covers, parts: covers.filter((c) => c !== "mental"), steps: { ...x.steps, consent: { at: REC_NOW, text, activity: text } } })
    }
    if (s === "prepared") {
      const pages = Object.fromEntries(x.parts.map((c) => [c, PAGES_STUB[c]])) as Partial<Record<CopyPart, number>>
      const n = Object.values(pages).reduce((a, v) => a + (v ?? 0), 0)
      return saveRequest({
        ...x,
        pages,
        steps: { ...x.steps, prepared: mk(`${n} pages · ${USERS[ME].name.en}`, `${n} صفحة · ${USERS[ME].name.ar}`, { en: `${n} pages prepared`, ar: `تجهّزت ${n} صفحة` }) },
        papers: [...x.papers.filter((pp) => pp.kind !== "copy"), { id: "copy", kind: "copy", name: { en: "Prepared copy · watermarked", ar: "النسخة الجاهزة · فيها علامة مائية" }, meta: { en: `PDF · ${n} pages`, ar: `PDF · ${n} صفحة` } }],
      })
    }
    if (s === "review")
      return saveRequest({ ...x, steps: { ...x.steps, review: mk(`${USERS[ME].name.en} · nothing removed`, `${USERS[ME].name.ar} · ما انشال شي`, { en: `Reviewed by ${me}`, ar: `راجعه ${me}` }) } })
  }

  return (
    <Card
      id="req-progress"
      title={t("progress")}
      subtitle={r.rejected ? t("rejectedLine", { why: b(r.rejected.why) }) : isOpenRequest(r) ? t("progressText", { n: done, due: due(r).toLocaleLowerCase() }) : t("doneLine")}
    >
      <ol className="flex flex-col gap-3">
        {REQUEST_STEPS.map((s, i) => {
          const d = r.steps[s]
          const isCur = s === cur
          return (
            <li key={s} className="flex items-start gap-3">
              {d ? (
                <Icon name="tick-circle" size={26} variant="bold" className="shrink-0 text-success" />
              ) : (
                <span
                  aria-hidden
                  className={cn("mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums", isCur ? "border-primary text-primary" : "text-muted-foreground")}
                >
                  {i + 1}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn("text-sm", d || isCur ? "text-foreground" : "text-muted-foreground")}>
                  {t(`steps.${s}`)}
                  <span className="sr-only"> · {t(d ? "stepDone" : isCur ? "stepNow" : "stepLater")}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {d ? b(d.text) : isCur ? (s === "released" ? t("dueOn", { date: dates.dayMonth(r.due) }) : t(`waiting.${s}`)) : ""}
                </span>
              </span>
              {isCur && canWork && s !== "released" && (
                <Button variant="ghost" size="sm" onClick={() => markDone(s)}>
                  <Icon name="tick-circle" size={18} />
                  {t("markDone")}
                </Button>
              )}
              {isCur && s === "released" && onRelease && canRelease(r) && recCan(role, "release") && (
                <Button variant="ghost" size="sm" onClick={onRelease}>
                  <Icon name="send-2" size={18} />
                  {t("releaseNow")}
                </Button>
              )}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

/* ------------------------------------------------------------------ copy */

/**
 * What goes in the copy: one checkbox per part with its page count. Nothing outside the consent can be ticked;
 * mental health notes never go without a court order. Locked once released.
 */
export function CopyParts({ r }: { r: RecordsRequest }) {
  const t = useTranslations("records.request")
  const dates = useDates()
  const role = useRecRole()
  const id = React.useId()
  const locked = !isOpenRequest(r) || !recCan(role, "requests")
  const toggle = (part: CopyPart, on: boolean) => {
    const x = getRequest(r.no)
    if (!x || !canInclude(x, part)) return
    saveRequest({ ...x, parts: on ? [...x.parts.filter((p) => p !== part), part] : x.parts.filter((p) => p !== part) })
  }
  const subtitle = !r.steps.consent
    ? t("copyWaiting")
    : r.period
      ? r.period.from.slice(0, 4) === r.period.to.slice(0, 4)
        ? t("copyText", { from: dates.dayMonth(r.period.from), to: dates.dayMonth(r.period.to) })
        : t("copyText", { from: dates.short(r.period.from), to: dates.short(r.period.to) })
      : t("copyTextAll")
  return (
    <Card id="req-copy" title={t("copy")} subtitle={subtitle}>
      <ul className="flex flex-col gap-3">
        {PARTS.map((part) => {
          const ok = canInclude(r, part)
          const pages = r.pages?.[part]
          const detail =
            part === "mental" && !ok
              ? t("mentalNever")
              : !ok
                ? r.steps.consent
                  ? t("notCovered")
                  : t("notYet")
                : part === "notes" && r.visits && pages
                  ? t("visitsPages", { v: r.visits, n: pages })
                  : pages
                    ? t("pages", { n: pages })
                    : t("notPrepared")
          return (
            <li key={part}>
              <label htmlFor={`${id}-${part}`} className={cn("flex items-start gap-2 text-sm", ok && !locked ? "cursor-pointer" : "cursor-default", !ok && "text-muted-foreground")}>
                <Checkbox id={`${id}-${part}`} className="mt-0.5" checked={r.parts.includes(part)} disabled={!ok || locked} onCheckedChange={(v) => toggle(part, v === true)} />
                <span className={cn(ok ? "text-foreground" : "text-foreground/80")}>
                  {t(`parts.${part}`)} · {detail}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {r.steps.prepared && isOpenRequest(r) && (
        <p className="text-xs text-muted-foreground">{t("copyTotal", { n: copyPages(r) })}</p>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ papers + side */

export function RequestPapers({ r, onDownload }: { r: RecordsRequest; onDownload: (p: Paper) => void }) {
  const t = useTranslations("records.request")
  const b = useB()
  return (
    <Card id="req-papers" title={t("papers")}>
      {r.papers.length ? (
        <ul className="flex flex-col">
          {r.papers.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-b py-3 last:border-b-0">
              <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon name="document-text" size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm text-foreground">{b(p.name)}</span>
                <span className="text-xs text-muted-foreground">{b(p.meta)}</span>
              </span>
              <Button variant="ghost" size="icon" onClick={() => onDownload(p)} aria-label={t("downloadPaper", { name: b(p.name) })}>
                <Icon name="document-download" size={24} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noPapers")}</p>
      )}
    </Card>
  )
}

/** Widget / Rec Request Side: Request (patient, from, why, due in amber) and Activity. */
export function RequestSide({ r }: { r: RecordsRequest }) {
  const t = useTranslations("records.request")
  const b = useB()
  const dates = useDates()
  const p = patientOf(r.patient)
  const soon = dueSoon(r)
  const n = dueIn(r)
  const dueText = !isOpenRequest(r) ? dates.dayMonth(r.due) : `${dates.dayMonth(r.due)} · ${n < 0 ? t("late", { n: -n }) : n === 0 ? t("today") : n === 1 ? t("tomorrow") : t("inDays", { n })}`
  const steps = REQUEST_STEPS.filter((s) => r.steps[s])
  const withActivity = steps.filter((s) => r.steps[s]!.activity)
  const activity = (withActivity.length ? withActivity : steps).map((s) => ({ at: r.steps[s]!.at, text: r.steps[s]!.activity ? b(r.steps[s]!.activity!) : `${t(`steps.${s}`)} · ${b(r.steps[s]!.text)}` }))
  if (r.rejected) activity.push({ at: r.rejected.at, text: t("rejectedActivity", { why: b(r.rejected.why) }) })
  const rows: [string, React.ReactNode, string?][] = [
    [t("patient"), <span key="p">{b(p.name)} · <Latin>{p.mrn}</Latin></span>],
    [t("from"), b(r.requester)],
    [t("why"), b(r.purpose)],
    [t("due"), dueText, soon ? "text-warning-soft-foreground" : undefined],
  ]
  if (r.release) rows.push([t("released"), t(`releasedVia.${r.release.via}`, { date: dates.dayMonth(r.release.at) })])
  return (
    <div className="flex flex-col gap-4">
      <Card id="req-side" title={t("sideTitle")} subtitle={<Latin>{r.no}</Latin>}>
        <dl className="flex flex-col">
          {rows.map(([k, v, cls], i) => (
            <div key={i} className="flex items-start gap-3 border-b py-3.5 last:border-b-0">
              <dt className="w-[130px] shrink-0 pt-0.5 text-xs text-muted-foreground">{k}</dt>
              <dd className={cn("min-w-0 flex-1 text-sm text-foreground", cls)}>{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card id="req-activity" title={t("activity")}>
        <ol className="flex flex-col gap-3">
          {activity.map((a, i) => (
            <li key={i} className="flex gap-4 text-xs">
              <span className="w-16 shrink-0 text-muted-foreground">{dates.dayMonth(a.at)}</span>
              <span className="text-foreground">{a.text}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ page */

/**
 * Request (`/records/requests/request?no=REQ-2611-014`): header Back · "Medical records / Requests" over "REQ-2611-014 ·
 * Lina Haddad"; Download PDF · Release records. Main: Progress, What goes in the copy, Papers; side: Request,
 * Activity (first on tablet and mobile). Mobile: Back · "Request" · ⋯, the two actions above the cards.
 */
export function RequestPage() {
  const t = useTranslations("records.request")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.records")
  const b = useB()
  const role = useRecRole()
  const no = useSearchParams().get("no") ?? ""
  const r = useRequest(no)
  const pdf = useRequestPdf()
  const [releasing, setReleasing] = React.useState(false)

  if (!r) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="folder-open"
            title={t("notFound")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={REQUESTS_HREF}>
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

  const p = patientOf(r.patient)
  const status = requestStatus(r)
  const showRelease = recCan(role, "release") && isOpenRequest(r)
  const actions = (
    <>
      <Button variant="outline" onClick={() => void pdf(r)}>
        <Icon name="document-download" size={24} />
        {t("download")}
      </Button>
      {showRelease && (
        <Button onClick={() => setReleasing(true)} disabled={!canRelease(r)}>
          <Icon name="send-2" size={20} />
          {t("release")}
        </Button>
      )}
    </>
  )

  return (
    <>
      <PageTitle
        title={t("title", { no: r.no, name: b(p.name) })}
        crumbs={[
          { label: tn("records"), href: "/records" },
          { label: tt("requests"), href: REQUESTS_HREF },
        ]}
        back={REQUESTS_HREF}
      />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={REQUESTS_HREF} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
        <ActionMenu
          title={r.no}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[[{ key: "print", icon: "printer", label: t("print"), onSelect: () => window.print() }]]}
        />
      </div>
      <PageContainer className="@container/rq">
        <PageHeader actions={actions} />
        {status === "ready" && !recCan(role, "release") && (
          <Strip tone="info" icon="info-circle">
            {t("readyOther")}
          </Strip>
        )}
        <div className="grid gap-4 @[66rem]/rq:grid-cols-[minmax(0,1fr)_360px] @[66rem]/rq:items-start @[66rem]/rq:gap-6">
          <div className="order-2 flex min-w-0 flex-col gap-4 @[66rem]/rq:order-1">
            <RequestProgress r={r} onRelease={() => setReleasing(true)} />
            <CopyParts r={r} />
            <RequestPapers r={r} onDownload={(paper) => void pdf(r, paper)} />
          </div>
          <div className="order-1 @[66rem]/rq:order-2">
            <RequestSide r={r} />
          </div>
        </div>
      </PageContainer>
      {releasing && <ReleaseDialog requestNo={r.no} onOpenChange={setReleasing} />}
    </>
  )
}
