"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { NAV_GROUPS, type ModuleDef } from "@/config/modules"
import { activeTab, visibleModules, moduleHome, moduleTabs } from "@/lib/modules"
import { NAV_BADGES } from "@/lib/mock/shell"
import { Icon, type IconName } from "@/components/ds/icon"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSessionUser } from "./session"
import { useNav } from "./use-shell"

/**
 * DS sheet 08 · Sidebar Rail (64px): brand mark · groups of 40px Rail Items separated by 32px dividers ·
 * spacer · Settings / Log out · avatar. Active = sidebar-accent + Bold icon; dot badge for unread.
 * Labels show as tooltips on the inline-end side; modules with tabs open the Rail Flyout (tree) instead
 * (prototype: rail "Patients" → "collapsed + tree flyout").
 */
export function Rail() {
  const user = useSessionUser()
  const { current, t, inSettings } = useNav()
  const mods = visibleModules()
  const groups = NAV_GROUPS.map((g) => mods.filter((m) => m.group === g)).filter((g) => g.length)

  return (
    <div className="flex h-full flex-col items-center gap-4 px-3 pt-5 pb-4">
      <Link
        href="/dashboard"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Icon name="hospital" size={20} />
        <span className="sr-only">{useTranslations("common")("app.name")}</span>
      </Link>
      <nav aria-label={t("header.mainNav")} className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto [scrollbar-width:none]">
        {groups.map((items, i) => (
          <React.Fragment key={i}>
            <span aria-hidden className="h-px w-8 shrink-0 bg-sidebar-border" />
            <div className="flex flex-col gap-1">
              {items.map((m) => (
                <RailModule key={m.id} m={m} active={current?.id === m.id} />
              ))}
            </div>
          </React.Fragment>
        ))}
      </nav>
      <div className="flex flex-col gap-1">
        <RailLink href="/settings" icon="setting-2" label={t("nav.settings")} active={inSettings} />
        <RailLink href="/logout" icon="logout" label={t("nav.logout")} destructive />
      </div>
      <Avatar>
        <AvatarFallback>{user.initials}</AvatarFallback>
      </Avatar>
    </div>
  )
}

const railItem =
  "relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50 data-[active]:bg-sidebar-accent data-[active]:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent"

function Dot({ show }: { show?: boolean }) {
  if (!show) return null
  return <span aria-hidden className="absolute end-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-sidebar" />
}

function useEndSide() {
  return useLocale() === "ar" ? ("left" as const) : ("right" as const)
}

function RailLink({ href, icon, label, active, dot, destructive }: { href: string; icon: IconName; label: string; active?: boolean; dot?: boolean; destructive?: boolean }) {
  const side = useEndSide()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={href} prefetch={href === "/logout" ? false : undefined} aria-label={label} aria-current={active ? "page" : undefined} data-active={active || undefined} className={cn(railItem, destructive && "text-destructive hover:bg-destructive-soft hover:text-destructive")}>
          <Icon name={icon} size={20} variant={active ? "bold" : "linear"} />
          <Dot show={dot} />
        </Link>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

function RailModule({ m, active }: { m: ModuleDef; active: boolean }) {
  const { label, tabLabel, pathname } = useNav()
  const side = useEndSide()
  const tabs = moduleTabs(m)
  const [open, setOpen] = React.useState(false)

  if (tabs.length < 2) {
    return <RailLink href={moduleHome(m)} icon={m.icon} label={label(m)} active={active} dot={!!NAV_BADGES[m.id]} />
  }

  const current = active ? activeTab(m, pathname) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label(m)} data-active={active || undefined} className={railItem}>
          <Icon name={m.icon} size={20} variant={active ? "bold" : "linear"} />
          <Dot show={!!NAV_BADGES[m.id]} />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align="start" sideOffset={12} className="w-55 gap-0.5 rounded-lg p-1 shadow-md">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-popover-foreground">{label(m)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{tabs.length}</span>
        </div>
        <span aria-hidden className="h-px bg-border" />
        {tabs.map((tab) => {
          const on = current?.key === tab.key
          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={() => setOpen(false)}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex h-8 items-center rounded-sm px-2 text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              )}
            >
              {tabLabel(m, tab.key)}
            </Link>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
