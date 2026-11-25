"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { isModuleEnabled, isTabEnabled } from "@/lib/modules"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Bi } from "@/lib/mock/bi"
import { patientHref } from "@/modules/patients/href"
import { PATIENTS } from "@/modules/records/data"
import { ME, MSG_NOW, SMS_ACCOUNT, STAFF, TEMPLATES } from "./data"
import { patientThreadHref, templatesHref } from "./href"
import { ChannelIcon, DeliveryBadge, PersonAvatar, useMsgText } from "./parts"
import { patientCounts } from "./rules"
import { clinicalContent, smsParts, smsStub, whatsappStub } from "./services/patient-gateway"
import { MessagePatientDialog } from "./patient-dialogs"
import { markHandled, postPatientMessage, useConsent, useMe, usePatientThreads, useTemplates } from "./store"
import type { Consent, PatientChannel, PatientMessage, PatientThread, Template } from "./types"

/* ------------------------------------------------------------------ patients */

export type RecPt = { initials: string; name: Bi; mrn: string; mobile?: string; sex: "m" | "f"; patientId?: string }
export const recPatients = PATIENTS as unknown as Record<string, RecPt>
/** "+966 50 318 6604" → "0503186604" (Saudi numbers are shown local, no spaces). */
export const localMobile = (m?: string) => (m ? m.replace(/\s+/g, "").replace(/^\+966/, "0") : "")
export const firstNameOf = (n: Bi, lang: "ar" | "en") => (lang === "ar" ? n.ar : n.en).split(" ")[0]

/** Where "Patient file" goes: the patient page, or the Patients list searched by name when there's no file there yet. */
export function patientFileHref(p: RecPt) {
  if (!isModuleEnabled("patients")) return undefined
  return p.patientId ? patientHref(p.patientId) : `/patients?q=${encodeURIComponent(p.name.en)}`
}
/** "Open appointment" → the Appointments day view of that date. */
export const appointmentHref = (iso: string) => (isModuleEnabled("appointments") ? `/appointments?view=day&date=${iso.slice(0, 10)}` : undefined)

/** WhatsApp takes free text only within 24 hours of the patient's last message; otherwise approved templates. */
export function sessionOpen(t?: PatientThread) {
  const lastIn = t ? [...t.messages].reverse().find((m) => m.dir === "in") : undefined
  if (!lastIn) return false
  return new Date(MSG_NOW).getTime() - new Date(lastIn.at).getTime() < 24 * 3600 * 1000
}

/** Fill a patient template in the patient's language from their next appointment. */
export function fillTemplate(tpl: Template, p: RecPt, lang: "ar" | "en", appt: PatientThread["appointment"] | undefined, fmtDate: (iso: string) => string) {
  let text = lang === "ar" ? tpl.text.ar : tpl.text.en
  const doctor = appt ? (lang === "ar" ? appt.doctor.ar : appt.doctor.en) : lang === "ar" ? "الطبيب" : "the doctor"
  text = text
    .replaceAll("{first_name}", firstNameOf(p.name, lang))
    .replaceAll("{clinic}", appt ? (lang === "ar" ? appt.clinic.ar : appt.clinic.en.toLowerCase()) : lang === "ar" ? "العيادة" : "the clinic")
    .replaceAll("{doctor}", doctor)
    .replaceAll("{date}", appt ? fmtDate(appt.at) : "")
    .replaceAll("{time}", appt ? appt.at.slice(11, 16) : "")
  if (tpl.id === "tpl-results") text = text.replace(/\.\s*$/, "") + (lang === "ar" ? ": alnoor.sa/r" : ": alnoor.sa/r")
  return text
}

/* ------------------------------------------------------------------ send */

export type SendPlan = { channel: PatientChannel; note?: "noWhatsapp" | "waTemplateOnly"; error?: "empty" | "clinical" | "noConsent" }

