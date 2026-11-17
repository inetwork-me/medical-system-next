"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { appointmentsOn, TODAY } from "./data"

/**
 * Shared Appointments frame (every tab): module tabs (Calendar · n, List · n, Waiting room · n, Doctor schedules,
 * Reports) with Export + New appointment at the end. Mobile: New appointment full width above the tabs.
 */
export function AppointmentsFrame({ onExport, children }: { onExport?: () => void; children?: React.ReactNode }) {
  const t = useTranslations("appointments")
  const today = appointmentsOn(TODAY)
  const count = today.length
  const waiting = today.filter((a) => a.status === "arrived").length
  return (
    <PageContainer>
      <PageHeader
        tabs={<ModuleTabsNav module="appointments" counts={{ calendar: count, list: count, waiting }} />}
        actions={
          <>
            {onExport && (
              <Button variant="outline" className="hidden md:inline-flex" onClick={onExport}>
                <Icon name="export" size={24} />
                {t("export")}
              </Button>
            )}
            <Button asChild>
              <Link href="/appointments/new">
                <Icon name="calendar-add" size={24} />
                {t("newAppointment")}
              </Link>
            </Button>
          </>
        }
      />
      {children}
    </PageContainer>
  )
}

/** Tabs whose FigCraft screens are built in the next slices. */
export function AppointmentsSoon({ tab }: { tab: string }) {
  const t = useTranslations("appointments.soon")
  return (
    <AppointmentsFrame>
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon="calendar-2"
          title={t("title", { tab })}
          description={t("text")}
          className="py-16"
          actions={
            <Button variant="outline" asChild>
              <Link href="/appointments">
                <Icon name="arrow-left" size={20} />
                {t("back")}
              </Link>
            </Button>
          }
        />
      </div>
    </AppointmentsFrame>
  )
}
