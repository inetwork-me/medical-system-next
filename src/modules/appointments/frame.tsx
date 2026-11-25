"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { IfCan } from "@/components/shell/permissions"
import { can } from "@/lib/permissions"
import { TODAY } from "./data"
import { AppointmentOverlays } from "./overlays"
import { useAppointmentsOn } from "./store"

/**
 * Shared Appointments frame (every tab): module tabs (Calendar · n, List · n, Waiting room · n, Doctor schedules,
 * Reports) with Export + New appointment at the end. Mobile: New appointment full width above the tabs.
 */
export function AppointmentsFrame({ onExport, children }: { onExport?: () => void; children?: React.ReactNode }) {
  const t = useTranslations("appointments")
  const today = useAppointmentsOn()(TODAY)
  const count = today.length
  const waiting = today.filter((a) => a.status === "arrived").length
  return (
    <PageContainer>
      <PageHeader
        tabs={<ModuleTabsNav module="appointments" counts={{ calendar: count, list: count, waiting }} />}
        actions={
          <>
            {onExport && can("appointments", "export") && (
              <Button variant="outline" className="hidden md:inline-flex" onClick={onExport}>
                <Icon name="export" size={24} />
                {t("export")}
              </Button>
            )}
            <IfCan module="appointments" action="create">
              <Button asChild>
                <Link href="/appointments/new">
                  <Icon name="calendar-add" size={24} />
                  {t("newAppointment")}
                </Link>
              </Button>
            </IfCan>
          </>
        }
      />
      <AppointmentOverlays>{children}</AppointmentOverlays>
    </PageContainer>
  )
}