/** What a send will do: the channel it really goes by, or why it can't go. */
export function planSend(text: string, want: PatientChannel, consent: Consent, tpl: Template | undefined, thread?: PatientThread): SendPlan {
  if (!text.trim()) return { channel: want, error: "empty" }
  if (clinicalContent(text)) return { channel: want, error: "clinical" }
  if (!consent.reminders) return { channel: want, error: "noConsent" }
  if (want === "whatsapp" && !consent.whatsapp) return { channel: "sms", note: "noWhatsapp" }
  if (want === "whatsapp" && !sessionOpen(thread) && tpl?.whatsapp?.state !== "approved") return { channel: "sms", note: "waTemplateOnly" }
  return { channel: want }
}

/** Send through the gateway; WhatsApp that isn't delivered goes by SMS when the patient agreed to the fallback. */
export function useSendToPatient() {
  const { t } = useMsgText()
  return async (o: { patient: string; thread?: PatientThread; text: string; plan: SendPlan; template?: string; consent: Consent }) => {
    const p = recPatients[o.patient]
    const to = p.mobile ?? ""
    let channel = o.plan.channel
    let res = channel === "whatsapp" ? await whatsappStub.send(to, o.text, { template: o.template, sessionOpen: sessionOpen(o.thread) }) : await smsStub.send(to, o.text, SMS_ACCOUNT.sender)
    let fallback = false
    if (res.state === "failed" && channel === "whatsapp" && o.consent.smsFallback) {
      channel = "sms"
      fallback = true
      res = await smsStub.send(to, o.text, SMS_ACCOUNT.sender)
    }
    const msg: PatientMessage = {
      id: `${o.thread?.id ?? `pt-${o.patient}`}-o${(o.thread?.messages.length ?? 0) + 1}`,
      dir: "out",
      at: MSG_NOW,
      text: { en: o.text, ar: o.text },
      channel,
      template: o.template,
      state: res.state === "failed" ? "failed" : "delivered",
      fallback,
      by: ME,
      reason: res.reason,
    }
    const thread: PatientThread = o.thread ?? {
      id: `pt-${o.patient}`,
      patient: o.patient,
      channel,
      language: "ar",
      last: { text: msg.text, at: MSG_NOW, state: msg.state! },
      messages: [],
    }
    postPatientMessage(thread, msg)
    if (res.state === "failed") toast.warning(t("toasts.patientFailed"), { description: t("toasts.patientFailedText", { reason: t(`pm.reason.${res.reason ?? "unreachable"}`) }) })
    else if (fallback) toast.success(t("toasts.patientFallback"), { description: t("toasts.patientFallbackText") })
    else if (channel === "whatsapp") toast.success(t("toasts.patientSentWa"), { description: t("toasts.patientSentWaText") })
    else toast.success(t("toasts.patientSentSms"), { description: t("toasts.patientSentSmsText", { mobile: localMobile(to) }) })
    return thread.id
  }
}

/* ------------------------------------------------------------------ list */

function PtRow({ th, selected, onSelect, href, flush }: { th: PatientThread; selected?: boolean; onSelect?: () => void; href?: string; flush?: boolean }) {
  const { b, when } = useMsgText()
  const p = recPatients[th.patient]
  const body = (
    <>
      <PersonAvatar initials={p?.initials ?? "?"} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{p ? b(p.name) : th.patient}</span>
          <ChannelIcon channel={th.channel} />
          <span className="shrink-0 text-xs text-muted-foreground">{when(th.last.at)}</span>
        </span>
        <span className="truncate text-xs text-muted-foreground">{b(th.last.text)}</span>
        <DeliveryBadge state={th.last.state} needsAction={th.needsAction} female={p?.sex === "f"} />
      </span>
    </>
  )
  const cls = cn(
    "flex w-full items-start gap-2.5 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    flush ? "border-b py-3 last:border-b-0" : "rounded-lg px-3 py-2.5",
    selected ? "bg-accent" : !flush && "hover:bg-muted/50"
  )
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onSelect} className={cls} aria-current={selected || undefined}>
      {body}
    </button>
  )
}

type Filter = "all" | "replies" | "failed"

