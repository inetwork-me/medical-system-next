"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { Link } from "@/i18n/navigation"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { usePageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { MessagesInner } from "./frame"
import { patientsHref } from "./href"
import { KvRows, MsgCard, SwitchRow, useMsgText } from "./parts"
import { MessagePatientDialog } from "./patient-dialogs"
import { PatientPane, appointmentHref, localMobile, patientFileHref, recPatients, usePatientDate } from "./patient-msgs"
import { setConsent, useConsent, usePatientThreads } from "./store"
import type { Consent, PatientThread } from "./types"

/**
 * Patient conversation (inner page of Patient messages, `/messages/patients/conversation?id=pt-reem`): header Back ·
 * "Messages / Patient messages" over "{name} · {MRN}"; Open appointment · Patient file. The conversation card; side:
 * Patient (name, file, mobile, language), What she agreed to (switches; changed only at the patient's request, logged),
 * Next appointment (when, clinic, status · Open appointment). Mobile: Back · name · ⋯.
 */
export function PatientThreadPage() {
  const { t, b, l } = useMsgText()
  const id = useSearchParams().get("id") ?? ""
  const th = usePatientThreads().find((x) => x.id === id)
  const p = th ? recPatients[th.patient] : undefined
  const [dlg, setDlg] = React.useState(false)

  usePageTitle({
    title: p ? `${b(p.name)} · ${l(p.mrn)}` : t("titles.patientThread"),
    back: patientsHref(),
    crumbs: [
      { label: t("title"), href: "/messages" },
      { label: t("pm.title"), href: patientsHref() },
    ],
  })

  if (!th || !p)
    return (
      <MessagesInner tab="patients">
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="sms"
            title={t("pm.notFound")}
            description={t("pm.notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={patientsHref()}>{t("pm.backToList")}</Link>
              </Button>
            }
          />
        </div>
      </MessagesInner>
    )

  const fileHref = patientFileHref(p)
  const apptHref = th.appointment ? appointmentHref(th.appointment.at) : undefined

  return (
    <>
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={patientsHref()} aria-label={t("actions.back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{b(p.name)}</h1>
        <ActionMenu
          title={b(p.name)}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("actions.more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[
            [
              !!apptHref && { key: "appt", icon: "calendar", label: t("actions.openAppointment"), href: apptHref },
              !!fileHref && { key: "file", icon: "profile-2user", label: t(p.sex === "f" ? "actions.patientFileF" : "actions.patientFile"), href: fileHref },
              { key: "new", icon: "message-add", label: b({ en: "Message another patient", ar: "راسل مريض ثاني" }), onSelect: () => setDlg(true) },
            ],
          ]}
        />
      </div>
      <MessagesInner
        tab="patients"
        actions={
          <>
            {apptHref && (
              <Button variant="outline" asChild>
                <Link href={apptHref}>
                  <Icon name="calendar" size={18} />
                  {t("actions.openAppointment")}
                </Link>
              </Button>
            )}
            {fileHref && (
              <Button asChild>
                <Link href={fileHref}>
                  <Icon name="profile-2user" size={18} />
                  {t(p.sex === "f" ? "actions.patientFileF" : "actions.patientFile")}
                </Link>
              </Button>
            )}
          </>
        }
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
          <section className="min-w-0 rounded-[14px] border bg-card p-4 md:p-6">
            <div className="hidden md:block">
              <PatientPane th={th} />
            </div>
            <div className="md:hidden">
              <PatientPane th={th} head={false} />
            </div>
          </section>
          <div className="flex flex-col gap-4">
            <PatientCard th={th} />
            <ConsentCard th={th} />
            <NextCard th={th} />
          </div>
        </div>
      </MessagesInner>
      {dlg && <MessagePatientDialog onOpenChange={setDlg} />}
    </>
  )
}

function PatientCard({ th }: { th: PatientThread }) {
  const { t, b, l } = useMsgText()
  const p = recPatients[th.patient]
  return (
    <MsgCard title={p.sex === "f" ? t("pside.patientF") : t("pside.patient")}>
      <KvRows
        rows={[
          [t("pside.name"), b(p.name)],
          [t("pside.file"), l(p.mrn)],
          [t("pside.mobile"), l(localMobile(p.mobile))],
          [t("pside.language"), t(`pm.lang.${th.language}`)],
        ]}
      />
    </MsgCard>
  )
}

/** Consent: what the patient signed; staff change it only when the patient asks (logged). */
function ConsentCard({ th }: { th: PatientThread }) {
  const { t, dates } = useMsgText()
  const p = recPatients[th.patient]
  const c = useConsent(th.patient)
  const g = p.sex === "f" ? "f" : "m"
  const change = (k: keyof Pick<Consent, "reminders" | "whatsapp" | "offers">, v: boolean) => {
    const patch: Partial<Consent> = k === "whatsapp" ? { whatsapp: v, smsFallback: v } : { [k]: v }
    setConsent(th.patient, patch, { en: `${p.name.en}: ${k} ${v ? "on" : "off"} at the patient's request`, ar: `${p.name.ar}: ${v ? "تفعيل" : "إيقاف"} ${k} بطلب المريض` })
    toast.info(t("toasts.consentSaved"), { description: t("toasts.consentSavedText") })
  }
  return (
    <MsgCard title={p.sex === "f" ? t("pside.agreedF") : t("pside.agreed")} sub={c.signed ? t("pside.signed", { g, date: dates.short(c.signed) }) : t("pside.notSigned", { g })}>
      <div className="flex flex-col gap-4">
        <SwitchRow label={t("pside.reminders")} checked={c.reminders} onChange={(v) => change("reminders", v)} />
        <SwitchRow label={t("pside.whatsapp")} hint={t("pside.whatsappHint")} checked={c.whatsapp} onChange={(v) => change("whatsapp", v)} />
        <SwitchRow label={t("pside.offers")} checked={c.offers} onChange={(v) => change("offers", v)} />
      </div>
      <p className="text-xs text-muted-foreground">{t("pside.consentNote")}</p>
    </MsgCard>
  )
}

function NextCard({ th }: { th: PatientThread }) {
  const { t, b, locale } = useMsgText()
  const pdate = usePatientDate()
  const a = th.appointment
  const href = a ? appointmentHref(a.at) : undefined
  return (
    <MsgCard title={t("pside.next")}>
      {a ? (
        <>
          <KvRows
            rows={[
              [t("pside.when"), `${pdate(a.at, locale === "ar" ? "ar" : "en")} · ${a.at.slice(11, 16)}`],
              [t("pside.clinic"), `${b(a.clinic)} · ${b(a.doctor)}`],
              [t("pside.status"), b(a.status), a.statusTone],
            ]}
          />
          {href && (
            <Button variant="outline" className="w-full" asChild>
              <Link href={href}>
                <Icon name="calendar" size={18} />
                {t("actions.openAppointment")}
              </Link>
            </Button>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t("pside.noNext")}</p>
      )}
    </MsgCard>
  )
}
