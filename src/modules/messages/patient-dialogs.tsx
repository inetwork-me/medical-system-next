"use client"

import * as React from "react"

import { useRouter } from "@/i18n/navigation"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { SMS_ACCOUNT, TEMPLATES } from "./data"
import { patientThreadHref } from "./href"
import { Note, useMsgText } from "./parts"
import { fillTemplate, firstNameOf, localMobile, planSend, recPatients, usePatientDate, useSendToPatient } from "./patient-msgs"
import { smsParts } from "./services/patient-gateway"
import { useConsent, usePatientThreads, useTemplates } from "./store"
import type { PatientChannel } from "./types"

/**
 * Overlay · Message a patient (Message a patient / + on the list): patient (name, MRN or mobile), send by WhatsApp / SMS,
 * template, message (filled from the template and the patient's next appointment), the length line, the consent note with
 * SMS fallback. WhatsApp without consent, or outside the 24-hour reply window with a template Meta hasn't approved, goes
 * by SMS (said under the message). → `patient-sent`, then the conversation.
 */
export function MessagePatientDialog({ initial, onOpenChange }: { initial?: string; onOpenChange: (open: boolean) => void }) {
  const templates = useTemplates(TEMPLATES)
  const { t, b, l, locale, dates } = useMsgText()
  const router = useRouter()
  const threads = usePatientThreads()
  const send = useSendToPatient()
  const pdate = usePatientDate()
  const [patient, setPatient] = React.useState(initial ?? "")
  const [q, setQ] = React.useState("")
  const [channel, setChannel] = React.useState<PatientChannel>("whatsapp")
  const [tpl, setTpl] = React.useState<string>("none")
  const [text, setText] = React.useState("")
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const consent = useConsent(patient || "_")
  const p = patient ? recPatients[patient] : undefined
  const thread = threads.find((x) => x.patient === patient)
  const lang = thread?.language ?? "ar"
  const template = templates.find((x) => x.id === tpl)
  const plan = planSend(text, channel, consent, template, thread)
  const g = p?.sex === "f" ? "f" : "m"
  const name = p ? firstNameOf(p.name, locale === "ar" ? "ar" : "en") : ""
  const words = q.trim().toLowerCase().replace(/\s+/g, "")
  const hits = words
    ? Object.entries(recPatients)
        .filter(([, x]) => [x.name.en, x.name.ar, x.mrn, localMobile(x.mobile)].join(" ").toLowerCase().replace(/\s+/g, "").includes(words))
        .slice(0, 6)
    : []

  const pick = (key: string) => {
    setPatient(key)
    setQ("")
    const c = recPatients[key]
    const th = threads.find((x) => x.patient === key)
    if (tpl !== "none") setText(fillTemplate(templates.find((x) => x.id === tpl)!, c, th?.language ?? "ar", th?.appointment, (iso) => pdate(iso, th?.language ?? "ar")))
  }
  const pickTemplate = (id: string) => {
    setTpl(id)
    const x = templates.find((y) => y.id === id)
    if (x && p) setText(fillTemplate(x, p, lang, thread?.appointment, (iso) => pdate(iso, lang)))
  }
  const errors = {
    patient: !patient ? t("patMsg.errPatient") : undefined,
    message: plan.error === "empty" ? t("patMsg.errMessage") : plan.error === "clinical" ? t("pm.errClinical") : plan.error === "noConsent" ? t("pm.errNoConsent", { name, g }) : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)
  const go = async () => {
    setTried(true)
    if (invalid || busy) return
    setBusy(true)
    const id = await send({ patient, thread, text: text.trim(), plan, template: tpl === "none" ? undefined : tpl, consent })
    setBusy(false)
    onOpenChange(false)
    router.push(patientThreadHref(id))
  }
  const signed = consent.signed ? dates.dayMonth(consent.signed) : ""

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("patMsg.title")}
      description={t("patMsg.sub", { sender: SMS_ACCOUNT.sender })}
      icon="message-add"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          {t("actions.cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void go()} disabled={busy}>
          {busy ? t("pm.sending") : t("actions.send")}
        </Button>
      }
    >
      {tried && invalid && <Note tone="destructive">{t("patMsg.strip")}</Note>}
      <Field label={t("patMsg.patient")} required error={tried ? errors.patient : undefined}>
        <div className="relative">
          <Icon name="search-normal-1" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={p && !q ? `${b(p.name)} · ${p.mrn}` : q}
            onChange={(e) => {
              setQ(e.target.value)
              setPatient("")
            }}
            placeholder={t("patMsg.patientPh")}
            className="ps-9"
          />
          {hits.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border bg-popover p-1 shadow-md">
              {hits.map(([key, x]) => (
                <li key={key}>
                  <button type="button" onClick={() => pick(key)} className="flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-start hover:bg-muted">
                    <span className="text-sm text-foreground">{b(x.name)}</span>
                    <span className="text-xs text-muted-foreground">
                      {l(x.mrn)} · {l(localMobile(x.mobile))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>
      <Field label={t("patMsg.sendBy")} required>
        {(c) => (
          <Segmented
            {...c}
            value={channel}
            onValueChange={setChannel}
            options={[
              { value: "whatsapp", label: t("channel.whatsapp") },
              { value: "sms", label: t("channel.sms") },
            ]}
          />
        )}
      </Field>
      <Field label={t("patMsg.template")}>
        {(c) => (
          <Select value={tpl} onValueChange={pickTemplate}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("patMsg.noTemplate")}</SelectItem>
              {templates.filter((x) => x.audience === "patients").map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {b(x.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label={t("patMsg.message")} error={tried ? errors.message : undefined}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      </Field>
      <p className="-mt-2 text-xs text-muted-foreground">
        {t("pm.length", smsParts(text))}
        {plan.note && <> · {plan.note === "noWhatsapp" ? t("pm.noWhatsapp", { name, g }) : t("pm.waTemplateOnly")}</>}
      </p>
      {p && (
        <Note>
          {!consent.reminders
            ? t("patMsg.consentNone", { name, g })
            : consent.whatsapp && consent.smsFallback
              ? t("patMsg.consent", { name, g, date: signed })
              : t("patMsg.consentSms", { name, g })}
        </Note>
      )}
    </ResponsiveDialog>
  )
}
