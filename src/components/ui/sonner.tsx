"use client"

import { useLocale } from "next-intl"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { Icon } from "@/components/ds/icon"
import { Spinner } from "@/components/ds/spinner"
import { useIsMobile } from "@/hooks/use-media-query"

/**
 * DS sheet 10 · Toast: 360 wide, p-4, gap-3, rounded-xl, bg-popover, border, shadow-lg; tone icon 20
 * (tick-circle / info-circle / warning-2 / danger) + title 14 Medium + description 12 muted + ghost close.
 * Position (brief §3): bottom-end on desktop/tablet, top on mobile.
 */
const Toaster = (props: ToasterProps) => {
  const rtl = useLocale() === "ar"
  const mobile = useIsMobile()

  return (
    <Sonner
      dir={rtl ? "rtl" : "ltr"}
      position={mobile ? "top-center" : rtl ? "bottom-left" : "bottom-right"}
      closeButton
      icons={{
        success: <Icon name="tick-circle" size={20} className="text-success" />,
        info: <Icon name="info-circle" size={20} className="text-info" />,
        warning: <Icon name="warning-2" size={20} className="text-warning" />,
        error: <Icon name="danger" size={20} className="text-destructive" />,
        loading: <Spinner size="sm" />,
        close: <Icon name="close-circle" size={24} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg sm:w-90 font-sans",
          icon: "mt-0 flex size-5 shrink-0 items-center justify-center",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "text-sm font-medium text-foreground",
          description: "text-xs text-muted-foreground",
          closeButton:
            "order-last -my-1.5 -me-1.5 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground",
          actionButton:
            "inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground",
          cancelButton: "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-accent",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
