"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { notify } from "@/components/ds/toast"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { IfModule } from "@/lib/modules"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { PageContainer } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import type { Patient } from "../data"
import { BanDialog, ArchiveDialog } from "../list/row-actions"
import { toggleTag, usePatientsStore } from "../store"
import { usePatientExports } from "./exports"
import { OverlayProvider, useOverlay, type OverlayKind } from "./overlays"
import { ProfileCard } from "./side"
import { PATIENT_TABS, usePatient, usePatientTab, useText, type PatientTab } from "./use-patient"

/**
 * Patient page frame (Patients · Patient page · 1440 / 768 / 390):
 *  · md+  app header: back · "Patients / Patients list" over the patient's name; tabs row with Edit · Book visit · ⋯ (Overview)
 *  · <md  profile bar (back · "Patient profile" · ⋯) replaces the app bar; the profile card sits above the tabs
 *  · tabs as route navigation (Overview, Visits · n, Payments, Medical, Files · n, Activity); scrolls on mobile
 */
export function PatientFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("patients.page")
  const current = usePatient()
  // ?action=book (row menu, side sheet, wizard "Book first visit") opens Book visit once, then the URL is cleaned.
  const sp = useSearchParams()
  const [initialAction] = React.useState<OverlayKind | null>(() => (sp.get("action") === "book" ? { kind: "book" } : null))
  React.useEffect(() => {
    if (sp.get("action")) window.history.replaceState(null, "", window.location.pathname)
  }, [sp])
  const tab = usePatientTab()
  // Keep showing the file while leaving after "Archive" (the store drops it at once).
  const [last, setLast] = React.useState(current)
  if (current && current.patient !== last?.patient) setLast(current)
  const data = current ?? last

  if (!data) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="profile-2user"
            title={t("notFoundTitle")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href="/patients">
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

  const { patient, record } = data
  return (
    <OverlayProvider initial={initialAction}>
      <MobileProfileBar patient={patient} />
      <HeaderTitle patient={patient} />
      <PageContainer className="gap-4 md:gap-6">
        <ProfileCard className="md:hidden" />
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="min-w-0 xl:flex-1">
            <PatientTabs active={tab} id={patient.id} counts={{ visits: record.visits.length, files: record.files.length }} />
          </div>
          {tab === "overview" && <HeadingActions patient={patient} />}
        </div>
        {children}
      </PageContainer>
    </OverlayProvider>
  )
}

function HeaderTitle({ patient }: { patient: Patient }) {
  const tn = useTranslations("patients")
  const ts = useTranslations("shell.tabs.patients")
  const { b } = useText()
  return (
    <PageTitle
      title={b(patient.name)}
      back="/patients"
      crumbs={[
        { label: tn("title"), href: "/patients" },
        { label: ts("list"), href: "/patients" },
      ]}
    />
  )
}

function HeadingActions({ patient }: { patient: Patient }) {
  const t = useTranslations("patients.page")
  return (
    <div className="hidden items-center gap-2 md:flex">
      <Button variant="outline" asChild>
        <Link href={`/patients/${patient.id}/edit`}>
          <Icon name="edit-2" size={20} />
          {t("edit")}
        </Link>
      </Button>
      <IfModule id="appointments">
        <BookButton label={t("book")} />
      </IfModule>
      <MoreActions patient={patient} />
    </div>
  )
}

/** Mobile: profile bar in place of the app bar (back · title · more). */
function MobileProfileBar({ patient }: { patient: Patient }) {
  const t = useTranslations("patients.page")
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href="/patients" aria-label={t("back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
      <MoreActions patient={patient} variant="ghost" />
    </div>
  )
}

/**
 * Overlay · More actions (anchored, bottom-end): Print profile · Download PDF · Send SMS | Mark as VIP · Merge |
 * Ban · Archive (destructive, confirmed in dialogs).
 */
function MoreActions({ patient, variant = "outline" }: { patient: Patient; variant?: "outline" | "ghost" }) {
  const t = useTranslations("patients")
  const { b } = useText()
  const router = useRouter()
  const { setTags } = usePatientsStore()
  const [dialog, setDialog] = React.useState<null | "ban" | "archive">(null)
  const name = b(patient.name)
  const isVip = patient.tags.includes("vip")
  const data = usePatient()
  const exports = usePatientExports()
  const overlay = useOverlay()

  return (
    <>
      <ActionMenu
        title={t("page.more")}
        width="w-60"
        trigger={
          <Button variant={variant} size="icon" aria-label={t("page.more")}>
            <Icon name="more" size={20} />
          </Button>
        }
        groups={[
          [
            { key: "print", icon: "printer", label: t("page.menu.print"), onSelect: () => window.print() },
            {
              key: "pdf",
              icon: "document-download",
              label: t("page.menu.pdf"),
              disabled: !data || exports.busy,
              onSelect: () => data && void exports.summaryPdf(data.patient, data.record),
            },
            { key: "sms", icon: "sms", label: t("page.menu.sms"), onSelect: () => overlay.open({ kind: "sms" }) },
          ],
          [
            {
              key: "vip",
              icon: "star-1",
              label: isVip ? t("rowMenu.unvip") : t("rowMenu.vip"),
              onSelect: () => {
                setTags(patient.id, toggleTag(patient.tags, "vip", !isVip))
                notify.success(isVip ? t("vipToast.off") : t("vipToast.on"), { description: t("vipToast.text", { name }) })
              },
            },
            {
              key: "merge",
              icon: "people",
              label: t("rowMenu.merge"),
              href: `/patients/merge?a=${patient.id}${patient.duplicateOf ? `&b=${patient.duplicateOf}` : ""}`,
            },
          ],
          [
            !patient.tags.includes("banned") && { key: "ban", icon: "lock", label: t("rowMenu.ban"), destructive: true, onSelect: () => setDialog("ban") },
            { key: "archive", icon: "trash", label: t("rowMenu.archive"), destructive: true, onSelect: () => setDialog("archive") },
          ],
        ]}
      />
      <BanDialog patient={patient} open={dialog === "ban"} onOpenChange={(o) => setDialog(o ? "ban" : null)} />
      <ArchiveDialog
        patient={patient}
        open={dialog === "archive"}
        onOpenChange={(o) => setDialog(o ? "archive" : null)}
        onArchived={() => router.replace("/patients")}
      />
    </>
  )
}

/** Patient tabs: muted track, active = card pill + shadow-xs (no icons). The active tab scrolls into view on mobile. */
function PatientTabs({ active, id, counts }: { active: PatientTab; id: string; counts: { visits: number; files: number } }) {
  const t = useTranslations("patients.page")
  const activeRef = React.useRef<HTMLAnchorElement>(null)
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [active])
  return (
    <nav aria-label={t("tabsLabel")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-[3px]">
        {PATIENT_TABS.map((key) => {
          const on = key === active
          const label = key === "visits" || key === "files" ? t(`tabs.${key}`, { count: counts[key] }) : t(`tabs.${key}`)
          return (
            <Link
              key={key}
              ref={on ? activeRef : undefined}
              href={key === "overview" ? `/patients/${id}` : `/patients/${id}/${key}`}
              aria-current={on ? "page" : undefined}
              data-state={on ? "active" : "inactive"}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-[color,background-color,box-shadow]",
                "hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs",
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function BookButton({ label }: { label: string }) {
  const overlay = useOverlay()
  return (
    <Button onClick={() => overlay.open({ kind: "book" })}>
      <Icon name="calendar-add" size={20} />
      {label}
    </Button>
  )
}
