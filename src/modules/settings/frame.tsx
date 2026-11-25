"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import type { Bi } from "@/lib/mock/bi"
import { ActionMenu, type ActionItem } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { MobileActionBar, PageContainer } from "@/components/shell/page"
import { usePageTitle } from "@/components/shell/page-title"
import { canOpenSection } from "./access"
import { attentionDots } from "./checks"
import { INNER_PARENT, SECTION_GROUPS, SECTIONS, sectionById, type InnerPage, type SectionDef, type SectionId } from "./sections"
import { useUsers, useZatcaUnits } from "./store"

/* ------------------------------------------------------------------ text */

const ARABIC = /[؀-ۿ]/
const LRI = "⁦"
const PDI = "⁩"
/** Latin-only values (numbers, codes, emails) stay LTR inside Arabic lines. */
export const isolateLatin = (s: string, locale: string) => (locale === "ar" && s && !ARABIC.test(s) ? LRI + s + PDI : s)

const NUM = new Intl.NumberFormat("en-US")

/** Locale helpers for the Settings screens: bilingual values, Latin numbers with grouping, dates. */
export function useSetText() {
  const locale = useLocale()
  const t = useTranslations("settings")
  const dates = useDates()
  return {
    locale,
    t,
    dates,
    b: (v: Bi) => (locale === "ar" ? v.ar : v.en),
    l: (s: string) => isolateLatin(s, locale),
    /** 8,420 — Latin digits in both languages (brief §4 · Formats), kept LTR in Arabic. */
    n: (v: number) => isolateLatin(NUM.format(v), locale),
  }
}

/** Sections the signed-in user can open, in menu order. */
export function useAllowedSections(): SectionDef[] {
  return SECTIONS.filter((s) => canOpenSection(s.id))
}

/* ------------------------------------------------------------------ nav */

/** Amber dot: the section needs attention (brief §1 · Layout). */
function Dot({ className }: { className?: string }) {
  const t = useTranslations("settings.menu")
  return <span role="img" aria-label={t("needsAttention")} className={cn("size-2 shrink-0 rounded-full bg-warning", className)} />
}

/**
 * Desktop settings menu card (240): Overview, then the groups with their sections. Active = tinted (accent) with the Bold
 * icon; an amber dot marks sections that need attention. Groups with nothing the user can open are left out.
 */
function SettingsMenu({ active, className }: { active: SectionId; className?: string }) {
  const { t } = useSetText()
  const allowed = useAllowedSections()
  const dots = attentionDots(useUsers(), useZatcaUnits())
  const item = (s: SectionDef) => {
    const on = s.id === active
    return (
      <Link
        key={s.id}
        href={s.href}
        aria-current={on ? "page" : undefined}
        className={cn(
          "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
          on && "bg-accent text-primary hover:bg-accent"
        )}
      >
        <Icon name={s.icon} size={18} variant={on ? "bold" : "linear"} className={on ? "text-primary" : "text-muted-foreground"} />
        <span className="min-w-0 flex-1 truncate">{t(`sections.${s.id}`)}</span>
        {dots[s.id] && <Dot />}
      </Link>
    )
  }
  return (
    <nav aria-label={t("menu.label")} className={cn("flex-col gap-1 rounded-xl border bg-card p-3", className)}>
      {allowed.filter((s) => !s.group).map(item)}
      {SECTION_GROUPS.map((g) => {
        const items = allowed.filter((s) => s.group === g)
        if (!items.length) return null
        return (
          <div key={g} className="flex flex-col gap-0.5 pt-2">
            <p className="px-2.5 pb-1 text-xs text-muted-foreground">{t(`groups.${g}`)}</p>
            {items.map(item)}
          </div>
        )
      })}
    </nav>
  )
}

/**
 * Tablet: the same items as a scrolling tab row (muted track, active = card pill). The active tab scrolls into view (the
 * strip only — scrollIntoView would move the page sideways in RTL).
 */
