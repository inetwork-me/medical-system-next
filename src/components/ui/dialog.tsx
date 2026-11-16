"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Icon, type IconName } from "@/components/ds/icon"

/**
 * DS sheet 10 · Dialog: 480 wide, p-6, gap-5, bg-card, border, shadow-lg, rounded-2xl.
 * Header = optional 40px icon tile (accent / status soft) + title (18 SemiBold) + description (12 muted),
 * close = ghost 32px button with close-circle. Footer = buttons aligned to the end, gap-2.
 * On mobile the same content opens as a bottom sheet (<Drawer>) — screens pick per breakpoint.
 */
function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

/** Ghost 32px close button used by every overlay (Dialog, Sheet, Bottom Sheet, Toast). */
function OverlayCloseIcon({ className }: { className?: string }) {
  const t = useTranslations("common.actions")
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      <Icon name="close-circle" size={24} />
      <span className="sr-only">{t("close")}</span>
    </span>
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-1/2 gap-5 overflow-y-auto rounded-2xl border bg-card p-6 text-card-foreground shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-120",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-6 end-6 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <OverlayCloseIcon />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

const TILE_TONE = {
  primary: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  destructive: "bg-destructive-soft text-destructive-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
} as const

function DialogHeader({
  className,
  icon,
  tone = "primary",
  children,
  ...props
}: React.ComponentProps<"div"> & { icon?: IconName; tone?: keyof typeof TILE_TONE }) {
  return (
    <div data-slot="dialog-header" className={cn("flex items-start gap-3 pe-10", className)} {...props}>
      {icon && (
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TILE_TONE[tone])}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
    </div>
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-lg font-semibold text-foreground", className)} {...props} />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  OverlayCloseIcon,
}
