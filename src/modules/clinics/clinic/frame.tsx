"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useSelectedLayoutSegment } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { IfModule } from "@/lib/modules"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import type { Clinic } from "../data"
import { CLINIC_TABS, clinicHref, type ClinicTab } from "../href"
import { useClinic } from "../store"
import { useClinicText } from "../text"

const Ctx = React.createContext<{ clinic: Clinic; tab: ClinicTab } | null>(null)

/** The clinic of the current clinic page (inside ClinicFrame). */
export function useCurrentClinic(): Clinic {
  const c = React.useContext(Ctx)
  if (!c) throw new Error("useCurrentClinic outside ClinicFrame")
  return c.clinic
}

/** Clinic key from ?id= */
export const useClinicKey = () => useSearchParams().get("id") ?? ""

/** Active clinic tab, from the route segment under /clinics/clinic (read by the frame, which is the layout). */
export function useClinicTab(): ClinicTab {
  return React.useContext(Ctx)?.tab ?? "overview"
}

function useSegmentTab(): ClinicTab {
  const seg = useSelectedLayoutSegment()
  return (CLINIC_TABS as readonly string[]).includes(seg ?? "") ? (seg as ClinicTab) : "overview"
}

/** Appointments doctor ids for the clinic heads that Appointments knows (Book visit preselects them). */
const APPT_DOCTOR: Record<string, string> = { peds: "az", dental: "so", cardio: "km", ortho: "hf" }

/** Book visit → Appointments · New appointment (hidden when Appointments is off for the branch). */
export function bookVisitHref(c: Clinic) {
  const d = APPT_DOCTOR[c.key]
  return d ? `/appointments/new?doctor=${d}` : "/appointments/new"
}

/**
 * Clinic page frame (Clinics · Clinic page · …, Header v2): the header shows Back · "Clinics" over the clinic name;
 * the content starts with the clinic tabs (Overview · Doctors · n · Schedule · Services & prices · Rooms · Settings)
 * with the tab's actions at the end. Mobile: Back · clinic name · ⋯ replaces the app bar; the tabs scroll (the active
 * one scrolls into view), then the actions as full-width buttons. Settings adds the clinic to the breadcrumb.
 */
export function ClinicFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("clinics.page")
  const tn = useTranslations("shell.nav")
  const { b } = useClinicText()
  const clinic = useClinic(useClinicKey())
  const tab = useSegmentTab()
  const value = React.useMemo(() => (clinic ? { clinic, tab } : null), [clinic, tab])

  if (!clinic) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="hospital"
            title={t("notFoundTitle")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href="/clinics">
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

  const name = b(clinic.name)
  const crumbs = [{ label: tn("clinics"), href: "/clinics" }]
  if (tab === "settings") crumbs.push({ label: name, href: clinicHref(clinic.key) })
  return (
    <Ctx.Provider value={value}>
      <PageTitle title={name} crumbs={crumbs} back="/clinics" />
      <MobileBar clinic={clinic} />
      {children}
    </Ctx.Provider>
  )
}

/** Page body of a clinic tab: tabs row (+ the tab's actions) and the content. */
export function ClinicPage({ actions, className, children }: { actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
  const clinic = useCurrentClinic()
  const tab = useClinicTab()
  return (
    <PageContainer className={className}>
      <PageHeader mobileTabsFirst tabs={<ClinicTabs active={tab} clinic={clinic} />} actions={actions} />
      {children}
    </PageContainer>
  )
}

/** Overview actions: Edit (→ Settings) · Book visit (→ Appointments, only when that module is on). */
export function OverviewActions() {
  const t = useTranslations("clinics.page")
  const c = useCurrentClinic()
  return (
    <>
      <Button variant="outline" asChild>
        <Link href={clinicHref(c.key, "settings")}>
          <Icon name="edit-2" size={24} />
          {t("edit")}
        </Link>
      </Button>
      <IfModule id="appointments">
        <Button asChild>
          <Link href={bookVisitHref(c)}>
            <Icon name="calendar-add" size={24} />
            {t("book")}
          </Link>
        </Button>
      </IfModule>
    </>
  )
}

function MobileBar({ clinic }: { clinic: Clinic }) {
  const t = useTranslations("clinics.page")
  const tc = useTranslations("clinics")
  const { b } = useClinicText()
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href="/clinics" aria-label={t("back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{b(clinic.name)}</h1>
      <ActionMenu
        title={b(clinic.name)}
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("more")}>
            <Icon name="more" size={20} />
          </Button>
        }
        groups={[[{ key: "settings", icon: "setting-2", label: tc("menu.settings"), href: clinicHref(clinic.key, "settings") }]]}
      />
    </div>
  )
}

/** Clinic tabs: muted track, active = card pill + shadow-xs (text only). Scrolls on mobile; the active tab scrolls into view. */
function ClinicTabs({ active, clinic }: { active: ClinicTab; clinic: Clinic }) {
  const t = useTranslations("clinics.page")
  const activeRef = React.useRef<HTMLAnchorElement>(null)
  const navRef = React.useRef<HTMLElement>(null)
  // Scroll only the tab strip (scrollIntoView would also scroll the page sideways in RTL).
  React.useEffect(() => {
    const nav = navRef.current
    const el = activeRef.current
    if (!nav || !el) return
    const n = nav.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.left < n.left) nav.scrollBy({ left: r.left - n.left - 16 })
    else if (r.right > n.right) nav.scrollBy({ left: r.right - n.right + 16 })
  }, [active])
  return (
    <nav ref={navRef} aria-label={t("tabsLabel")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-[3px]">
        {CLINIC_TABS.map((key) => {
          const on = key === active
          return (
            <Link
              key={key}
              ref={on ? activeRef : undefined}
              href={clinicHref(clinic.key, key)}
              aria-current={on ? "page" : undefined}
              data-state={on ? "active" : "inactive"}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-[color,background-color,box-shadow]",
                "hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
              )}
            >
              {key === "doctors" ? t("tabs.doctors", { n: clinic.doctors.length }) : t(`tabs.${key}`)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