function useList() {
  const threads = usePatientThreads()
  const [q, setQ] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")
  const counts = patientCounts(threads)
  const words = q.trim().toLowerCase().replace(/\s+/g, "")
  const list = threads
    .filter((x) => (filter === "replies" ? x.last.state === "replied" : filter === "failed" ? x.last.state === "failed" : true))
    .filter((x) => {
      if (!words) return true
      const p = recPatients[x.patient]
      return [p?.name.en, p?.name.ar, p?.mrn, localMobile(p?.mobile), p?.mobile?.replace(/\s+/g, "")].join(" ").toLowerCase().replace(/\s+/g, "").includes(words)
    })
  return { threads, list, q, setQ, filter, setFilter, counts }
}

function ListHead({ s, onNew }: { s: ReturnType<typeof useList>; onNew: () => void }) {
  const { t } = useMsgText()
  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">{t("pm.title")}</h2>
          <p className="text-xs text-muted-foreground">
            <span className="hidden xl:inline">{t("pm.sub", { sender: SMS_ACCOUNT.sender })}</span>
            <span className="xl:hidden">{t("pm.subReplies", { n: s.counts.replies })}</span>
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={onNew} aria-label={t("actions.messagePatient")}>
          <Icon name="add" size={20} />
        </Button>
      </div>
      <div className="relative">
        <Icon name="search-normal-1" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={s.q} onChange={(e) => s.setQ(e.target.value)} placeholder={t("pm.search")} aria-label={t("pm.search")} className="ps-9" />
      </div>
      <Segmented
        size="sm"
        className="w-full"
        value={s.filter}
        onValueChange={s.setFilter}
        options={[
          { value: "all", label: t("pm.all") },
          { value: "replies", label: t("pm.replies", { n: s.counts.replies }) },
          { value: "failed", label: t("pm.failed", { n: s.counts.failed }) },
        ]}
      />
    </>
  )
}

/** Header actions: Templates · Message a patient. */
export function PatientActions() {
  const { t } = useMsgText()
  const [open, setOpen] = React.useState(false)
  return (
    <>
      {isTabEnabled("messages", "templates") && (
        <Button variant="outline" asChild>
          <Link href={templatesHref()}>
            <Icon name="document-text" size={18} />
            {t("actions.templates")}
          </Link>
        </Button>
      )}
      <Button onClick={() => setOpen(true)}>
        <Icon name="add" size={18} />
        {t("actions.messagePatient")}
      </Button>
      {open && <MessagePatientDialog onOpenChange={setOpen} />}
    </>
  )
}

/**
 * Widget / Msg Patients. Desktop (xl): one card, 780 high — the list (search, All / Replies / Failed, rows with channel and
 * state) and the open conversation. Tablet / mobile: the list; rows open the Patient conversation page.
 */
export function PatientsBody() {
  const { t } = useMsgText()
  const s = useList()
  const [sel, setSel] = React.useState<string>()
  const [dlg, setDlg] = React.useState(false)
  const current = s.list.find((x) => x.id === sel) ?? s.list[0]
  return (
    <>
      <div className="hidden h-[780px] overflow-hidden rounded-[14px] border bg-card xl:flex">
        <div className="flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto border-e px-3 py-4">
          <ListHead s={s} onNew={() => setDlg(true)} />
          <div className="flex flex-col gap-0.5">
            {s.list.length ? s.list.map((x) => <PtRow key={x.id} th={x} selected={current?.id === x.id} onSelect={() => setSel(x.id)} />) : <p className="py-6 text-center text-xs text-muted-foreground">{t("pm.empty")}</p>}
          </div>
        </div>
        <div className="min-w-0 flex-1 p-6">{current ? <PatientPane key={current.id} th={current} fill /> : <EmptyState icon="sms" title={t("pm.pick")} description={t("pm.pickText")} />}</div>
      </div>
      <section className="flex flex-col gap-4 rounded-[14px] border bg-card p-4 xl:hidden">
        <ListHead s={s} onNew={() => setDlg(true)} />
        <div className="flex flex-col">
          {s.list.length ? s.list.map((x) => <PtRow key={x.id} th={x} flush href={patientThreadHref(x.id)} />) : <p className="py-6 text-center text-xs text-muted-foreground">{t("pm.empty")}</p>}
        </div>
      </section>
      {dlg && <MessagePatientDialog onOpenChange={setDlg} />}
    </>
  )
}

