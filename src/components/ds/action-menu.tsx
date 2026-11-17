"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { Icon, type IconName } from "@/components/ds/icon"
import { useIsMobile } from "@/hooks/use-media-query"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"

export type ActionItem = {
  key: string
  icon: IconName
  label: React.ReactNode
  href?: string
  onSelect?: () => void
  destructive?: boolean
  disabled?: boolean
}

/**
 * Actions menu (FigCraft · Row actions / More actions): anchored dropdown on desktop & tablet, bottom sheet on
 * mobile with a title (+ description) and close button. Items come in groups separated by a divider.
 */
export function ActionMenu({
  trigger,
  groups,
  title,
  description,
  align = "end",
  width = "w-60",
}: {
  trigger: React.ReactElement
  groups: (ActionItem | false | null | undefined)[][]
  title: React.ReactNode
  description?: React.ReactNode
  align?: "start" | "end"
  width?: string
}) {
  const mobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const clean = groups.map((g) => g.filter(Boolean) as ActionItem[]).filter((g) => g.length)

  if (mobile) {
    const close = () => setOpen(false)
    return (
      <>
        {React.cloneElement(trigger as React.ReactElement<{ onClick?: () => void }>, { onClick: () => setOpen(true) })}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
              {description && <DrawerDescription>{description}</DrawerDescription>}
            </DrawerHeader>
            <ul className="flex flex-col">
              {clean.map((g, gi) =>
                g.map((it, i) => {
                  const cls = cn(
                    "flex h-12 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-foreground outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50",
                    it.destructive && "text-destructive"
                  )
                  const icon = <Icon name={it.icon} size={20} className={it.destructive ? undefined : "text-muted-foreground"} />
                  return (
                    <li key={it.key} className={cn(gi > 0 && i === 0 && "mt-1 border-t pt-1")}>
                      {it.href && !it.disabled ? (
                        <Link href={it.href} onClick={close} className={cls}>
                          {icon}
                          {it.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={it.disabled}
                          onClick={() => {
                            close()
                            it.onSelect?.()
                          }}
                          className={cls}
                        >
                          {icon}
                          {it.label}
                        </button>
                      )}
                    </li>
                  )
                })
              )}
            </ul>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={width}>
        {clean.map((g, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            {g.map((it) =>
              it.href ? (
                <DropdownMenuItem key={it.key} asChild disabled={it.disabled} variant={it.destructive ? "destructive" : "default"}>
                  <Link href={it.href}>
                    <Icon name={it.icon} size={16} />
                    {it.label}
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={it.key} disabled={it.disabled} variant={it.destructive ? "destructive" : "default"} onSelect={it.onSelect}>
                  <Icon name={it.icon} size={16} />
                  {it.label}
                </DropdownMenuItem>
              )
            )}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
