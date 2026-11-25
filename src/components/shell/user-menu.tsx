"use client"

import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { bi } from "@/lib/mock/bi"
import { SESSION_USER } from "@/lib/mock/shell"
import { Icon, type IconName } from "@/components/ds/icon"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLocaleSwitch } from "./use-shell"

type Item = { icon: IconName; label: string; href?: string; onSelect?: () => void; destructive?: boolean; lang?: string }

function useItems(): Item[] {
  const t = useTranslations("shell.nav")
  const tc = useTranslations("common.language")
  const { other, switchLocale } = useLocaleSwitch()
  return [
    { icon: "profile-circle", label: t("profile"), href: "/settings/account" },
    { icon: "setting-2", label: t("settings"), href: "/settings" },
    { icon: "language-square", label: tc("other"), onSelect: switchLocale, lang: other },
    { icon: "info-circle", label: t("help"), href: "/help" },
    { icon: "logout", label: t("logout"), href: "/logout", destructive: true },
  ]
}

/**
 * Desktop / tablet user menu (prototype: header avatar → "User menu", anchored bottom-end):
 * 260 wide, rounded-xl, shadow-md; header = avatar + name + e-mail; items 36px with 16 icons; Log out in destructive.
 */
export function UserMenuButton() {
  const t = useTranslations("shell.header")
  const locale = useLocale()
  const items = useItems()
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={t("accountMenu")} className="cursor-pointer rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Avatar>
            <AvatarFallback>{SESSION_USER.initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-65 overflow-hidden rounded-xl p-0">
        <div className="flex items-center gap-2.5 border-b p-3">
          <Avatar>
            <AvatarFallback>{SESSION_USER.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{bi(SESSION_USER.name, locale)}</p>
            <p className="truncate text-xs text-muted-foreground">
              <bdi dir="ltr">{SESSION_USER.email}</bdi>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 p-1.5">
          {items.map((it) => (
            <MenuEntry key={it.icon} it={it} />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuEntry({ it }: { it: Item }) {
  const cls = "h-9 gap-2.5 rounded-md px-2.5"
  const inner = (
    <>
      <Icon name={it.icon} size={16} />
      <span lang={it.lang}>{it.label}</span>
    </>
  )
  return (
    <>
      {it.destructive && <DropdownMenuSeparator className="mx-0" />}
      {it.href ? (
        <DropdownMenuItem asChild variant={it.destructive ? "destructive" : "default"} className={cls}>
          <Link href={it.href} prefetch={it.href === "/logout" ? false : undefined}>{inner}</Link>
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onSelect={it.onSelect} className={cls}>
          {inner}
        </DropdownMenuItem>
      )}
    </>
  )
}

/** Mobile (prototype: app-bar avatar → bottom sheet): name + "role · branch" header, same items as a list. */
export function MobileUserMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const locale = useLocale()
  const items = useItems()
  const close = () => onOpenChange(false)
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{bi(SESSION_USER.name, locale)}</DrawerTitle>
          <DrawerDescription>
            {bi(SESSION_USER.role, locale)} · {bi(SESSION_USER.branch, locale)}
          </DrawerDescription>
        </DrawerHeader>
        <ul className="flex flex-col">
          {items.map((it) => {
            const cls = cn(
              "flex h-12 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-foreground outline-none hover:bg-accent focus-visible:bg-accent",
              it.destructive && "text-destructive"
            )
            return (
              <li key={it.icon} className={cn(it.destructive && "mt-1 border-t pt-1")}>
                {it.href ? (
                  <Link href={it.href} prefetch={it.href === "/logout" ? false : undefined} onClick={close} className={cls}>
                    <Icon name={it.icon} size={20} />
                    {it.label}
                  </Link>
                ) : (
                  <button type="button" onClick={() => { close(); it.onSelect?.() }} className={cls} lang={it.lang}>
                    <Icon name={it.icon} size={20} />
                    {it.label}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </DrawerContent>
    </Drawer>
  )
}
