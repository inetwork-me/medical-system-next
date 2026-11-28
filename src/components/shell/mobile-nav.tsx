"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { activeTab, visibleModules, moduleHome } from "@/lib/modules"
import { bi } from "@/lib/mock/bi"
import { NAV_BADGES } from "@/lib/mock/shell"
import { Icon } from "@/components/ds/icon"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useSessionUser } from "./session"
import { usePageTitleValue } from "./page-title"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from "@/components/ui/drawer"
import { MobileSearch } from "./header-search"
import { MobileNotifications } from "./notifications"
import { MobileUserMenu } from "./user-menu"
import { useLocaleSwitch, useNav } from "./use-shell"

/**
 * DS sheet 08 · App Bar Mobile (56px, card, border-b): avatar (→ user menu sheet) · page title (18 SemiBold) ·
 * ghost icon buttons: search (→ top panel), language (→ other locale), notifications (→ bottom sheet).
 */
export function MobileAppBar({ className }: { className?: string }) {
  const user = useSessionUser()
  const { current, label, tabLabel, pathname, t } = useNav()
  const tab = current ? activeTab(current, pathname) : undefined
  // Tabs with their own title (Header v2: "Doctors › Credentials") show that title here too.
  const own = usePageTitleValue()
  const title = own?.mobileTitle ? own.title : current ? (tab?.ownTitle ? tabLabel(current, tab.key) : label(current)) : ""
  const tc = useTranslations("common")
  const { other, switchLocale } = useLocaleSwitch()
  const [sheet, setSheet] = React.useState<null | "user" | "search" | "notifications">(null)
  const set = (s: typeof sheet) => (o: boolean) => setSheet(o ? s : null)

  return (
    <>
      <header className={cn("sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-card ps-4 pe-3", className)}>
        <button
          type="button"
          onClick={() => setSheet("user")}
          aria-label={t("header.accountMenu")}
          className="cursor-pointer rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Avatar size="sm">
            <AvatarFallback>{user.initials}</AvatarFallback>
          </Avatar>
        </button>
        <p className="ms-1 min-w-0 flex-1 truncate text-lg font-semibold text-foreground">{title}</p>
        <Button variant="ghost" size="icon" aria-label={tc("actions.search")} onClick={() => setSheet("search")}>
          <Icon name="search-normal-1" size={24} />
        </Button>
        <Button variant="ghost" size="icon" aria-label={tc("language.switchLabel")} onClick={switchLocale} lang={other}>
          <Icon name="language-square" size={24} />
        </Button>
        <Button variant="ghost" size="icon" aria-label={t("header.notifications")} onClick={() => setSheet("notifications")}>
          <Icon name="notification" size={24} />
        </Button>
      </header>
      <MobileUserMenu open={sheet === "user"} onOpenChange={set("user")} />
      <MobileSearch open={sheet === "search"} onOpenChange={set("search")} />
      <MobileNotifications open={sheet === "notifications"} onOpenChange={set("notifications")} />
    </>
  )
}

/**
 * DS sheet 08 · Bottom Navigation (mobile web app): up to 4 module slots (Home, Patients, Appointments, Messages —
 * whichever are enabled) + More. Item = 56×32 pill indicator (accent when active, Bold icon) + 12 Medium label;
 * dot badge for unread. Hidden on form pages (they render a <MobileActionBar>).
 */