function SettingsTabs({ active, className }: { active: SectionId; className?: string }) {
  const { t } = useSetText()
  const allowed = useAllowedSections()
  const navRef = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    const nav = navRef.current
    const el = nav?.querySelector<HTMLElement>("[aria-current=page]")
    if (!el || !nav || nav.scrollWidth <= nav.clientWidth) return
    const n = nav.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.left < n.left) nav.scrollLeft -= n.left - r.left + 16
    else if (r.right > n.right) nav.scrollLeft += r.right - n.right + 16
  }, [active])
  if (allowed.length < 2) return null
  return (
    <nav ref={navRef} aria-label={t("menu.label")} className={cn("overflow-x-auto [scrollbar-width:none]", className)}>
      <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
        {allowed.map((s) => {
          const on = s.id === active
          return (
            <Link
              key={s.id}
              href={s.href}
              aria-current={on ? "page" : undefined}
              data-state={on ? "active" : "inactive"}
              className="inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-[color,background-color,box-shadow] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              {t(`sections.${s.id}`)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/** The app-bar ⋯ menu on mobile section pages: All settings, Audit log, My account (minus the page you're on). */
export function useSettingsMenuItems(active: SectionId): ActionItem[] {
  const { t } = useSetText()
  return [
    { key: "all", icon: "setting-2", label: t("menu.all"), href: "/settings" },
    active !== "audit" && canOpenSection("audit") && { key: "audit", icon: "document-text", label: t("menu.audit"), href: sectionById("audit").href },
    active !== "account" && { key: "account", icon: "profile-circle", label: t("menu.account"), href: sectionById("account").href },
  ].filter(Boolean) as ActionItem[]
}

/**
 * Mobile section page bar (replaces the app bar): back arrow (→ Settings home, or the list for inner pages), the page
 * title, and ⋯ with the page's menu.
 */
function MobilePageBar({ title, back, menu, menuTitle }: { title: string; back: string; menu: ActionItem[]; menuTitle: string }) {
  const { t } = useSetText()
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href={back} aria-label={t("menu.back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      {menu.length > 0 && (
        <ActionMenu
          title={menuTitle}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("menu.more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[menu]}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ frame */

/**
 * Settings frame (every section): desktop (xl) = the menu card (240) beside the section; md–lg = the sections as a scrolling
 * tab row with the page actions in a row under it; mobile = the section as its own page (back to the Settings home, ⋯ menu),
 * with the actions on top, or in a fixed action bar for form sections. Sections the user's roles don't grant show "no access".
 */
export function SettingsFrame({
  section,
  inner,
  title,
  actions,
  menu,
  children,
}: {
  section: SectionId
  /** Inner page (User, ZATCA): keeps its list section active and goes back to it. */
  inner?: InnerPage
  /** Page title override (an inner page's subject, e.g. the user's name). */
  title?: string
  actions?: React.ReactNode
  /** Mobile ⋯ menu override (User and ZATCA have their own). */
  menu?: ActionItem[]
  children?: React.ReactNode
}) {
  const { t } = useSetText()
  const def = sectionById(section)
  const ok = canOpenSection(section)
  const home = section === "overview"
  const parent = inner ? sectionById(INNER_PARENT[inner]) : undefined
  const pageTitle = title ?? t(`pageTitles.${inner ?? section}`)
  const defaultMenu = useSettingsMenuItems(section)

  // Header: Overview = "Home / Settings"; a section = "Settings / General"; an inner page = "Settings / Users / Sara".
  usePageTitle({
    title: pageTitle,
    crumbs: home
      ? [{ label: t("crumbHome"), href: "/dashboard" }]
      : [{ label: t("title"), href: "/settings" }, ...(parent ? [{ label: t(`sections.${parent.id}`), href: parent.href }] : [])],
    // Inner pages (User, ZATCA) have the header back button to their list.
    back: parent?.href,
    mobileTitle: true,
  })

  const form = !!def.form && !inner
  return (
    <>
      {!home && <MobilePageBar title={pageTitle} back={parent?.href ?? "/settings"} menu={menu ?? defaultMenu} menuTitle={inner ? pageTitle : t("menu.title")} />}
      <PageContainer>
        <div className="flex min-w-0 flex-col gap-6 xl:flex-row xl:items-start">
          <SettingsMenu active={parent?.id ?? section} className="hidden w-60 shrink-0 xl:flex" />
          <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-3 xl:gap-6">
            <SettingsTabs active={parent?.id ?? section} className="hidden md:block xl:hidden" />
            {ok && actions && (
              <div
                className={cn(
                  "flex gap-2 md:justify-end",
                  "*:data-[slot=button]:h-10 *:data-[slot=button]:flex-1 *:data-[slot=button]:px-6 md:*:data-[slot=button]:h-9 md:*:data-[slot=button]:flex-none md:*:data-[slot=button]:px-4",
                  form && "max-md:hidden"
                )}
              >
                {actions}
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-6">{ok ? children : <NoAccess />}</div>
          </div>
        </div>
      </PageContainer>
      {ok && form && actions && <MobileActionBar>{actions}</MobileActionBar>}
    </>
  )
}

export function NoAccess() {
  const { t } = useSetText()
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState
        icon="lock"
        title={t("frame.noAccess")}
        description={t("frame.noAccessText")}
        className="py-16"
        actions={
          <Button variant="outline" asChild>
            <Link href={sectionById("account").href}>{t("frame.openAccount")}</Link>
          </Button>
        }
      />
    </div>
  )
}

/** Placeholder body for the sections that land in a later build step. */
export function BuildingCard({ section }: { section: SectionId }) {
  const { t } = useSetText()
  const def = sectionById(section)
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState icon={def.icon} title={t("frame.building")} description={t("frame.buildingText", { n: def.step })} className="py-16" />
    </div>
  )
}

/** A dated value in the user's language ("1 Mar" / "1 مارس"). */
export function useDayMonth() {
  const dates = useDates()
  const locale = useLocale()
  return (iso: string) => isolateLatin(dates.dayMonth(iso), locale)
}
