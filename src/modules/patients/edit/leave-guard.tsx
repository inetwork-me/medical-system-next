"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Button } from "@/components/ui/button"

/**
 * Unsaved-changes guard for form pages: while `dirty`, in-app link clicks (sidebar, breadcrumb, any <a>) open the
 * "Discard your changes?" overlay instead of navigating; reload / close uses the browser prompt.
 * Page buttons call `leave(href)` (asks when dirty); call `allow()` before navigating after a save.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter()
  const [pending, setPending] = React.useState<string | null>(null)
  const leaving = React.useRef(false)

  React.useEffect(() => {
    if (!dirty) return
    const onClick = (e: MouseEvent) => {
      if (leaving.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      e.preventDefault()
      e.stopPropagation()
      setPending(url.pathname + url.search)
    }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!leaving.current) e.preventDefault()
    }
    document.addEventListener("click", onClick, true)
    window.addEventListener("beforeunload", onUnload)
    return () => {
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("beforeunload", onUnload)
    }
  }, [dirty])

  return {
    pending,
    /** Navigate to a full path (with locale), asking first when there are unsaved edits. */
    leave: (href: string) => (dirty ? setPending(href) : router.push(href)),
    allow: () => {
      leaving.current = true
    },
    keep: () => setPending(null),
    discard: () => {
      leaving.current = true
      const target = pending
      setPending(null)
      if (target) router.push(target)
    },
  }
}

/** Overlay · Unsaved changes ("Discard your changes?"): Keep editing · Discard changes (destructive). */
export function UnsavedDialog({ guard, count }: { guard: ReturnType<typeof useLeaveGuard>; count: number }) {
  const t = useTranslations("patients.edit.unsaved")
  return (
    <ResponsiveDialog
      open={guard.pending !== null}
      onOpenChange={(o) => !o && guard.keep()}
      icon="warning-2"
      tone="warning"
      width="sm:max-w-110"
      title={t("title")}
      description={t("text", { count })}
      secondary={
        <Button variant="outline" onClick={guard.keep}>
          {t("keep")}
        </Button>
      }
      primary={
        <Button variant="destructive" onClick={guard.discard}>
          {t("discard")}
        </Button>
      }
    />
  )
}