export function BottomNav({ className }: { className?: string }) {
  const { current, label, t, inSettings } = useNav()
  const [more, setMore] = React.useState(false)
  const slots = visibleModules().filter((m) => m.mobile === "bottom")
  const moreActive = current?.mobile === "more" || inSettings

  return (
    <>
      <nav
        aria-label={t("header.mainNav")}
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 grid border-t bg-card px-2 pb-[max(--spacing(5),env(safe-area-inset-bottom))]",
          className
        )}
        style={{ gridTemplateColumns: `repeat(${slots.length + 1}, minmax(0, 1fr))` }}
      >
        {slots.map((m) => {
          const active = current?.id === m.id
          return (
            <Link key={m.id} href={moduleHome(m)} aria-current={active ? "page" : undefined} className={itemCls}>
              <Indicator active={active} dot={!!NAV_BADGES[m.id]}>
                <Icon name={m.icon} size={24} variant={active ? "bold" : "linear"} />
              </Indicator>
              <span className={cn("truncate text-xs font-medium", active ? "text-primary" : "text-muted-foreground")}>
                {label(m, true)}
              </span>
            </Link>
          )
        })}
        <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={itemCls}>
          <Indicator active={moreActive || more}>
            <Icon name="menu" size={24} variant={moreActive ? "bold" : "linear"} />
          </Indicator>
          <span className={cn("text-xs font-medium", moreActive ? "text-primary" : "text-muted-foreground")}>{t("nav.more")}</span>
        </button>
      </nav>
      <MoreSheet open={more} onOpenChange={setMore} />
    </>
  )
}

const itemCls =
  "flex min-w-0 cursor-pointer flex-col items-center gap-1 pt-2 pb-1.5 outline-none focus-visible:[&>span:first-child]:ring-[3px] focus-visible:[&>span:first-child]:ring-ring/50"

function Indicator({ active, dot, children }: { active?: boolean; dot?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "relative flex h-8 w-14 items-center justify-center rounded-full transition-colors",
        active ? "bg-accent text-primary" : "text-foreground"
      )}
    >
      {children}
      {dot && <span aria-hidden className="absolute end-3 top-0.5 size-2 rounded-full bg-primary ring-2 ring-card" />}
    </span>
  )
}

/**
 * DS sheet 08 · More Sheet: title + close · profile row (→ profile) · destination tiles for the modules that
 * don't fit the bottom nav (3 per row, muted tile, 40px card icon tile) · settings list: Language (→ other locale),
 * Dark mode (switch; postponed), Settings, Log out (destructive).
 */
function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useSessionUser()
  const { label, t } = useNav()
  const locale = useLocale()
  const tc = useTranslations("common.language")
  const { other, switchLocale } = useLocaleSwitch()
  const tiles = visibleModules().filter((m) => m.mobile === "more")
  const close = () => onOpenChange(false)
  const row = "flex h-13 w-full items-center gap-3 px-3.5 text-sm font-medium text-foreground outline-none hover:bg-muted/60 focus-visible:bg-muted/60"

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-popover">
        <DrawerHeader>
          <DrawerTitle>{t("more.title")}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-4">
          <Link href="/settings/account" onClick={close} className="flex items-center gap-3 rounded-xl border p-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Avatar>
              <AvatarFallback>{user.initials}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{bi(user.name, locale)}</span>
              <span className="truncate text-xs text-muted-foreground">
                {bi(user.role, locale)} · {bi(user.facility, locale)}
              </span>
            </span>
            <Icon name="arrow-right-1" size={16} className="text-muted-foreground" />
          </Link>

          {tiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {tiles.map((m) => (
                <Link
                  key={m.id}
                  href={moduleHome(m)}
                  onClick={close}
                  className="flex flex-col items-center gap-2 rounded-xl bg-muted px-1 pt-3.5 pb-3 text-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-card text-primary">
                    <Icon name={m.icon} size={20} />
                  </span>
                  <span className="text-xs font-medium text-foreground">{label(m, true)}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="flex flex-col divide-y overflow-hidden rounded-xl border">
            <button type="button" onClick={() => { close(); switchLocale() }} className={cn(row, "cursor-pointer")}>
              <Icon name="language-square" size={20} />
              <span className="flex-1 text-start">{t("more.language")}</span>
              <span lang={other} className="font-normal text-muted-foreground">{tc("other")}</span>
              <Icon name="arrow-right-1" size={16} className="text-muted-foreground" />
            </button>
            <Link href="/settings" onClick={close} className={row}>
              <Icon name="setting-2" size={20} />
              <span className="flex-1">{t("nav.settings")}</span>
              <Icon name="arrow-right-1" size={16} className="text-muted-foreground" />
            </Link>
            <Link href="/logout" prefetch={false} onClick={close} className={cn(row, "text-destructive")}>
              <Icon name="logout" size={20} />
              <span className="flex-1">{t("nav.logout")}</span>
            </Link>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
