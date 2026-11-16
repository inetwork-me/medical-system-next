"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { OverlayCloseIcon } from "@/components/ui/dialog"

/**
 * Side drawer (desktop/tablet overlays with prototype position topRight/topLeft = inline-end/start).
 * Uses logical sides: "end" opens from the right in English and from the left in Arabic.
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "end",
  showCloseButton = true,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "start" | "end" | "top" | "bottom"
  showCloseButton?: boolean
  overlayClassName?: string
}) {
  return (
    <SheetPortal>
      <SheetOverlay className={overlayClassName} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-5 bg-card text-card-foreground shadow-lg transition ease-in-out outline-none data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-300",
          side === "end" &&
            "inset-y-0 end-0 h-full w-full border-s data-[state=closed]:slide-out-to-end data-[state=open]:slide-in-from-end sm:max-w-md",
          side === "start" &&
            "inset-y-0 start-0 h-full w-full border-e data-[state=closed]:slide-out-to-start data-[state=open]:slide-in-from-start sm:max-w-md",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="absolute top-6 end-6 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <OverlayCloseIcon />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1 px-6 pt-6 pe-16", className)} {...props} />
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={cn("min-h-0 flex-1 overflow-y-auto px-6", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn("text-lg font-semibold text-foreground", className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-xs text-muted-foreground", className)} {...props} />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription }
