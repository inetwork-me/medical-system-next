"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { IfModule } from "@/lib/modules"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { PageContainer } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Patient } from "../data"
import { BanDialog, ArchiveDialog } from "../list/row-actions"
import { toggleTag, usePatientsStore } from "../store"
import { OverlayProvider, useOverlay, type OverlayKind } from "./overlays"
import { ProfileCard } from "./side"
import { PATIENT_TABS, usePatient, usePatientTab, useText, type PatientTab } from "./use-patient"

/**
 * Patient page frame (Patients · Patient page · 1440 / 768 / 390):
 *  · md+  heading — back arrow + "Patient details", breadcrumb under it; Edit · Book visit · ⋯ on the Overview
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
      <PageContainer className="gap-4 md:gap-6">
        <Heading patient={patient} actions={tab === "overview"} />
        <ProfileCard className="md:hidden" />
        <PatientTabs active={tab} id={patient.id} counts={{ visits: record.visits.length, files: record.files.length }} />
        {children}
      </PageContainer>
    </OverlayProvider>
  )
}

function Heading({ patient, actions }: { patient: Patient; actions: boolean }) {
  const t = useTranslations("patients.page")
  const tn = useTranslations("patients")
  const { b } = useText()
  return (
    <div className="hidden items-center gap-3 md:flex">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/patients" aria-label={t("back")}>
              <Icon name="arrow-left" size={20} />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        </div>
        <nav aria-label={t("breadcrumb")}>
          <ol className="flex flex-wrap items-center gap-1.5 text-xs">
            <li>
              <Link href="/dashboard" className="text-primary hover:underline">
                {t("dashboard")}
              </Link>
            </li>
            <li aria-hidden className="text-muted-foreground">
              /
            </li>
            <li>
              <Link href="/patients" className="text-primary hover:underline">
                {tn("title")}
              </Link>
            </li>
            <li aria-hidden className="text-muted-foreground">
              /
            </li>
            <li aria-current="page" className="font-medium text-foreground">
              {b(patient.name)}
            </li>
          </ol>
        </nav>
      </div>
      {actions && (
        <div className="flex items-center gap-2">
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
      )}
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
  const soon = () => toast(t("page.soon"))
  const overlay = useOverlay()

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size="icon" aria-label={t("page.more")}>
            <Icon name="more" size={20} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => window.print()}>
            <Icon name="printer" size={16} />
            {t("page.menu.print")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={soon}>
            <Icon name="document-download" size={16} />
            {t("page.menu.pdf")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => overlay.open({ kind: "sms" })}>
            <Icon name="sms" size={16} />
            {t("page.menu.sms")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setTags(patient.id, toggleTag(patient.tags, "vip", !isVip))
              toast.success(isVip ? t("vipToast.off") : t("vipToast.on"), {
                description: t("vipToast.text", { name }),
              })
            }}
          >
            <Icon name="star-1" size={16} />
            {isVip ? t("rowMenu.unvip") : t("rowMenu.vip")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/patients/merge?a=${patient.id}${patient.duplicateOf ? `&b=${patient.duplicateOf}` : ""}`}>
              <Icon name="people" size={16} />
              {t("rowMenu.merge")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {!patient.tags.includes("banned") && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("ban")}>
              <Icon name="lock" size={16} />
              {t("rowMenu.ban")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("archive")}>
            <Icon name="trash" size={16} />
            {t("rowMenu.archive")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
                "hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs",
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
