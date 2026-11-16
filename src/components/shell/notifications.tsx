"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi } from "@/lib/mock/bi"
import { NOTIFICATIONS, type NotificationItem } from "@/lib/mock/shell"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const TONE: Record<NotificationItem["tone"], string> = {
  info: "bg-info-soft text-info-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  destructive: "bg-destructive-soft text-destructive-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  accent: "bg-accent text-primary",
}

function useNotifications() {
  const [items, setItems] = React.useState(NOTIFICATIONS)
  const unread = items.filter((n) => n.unread).length
  return { items, unread, markAll: () => setItems((xs) => xs.map((n) => ({ ...n, unread: false }))) }
}

/** Notification row: 36px tinted tile (18 icon) · title 14 Medium · meta + time 12 muted · unread dot at the end. */
function NotificationRow({ n, shaded }: { n: NotificationItem; shaded: boolean }) {
  const locale = useLocale()
  return (
    <li className={cn("flex items-start gap-3 border-b px-4 py-3", shaded && n.unread && "bg-accent")}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE[n.tone])}>
        <Icon name={n.icon} size={18} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">{bi(n.title, locale)}</p>
        <p className="text-xs text-muted-foreground">{bi(n.meta, locale)}</p>
        <p className="text-xs text-muted-foreground">{bi(n.time, locale)}</p>
      </div>
      {n.unread && <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
    </li>
  )
}

/** Desktop / tablet: bell → anchored panel (380 wide, rounded-xl, shadow-lg) with header, list, footer. */
export function NotificationsButton() {
  const t = useTranslations("shell")
  const { items, unread, markAll } = useNotifications()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${t("header.notifications")} · ${t("notifications.unread", { count: unread })}`} className="relative">
          <Icon name="notification" size={24} />
          {unread > 0 && <span aria-hidden className="absolute end-2 top-2 size-2 rounded-full bg-primary ring-2 ring-card" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-95 gap-0 overflow-hidden rounded-xl p-0 shadow-lg">
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
          <h2 className="min-w-0 flex-1 text-lg font-semibold text-foreground">{t("notifications.title")}</h2>
          <Button variant="link" size="sm" onClick={markAll} disabled={!unread}>
            {t("notifications.markAll")}
          </Button>
        </div>
        <ul className="max-h-[min(70dvh,32rem)] overflow-y-auto border-t">
          {items.map((n) => (
            <NotificationRow key={n.id} n={n} shaded />
          ))}
        </ul>
        <div className="flex justify-center p-2.5">
          <Button variant="ghost" size="sm">
            {t("notifications.viewAll")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Mobile: bottom sheet with "n unread" subtitle. */
export function MobileNotifications({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("shell.notifications")
  const { items, unread } = useNotifications()
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t("title")}</DrawerTitle>
          <DrawerDescription>{t("unread", { count: unread })}</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="-mx-4">
          <ul>
            {items.map((n) => (
              <NotificationRow key={n.id} n={n} shaded={false} />
            ))}
          </ul>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
