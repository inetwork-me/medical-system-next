"use client"

import { useTranslations } from "next-intl"

import { AppointmentsSoon } from "./frame"

type Tab = "list" | "waiting" | "schedules" | "reports"

export function SoonTab({ tab }: { tab: Tab }) {
  const t = useTranslations("shell.tabs.appointments")
  return <AppointmentsSoon tab={t(tab)} />
}
