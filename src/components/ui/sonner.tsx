"use client"

import type { CSSProperties } from "react"
import { useLocale } from "next-intl"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useIsMobile } from "@/hooks/use-media-query"

/**
 * Host for DS sheet 10 · Toast. It only positions the stack: bottom-end on desktop/tablet, top on mobile.
 * Every toast is rendered by <ToastCard> through `notify` (src/components/ds/toast.tsx), so nothing here styles toasts.
 */
const Toaster = (props: ToasterProps) => {
  const rtl = useLocale() === "ar"
  const mobile = useIsMobile()

  return (
    <Sonner
      dir={rtl ? "rtl" : "ltr"}
      position={mobile ? "top-center" : rtl ? "bottom-left" : "bottom-right"}
      visibleToasts={3}
      gap={12}
      style={{ "--width": "360px" } as CSSProperties}
      toastOptions={{ unstyled: true, classNames: { toast: "w-full sm:w-90" } }}
      {...props}
    />
  )
}

export { Toaster }
