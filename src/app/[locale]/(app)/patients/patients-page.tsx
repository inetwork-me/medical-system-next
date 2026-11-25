"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { IfCan } from "@/components/shell/permissions"
import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { allPatients, filterPatients } from "@/modules/patients/data"
import { ExportDialog } from "@/modules/patients/list/export-dialog"
import { useListQuery } from "@/modules/patients/list/use-list-query"
import { usePatientsStore } from "@/modules/patients/store"

/**
 * Shared Patients module frame: page header (Export → dialog, Add patient → wizard) + module tabs
 * (Patients list · count / Reports / Payments).
 */
export function PatientsFrame({ children }: { tab: "list" | "reports" | "payments"; children?: React.ReactNode }) {
  const t = useTranslations("patients")
  const { patients } = usePatientsStore()
  const [exportOpen, setExportOpen] = React.useState(false)
  const total = patients.length || allPatients().length

  return (
    <PageContainer>
      <PageHeader
        tabs={<ModuleTabsNav module="patients" counts={{ list: total.toLocaleString("en-US") }} />}
        actions={
          <>
            <IfCan module="patients" action="export">
              <Button variant="outline" onClick={() => setExportOpen(true)}>
                <Icon name="export" size={20} />
                {t("export")}
              </Button>
            </IfCan>
            <IfCan module="patients" action="create">
              <Button asChild>
                <Link href="/patients/new">
                  <Icon name="user-add" size={20} />
                  {t("addPatient")}
                </Link>
              </Button>
            </IfCan>
          </>
        }
      />
      {children}
      {exportOpen && <ExportRows open={exportOpen} onOpenChange={setExportOpen} />}
    </PageContainer>
  )
}

/** Export uses the list's current filters when on the list tab. */
function ExportRows({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { patients } = usePatientsStore()
  const { query } = useListQuery()
  const rows = React.useMemo(() => filterPatients(patients, query, "en"), [patients, query])
  return <ExportDialog open={open} onOpenChange={onOpenChange} rows={rows} />
}
