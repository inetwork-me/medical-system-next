"use client"

import * as React from "react"

import { useIsMobile } from "@/hooks/use-media-query"
import type { IconName } from "@/components/ds/icon"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"

/**
 * Prototype rule: desktop/tablet overlays open as a centred dialog, mobile ones as a bottom sheet.
 * Footer: dialog = [secondary, primary] at the end; sheet = full-width stack, primary first.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  tone,
  width = "sm:max-w-120",
  primary,
  secondary,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  icon?: IconName
  tone?: React.ComponentProps<typeof DialogHeader>["tone"]
  /** Dialog max width class (design widths: 440 / 480 / 500 / 520). */
  width?: string
  primary?: React.ReactNode
  secondary?: React.ReactNode
  children?: React.ReactNode
}) {
  const mobile = useIsMobile()
  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          {children && <DrawerBody className="flex flex-col gap-4">{children}</DrawerBody>}
          {(primary || secondary) && (
            <DrawerFooter>
              {primary}
              {secondary}
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={width}>
        <DialogHeader icon={icon} tone={tone}>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children && <div className="flex flex-col gap-4">{children}</div>}
        {(primary || secondary) && (
          <DialogFooter>
            {secondary}
            {primary}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
