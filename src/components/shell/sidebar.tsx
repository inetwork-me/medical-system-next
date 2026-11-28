"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { NAV_GROUPS, type ModuleDef } from "@/config/modules"
import { activeTab, visibleModules, moduleHome, moduleTabs } from "@/lib/modules"
import { bi } from "@/lib/mock/bi"
import { NAV_BADGES } from "@/lib/mock/shell"
import { Icon, type IconName } from "@/components/ds/icon"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useSessionUser } from "./session"
import { useNav } from "./use-shell"

/**
 * DS sheet 08 · Sidebar (expanded, 256px): brand · grouped nav (scrolls) · footer (Settings, Log out) · user card.
 * Nav Item 40px, px-3, gap-3, rounded-md, 14 Medium; active = sidebar-accent + Bold icon; optional count pill;
 * modules with tabs expand into a tree (Nav Sub Item 32px, rounded-sm) with a start-side guide line.
 * Used on desktop (≥1024) and inside the tablet overlay.
 */
export function SidebarPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { current, t, inSettings } = useNav()
  const mods = visibleModules()

  return (
    <div className="flex h-full flex-col gap-6 px-3 pt-5 pb-4">
      <Brand onNavigate={onNavigate} />
      <nav aria-label={t("header.mainNav")} className="-mx-3 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3">
        {NAV_GROUPS.map((g) => {
          const items = mods.filter((m) => m.group === g)
          if (!items.length) return null
          return (
            <div key={g} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{t(`groups.${g}`)}</p>
              {items.map((m) => (
                <SidebarModule key={m.id} m={m} active={current?.id === m.id} onNavigate={onNavigate} />
              ))}
            </div>
          )
        })}
      </nav>
      <div className="flex flex-col gap-0.5">
        <NavRow href="/settings" icon="setting-2" label={t("nav.settings")} active={inSettings} onNavigate={onNavigate} />
        <NavRow href="/logout" icon="logout" label={t("nav.logout")} onNavigate={onNavigate} destructive />
      </div>
      <UserCard />
    </div>
  )
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  const tc = useTranslations("common")
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-md px-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <Icon name="hospital" size={18} />
      </span>
      <span className="truncate text-lg font-semibold text-foreground">{tc("app.name")}</span>
    </Link>
  )
}

const rowBase =
  "group/row flex h-10 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"

function CountPill({ count, active }: { count?: number; active?: boolean }) {
  if (!count) return null
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-xs font-medium tabular-nums",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}
    >
      {count}
    </span>
  )
}

function NavRow({
  href,
  icon,
  label,
  active,
  count,
  onNavigate,
  destructive,
}: {
  href: string
  icon: IconName
  label: string
  active?: boolean
  count?: number
  onNavigate?: () => void
  /** Log out: destructive text, destructive-soft hover. */
  destructive?: boolean
}) {
  return (
    <Link
      href={href}
      prefetch={href === "/logout" ? false : undefined}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(rowBase, active && "bg-sidebar-accent text-sidebar-accent-foreground", destructive && "text-destructive hover:bg-destructive-soft hover:text-destructive")}
    >
      <Icon name={icon} size={20} variant={active ? "bold" : "linear"} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <CountPill count={count} active={active} />
    </Link>
  )
}

function SidebarModule({ m, active, onNavigate }: { m: ModuleDef; active: boolean; onNavigate?: () => void }) {
  const { label, tabLabel, pathname } = useNav()
  const tabs = moduleTabs(m)
  // Expanded by default while the module is active; the user's own toggle wins after that.
  const [override, setOverride] = React.useState<boolean | null>(null)
  const open = override ?? active
  const setOpen = (fn: (o: boolean) => boolean) => setOverride(fn(open))
  const id = React.useId()

  if (tabs.length < 2) {
    return <NavRow href={moduleHome(m)} icon={m.icon} label={label(m)} active={active} count={NAV_BADGES[m.id]} onNavigate={onNavigate} />
  }

  const current = active ? activeTab(m, pathname) : undefined
  return (
    <div>
      {/* With the tree open the active sub item carries the highlight; collapsed, the parent row does. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(rowBase, active && !open && "bg-sidebar-accent text-sidebar-accent-foreground")}
      >
        <Icon name={m.icon} size={20} variant={active ? "bold" : "linear"} />
        <span className="min-w-0 flex-1 truncate text-start">{label(m)}</span>
        <CountPill count={NAV_BADGES[m.id]} />
        <Icon name={open ? "arrow-down" : "arrow-right-1"} size={16} />
      </button>
      <div id={id} hidden={!open} className="ps-5.5">
        <div className="flex flex-col gap-0.5 border-s border-sidebar-border py-0.5 ps-2.5">
          {tabs.map((tab) => {
            const on = current?.key === tab.key
            return (
              <Link
                key={tab.key}
                href={tab.href}
                onClick={onNavigate}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-sm px-2 text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
                  on && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                )}
              >
                <span className="truncate">{tabLabel(m, tab.key)}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function UserCard() {
  const user = useSessionUser()
  const locale = useLocale()
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border p-2">
      <Avatar>
        <AvatarFallback>{user.initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{bi(user.name, locale)}</p>
        <p className="truncate text-xs text-muted-foreground">{bi(user.role, locale)}</p>
      </div>
    </div>
  )
}
