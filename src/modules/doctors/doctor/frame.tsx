"use client"

import * as React from "react"
import { useSearchParams, useSelectedLayoutSegment } from "next/navigation"
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
import { isBlocked, type Doctor } from "../data"
import { DOCTOR_TABS, bookHref, doctorHref, type DoctorTab } from "../href"
import { useDoctor } from "../store"
import { useDoctorText } from "../text"

const Ctx = React.createContext<{ doctor: Doctor; tab: DoctorTab } | null>(null)

/** The doctor of the current doctor page (inside DoctorFrame). */
export function useCurrentDoctor(): Doctor {
  const c = React.useContext(Ctx)
  if (!c) throw new Error("useCurrentDoctor outside DoctorFrame")
  return c.doctor
}

/** Active doctor tab (read from the route segment by the frame, which is the layout). */
export function useDoctorTab(): DoctorTab {
  return React.useContext(Ctx)?.tab ?? "overview"
}

function useSegmentTab(): DoctorTab {
  const seg = useSelectedLayoutSegment()
  return (DOCTOR_TABS as readonly string[]).includes(seg ?? "") ? (seg as DoctorTab) : "overview"
}

/**
 * Doctor page frame (Doctors · Doctor page · …, Header v2): the header shows Back · "Doctors" over the doctor's name;
 * the content starts with the doctor tabs (Overview · Schedule · Patients · Performance · Credentials · Settings) with
 * the tab's actions at the end. Mobile: Back · name · ⋯ replaces the app bar; the tabs scroll (the active one scrolls
 * into view, so the 4th tab on shows the end of the row). Settings adds the doctor to the breadcrumb.
 */
export function DoctorFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("doctors.page")
  const tn = useTranslations("shell.nav")
  const { b } = useDoctorText()
  const doctor = useDoctor(useSearchParams().get("id") ?? "")
  const tab = useSegmentTab()
  const value = React.useMemo(() => (doctor ? { doctor, tab } : null), [doctor, tab])

  if (!doctor) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="people"
            title={t("notFoundTitle")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href="/doctors">
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

  const name = b(doctor.name)
  const crumbs = [{ label: tn("doctors"), href: "/doctors" }]
  if (tab === "settings") crumbs.push({ label: name, href: doctorHref(doctor.key) })
  return (
    <Ctx.Provider value={value}>
      <PageTitle title={name} crumbs={crumbs} back="/doctors" />
      <MobileBar doctor={doctor} />
      {children}
    </Ctx.Provider>
  )
}

/** Page body of a doctor tab: tabs row (+ the tab's actions) and the content. */
export function DoctorPage({ actions, className, children }: { actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
  const doctor = useCurrentDoctor()
  const tab = useDoctorTab()
  return (
    <PageContainer className={className}>
      <PageHeader mobileTabsFirst tabs={<DoctorTabs active={tab} doctor={doctor} />} actions={actions} />
      {children}
    </PageContainer>
  )
}

/** Overview actions: Edit (→ Settings) · Book visit (→ Appointments; hidden when it's off or a required credential expired). */
export function OverviewActions() {
  const t = useTranslations("doctors.page")
  const d = useCurrentDoctor()
  return (
    <>
      <Button variant="outline" asChild>
        <Link href={doctorHref(d.key, "settings")}>
          <Icon name="edit-2" size={24} />
          {t("edit")}
        </Link>
      </Button>
      <IfModule id="appointments">
        <Button asChild className={cn(isBlocked(d) && "hidden")}>
          <Link href={bookHref(d.key)}>
            <Icon name="calendar-add" size={24} />
            {t("book")}
          </Link>
        </Button>
      </IfModule>
    </>
  )
}

function MobileBar({ doctor }: { doctor: Doctor }) {
  const t = useTranslations("doctors.page")
  const { b } = useDoctorText()
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href="/doctors" aria-label={t("back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{b(doctor.name)}</h1>
      <ActionMenu
        title={b(doctor.name)}
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("more")}>
            <Icon name="more" size={20} />
          </Button>
        }
        groups={[
          [
            { key: "schedule", icon: "calendar-2", label: t("tabs.schedule"), href: doctorHref(doctor.key, "schedule") },
            { key: "settings", icon: "setting-2", label: t("tabs.settings"), href: doctorHref(doctor.key, "settings") },
          ],
        ]}
      />
    </div>
  )
}

/** Doctor tabs: muted track, active = card pill + shadow-xs (text only). Scrolls on mobile; the active tab scrolls into view. */
function DoctorTabs({ active, doctor }: { active: DoctorTab; doctor: Doctor }) {
  const t = useTranslations("doctors.page")
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
        {DOCTOR_TABS.map((key) => {
          const on = key === active
          return (
            <Link
              key={key}
              ref={on ? activeRef : undefined}
              href={doctorHref(doctor.key, key)}
              aria-current={on ? "page" : undefined}
              data-state={on ? "active" : "inactive"}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-[color,background-color,box-shadow]",
                "hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
              )}
            >
              {t(`tabs.${key}`)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
