"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Icon } from "@/components/ds/icon"
import { StatusBadge } from "@/components/ds/status-badge"
import { Widget } from "@/components/ds/widget"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useClinics } from "@/modules/clinics/store"
import { CRED_TONE, cmeEarned, cmeOf, credStatus, privilegesOf, type Credential, type CredentialType, type Doctor } from "../data"
import { RenewDialog, scanUrls } from "../renew-dialog"
import { ltr, useDoctorText } from "../text"
import { DoctorPage, useCurrentDoctor } from "./frame"
import { useCredLabel } from "./overview"

const ORDER: CredentialType[] = ["scfhs", "moh", "bls", "pals", "acls", "malpractice"]

/**
 * Doctor page · Credentials: Widget / Doctor Credentials — Licences & certificates (table when wide: credential,
 * number, issuer, expiry, status, Renew or View document; rows otherwise), then CME hours and Clinical privileges
 * (side by side when wide, stacked otherwise).
 */
export function DoctorCredentials() {
  const d = useCurrentDoctor()
  return (
    <DoctorPage>
      <Licences doctor={d} />
      <div className="@container/cr">
        <div className="grid grid-cols-1 gap-4 @5xl/cr:grid-cols-2 @5xl/cr:items-start @5xl/cr:gap-6">
          <CmeCard doctor={d} />
          <Privileges doctor={d} />
        </div>
      </div>
    </DoctorPage>
  )
}

function Licences({ doctor: d }: { doctor: Doctor }) {
  const t = useTranslations("doctors.credTab")
  const { b, dates } = useDoctorText()
  const label = useCredLabel()
  const [renewing, setRenewing] = React.useState<CredentialType | "add" | null>(null)
  const list = [...d.credentials].sort((a, z) => ORDER.indexOf(a.type) - ORDER.indexOf(z.type))
  const name = (c: Credential) => (c.type === "scfhs" ? `${t("full.scfhs")} · ${t(`${d.female ? "gradeF" : "grade"}.${d.grade}`)}` : t(`full.${c.type}`))
  const action = (c: Credential) => {
    if (credStatus(c) !== "valid")
      return (
        <Button variant="outline" size="sm" onClick={() => setRenewing(c.type)}>
          {t("renew")}
        </Button>
      )
    const url = c.fileName ? scanUrls.get(c.fileName) : undefined
    return url ? (
      <Button variant="ghost" size="icon-sm" asChild>
        <a href={url} target="_blank" rel="noreferrer" aria-label={`${t("view")} · ${name(c)}`}>
          <Icon name="document-text" size={20} />
        </a>
      </Button>
    ) : (
      <Button variant="ghost" size="icon-sm" disabled aria-label={`${t("view")} · ${t("noFile")}`} title={t("noFile")}>
        <Icon name="document-text" size={20} />
      </Button>
    )
  }
  return (
    <Widget
      title={t("title")}
      description={t("text")}
      className="gap-4 p-4 md:p-5"
      action={
        <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={() => setRenewing("add")}>
          <Icon name="add" size={16} />
          {t("add")}
        </Button>
      }
    >
      <div className="hidden overflow-hidden rounded-lg border @4xl/widget:block">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr className="h-10">
              <th scope="col" className="ps-4 text-start font-medium">{t("col.credential")}</th>
              <th scope="col" className="w-36 px-3 text-start font-medium">{t("col.number")}</th>
              <th scope="col" className="w-46 px-3 text-start font-medium">{t("col.issuer")}</th>
              <th scope="col" className="w-33 px-3 text-start font-medium">{t("col.expires")}</th>
              <th scope="col" className="w-36 px-3 text-start font-medium">{t("col.status")}</th>
              <th scope="col" className="w-24 pe-4">
                <span className="sr-only">{t("actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map((c) => (
              <tr key={c.type} className="h-13">
                <td className="ps-4 font-medium">
                  <bdi>{name(c)}</bdi>
                </td>
                <td className="px-3 text-xs text-muted-foreground tabular-nums">
                  <bdi dir="ltr">{c.number}</bdi>
                </td>
                <td className="truncate px-3 text-muted-foreground">{b(c.issuer)}</td>
                <td className="px-3 tabular-nums">{dates.short(c.expires)}</td>
                <td className="px-3">
                  <StatusBadge tone={CRED_TONE[credStatus(c)]}>{label(c)}</StatusBadge>
                </td>
                <td className="pe-4 text-end">{action(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col divide-y @4xl/widget:hidden">
        {list.map((c) => (
          <li key={c.type} className="flex flex-col gap-1.5 py-3">
            <span className="text-sm font-medium">
              <bdi>{name(c)}</bdi>
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{ltr(t("line", { number: c.number, date: dates.short(c.expires) }))}</span>
            <div className="flex items-center justify-between gap-2">
              <StatusBadge tone={CRED_TONE[credStatus(c)]}>{label(c)}</StatusBadge>
              {credStatus(c) !== "valid" && action(c)}
            </div>
          </li>
        ))}
      </ul>
      {renewing && <RenewDialog doctorKey={d.key} type={renewing === "add" ? undefined : renewing} onOpenChange={(o) => !o && setRenewing(null)} />}
    </Widget>
  )
}

function CmeCard({ doctor: d }: { doctor: Doctor }) {
  const t = useTranslations("doctors.credTab")
  const { b } = useDoctorText()
  const cme = cmeOf(d)
  const earned = cmeEarned(cme)
  const left = Math.max(0, cme.required - earned)
  return (
    <Widget title={t("cme")} description={t("cmeText", { cycle: cme.cycle, n: cme.required })} className="gap-3 p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums">{t("cmeOf", { earned, required: cme.required })}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{left ? t("cmeLeft", { n: left }) : t("cmeDone")}</span>
      </div>
      <Progress value={Math.min(100, (earned / cme.required) * 100)} className="h-1.5" aria-label={t("cmeOf", { earned, required: cme.required })} />
      <ul className="flex flex-col gap-1 pt-1">
        {cme.courses.map((c) => (
          <li key={c.name.en} className="flex items-center gap-2.5 py-1.5 text-sm">
            <Icon name="teacher" size={16} className="shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">{b(c.name)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{t("hours", { n: c.hours })}</span>
          </li>
        ))}
      </ul>
    </Widget>
  )
}

function Privileges({ doctor: d }: { doctor: Doctor }) {
  const t = useTranslations("doctors.credTab")
  const { b } = useDoctorText()
  const clinic = useClinics().find((c) => c.key === d.clinic)
  const list = privilegesOf(d, clinic?.specialty ?? { en: "Medicine", ar: "الطب" })
  return (
    <Widget title={t("priv")} description={t("privText")} className="gap-2 p-4 md:p-5">
      <ul className="flex flex-col">
        {list.map((p) => (
          <li key={p.name.en} className="flex items-center gap-2.5 py-2">
            <span className="min-w-0 flex-1 text-sm">{b(p.name)}</span>
            <StatusBadge tone={p.status === "approved" ? "success" : "warning"}>{t(p.status)}</StatusBadge>
          </li>
        ))}
      </ul>
    </Widget>
  )
}
