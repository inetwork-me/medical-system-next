"use client"

import { useTranslations } from "next-intl"

import { PageTitle } from "@/components/shell/page-title"
import { AppointmentsSoon } from "./frame"

type Tab = "list" | "waiting" | "schedules" | "reports"

export function SoonTab({ tab }: { tab: Tab }) {
  const t = useTranslations("shell.tabs.appointments")
  return <AppointmentsSoon tab={t(tab)} />
}

export function SoonNew() {
  const t = useTranslations("appointments")
  const tn = useTranslations("shell.nav")
  return (
    <>
      <PageTitle title={t("newAppointment")} back="/appointments" crumbs={[{ label: tn("appointments"), href: "/appointments" }]} />
      <AppointmentsSoon tab={t("newAppointment")} />
    </>
  )
}