/* ------------------------------------------------------------------ conversation */

const CHIPS = ["tpl-reminder", "tpl-results", "tpl-late", "tpl-directions"] as const
const CHIP_LABEL: Record<(typeof CHIPS)[number], Bi> = {
  "tpl-reminder": { en: "Reminder", ar: "تذكير" },
  "tpl-results": { en: "Results ready", ar: "النتائج جاهزة" },
  "tpl-late": { en: "Running late", ar: "الطبيب متأخر" },
  "tpl-directions": { en: "Directions", ar: "الموقع" },
}

/** "Thu 26 Nov" in the patient's language. */
export function usePatientDate() {
  const dates = useDates()
  return (iso: string, lang: "ar" | "en") => {
    const d = new Date(`${iso.slice(0, 10)}T12:00`)
    const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", o).format(d)
    void dates
    return lang === "ar" ? `${fmt({ weekday: "long" })} ${d.getDate()} ${fmt({ month: "long" })}` : `${fmt({ weekday: "short" })} ${d.getDate()} ${fmt({ month: "short" })}`
  }
}

/** Patient conversation: head (avatar, name, channel · language · MRN, Patient file), day pills, bubbles, hint, template chips, composer, rule. */
export function PatientPane({ th, fill, head = true }: { th: PatientThread; fill?: boolean; head?: boolean }) {
  const templates = useTemplates(TEMPLATES)
  const { t, b, l, locale, isToday } = useMsgText()
  const me = useMe()
  const p = recPatients[th.patient]
  const consent = useConsent(th.patient)
  const send = useSendToPatient()
  const pdate = usePatientDate()
  const [text, setText] = React.useState("")
  const [tpl, setTpl] = React.useState<string>()
  const [error, setError] = React.useState<string>()
  const [busy, setBusy] = React.useState(false)
  const scroller = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = scroller.current
    if (fill && el) el.scrollTop = el.scrollHeight
  }, [fill, th.messages.length])
  if (!p) return null
  const name = firstNameOf(p.name, locale === "ar" ? "ar" : "en")
  const template = templates.find((x) => x.id === tpl)
  const plan = planSend(text, th.channel, consent, template, th)
  const g = p.sex === "f" ? "f" : "m"
  const fileHref = patientFileHref(p)
  const apptHref = th.appointment ? appointmentHref(th.appointment.at) : undefined

  const applyChip = (id: (typeof CHIPS)[number]) => {
    const x = templates.find((y) => y.id === id)!
    setText(fillTemplate(x, p, th.language, th.appointment, (iso) => pdate(iso, th.language)))
    setTpl(id)
    setError(undefined)
    toast.info(t("toasts.templateApplied"), { description: t("toasts.templateAppliedText") })
  }
  const go = async () => {
    if (plan.error) return setError(plan.error === "empty" ? t("pm.errEmpty") : plan.error === "clinical" ? t("pm.errClinical") : t("pm.errNoConsent", { name, g }))
    setBusy(true)
    await send({ patient: th.patient, thread: th, text: text.trim(), plan, template: tpl, consent })
    markHandled(th.id)
    setBusy(false)
    setText("")
    setTpl(undefined)
  }
  const retry = async (m: PatientMessage) => {
    setBusy(true)
    await send({ patient: th.patient, thread: th, text: b(m.text), plan: { channel: "sms" }, template: m.template, consent })
    setBusy(false)
  }
  const days = th.messages.map((m, i) => i === 0 || th.messages[i - 1].at.slice(0, 10) !== m.at.slice(0, 10))
  const dayLabel = (iso: string) => (isToday(iso) ? t("chat.today") : iso.slice(0, 10) === "2026-11-24" ? t("chat.yesterday") : pdate(iso, locale === "ar" ? "ar" : "en"))

  return (
    <div className={cn("flex min-w-0 flex-col gap-3.5", fill && "h-full")}>
      {head && (
        <div className="flex items-center gap-2.5 border-b pb-3.5">
          <PersonAvatar initials={p.initials} size="default" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{b(p.name)}</span>
            <span className="text-xs text-muted-foreground">{t("pm.head", { channel: t(`channel.${th.channel}`), language: t(`pm.lang.${th.language}`), mrn: l(p.mrn) })}</span>
          </span>
          {fileHref && (
            <Button variant="outline" size="sm" asChild>
              <Link href={fileHref}>{t(p.sex === "f" ? "actions.patientFileF" : "actions.patientFile")}</Link>
            </Button>
          )}
        </div>
      )}
      <div ref={scroller} className={cn("flex flex-col gap-3", fill && "min-h-0 flex-1 overflow-y-auto")}>
        {th.messages.map((m, i) => (
          <React.Fragment key={m.id}>
            {days[i] && (
              <div className="flex justify-center">
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{dayLabel(m.at)}</span>
              </div>
            )}
            {m.dir === "in" ? (
              <div className="flex flex-col items-start gap-1">
                <p className="max-w-[80%] rounded-xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap text-foreground">{b(m.text)}</p>
                <span className="text-xs text-muted-foreground">{m.at.slice(11, 16)}</span>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <p className={cn("max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap text-foreground", m.state === "failed" ? "bg-destructive-soft" : "bg-accent")}>{b(m.text)}</p>
                <span className={cn("text-xs", m.state === "failed" ? "text-destructive" : "text-muted-foreground")}>
                  {m.state === "failed"
                    ? t("pm.failedNote", { reason: t(`pm.reason.${m.reason ?? "unreachable"}`) })
                    : m.auto
                      ? t("pm.auto", { time: m.at.slice(11, 16), state: t(`pm.state.${m.state ?? "sent"}`) })
                      : m.fallback
                        ? t("pm.fallback", { time: m.at.slice(11, 16), who: m.by === me ? t("chat.you") : b(STAFF[m.by ?? ""]?.name ?? { en: "", ar: "" }) })
                        : t("pm.byWho", { time: m.at.slice(11, 16), who: m.by === me ? t("chat.you") : b(STAFF[m.by ?? ""]?.name ?? { en: "", ar: "" }), state: t(`pm.state.${m.state ?? "sent"}`) })}
                </span>
                {m.state === "failed" && i === th.messages.length - 1 && (
                  <Button variant="outline" size="sm" onClick={() => void retry(m)} disabled={busy}>
                    <Icon name="refresh" size={16} />
                    {t("actions.tryAgain")}
                  </Button>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
        {th.hint && (
          <div className="flex items-center gap-2 rounded-[10px] bg-info-soft px-3 py-2 text-info-soft-foreground">
            <Icon name="calendar" size={16} className="shrink-0" />
            <span className="min-w-0 flex-1 text-xs">{b(th.hint)}</span>
            {apptHref && (
              <Button variant="outline" size="sm" className="bg-card" asChild>
                <Link href={apptHref}>{t("actions.openAppointment")}</Link>
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => applyChip(id)}
            className={cn(
              "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              tpl === id ? "border-primary bg-accent text-primary" : "bg-card text-foreground hover:bg-muted/60"
            )}
          >
            {b(CHIP_LABEL[id])}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className={cn("flex items-center gap-2 rounded-[10px] border bg-card py-2 ps-3 pe-2", error ? "border-destructive" : "border-input")}>
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(undefined)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void go()
              }
            }}
            placeholder={t("pm.ph", { name })}
            aria-label={t("pm.ph", { name })}
            aria-invalid={!!error || undefined}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button size="sm" onClick={() => void go()} disabled={busy}>
            <Icon name="send-2" size={18} />
            {busy ? t("pm.sending") : t("actions.send")}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!error && text.trim() && (
          <p className="text-xs text-muted-foreground">
            {t("pm.length", smsParts(text))}
            {plan.note && <> · {plan.note === "noWhatsapp" ? t("pm.noWhatsapp", { name, g }) : t("pm.waTemplateOnly")}</>}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("pm.rule")}</p>
    </div>
  )
}
