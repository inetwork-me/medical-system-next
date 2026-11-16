"use client"

import { useSyncExternalStore } from "react"

/** Subscribes to a CSS media query. Returns `serverValue` during SSR. */
export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  )
}

/** md breakpoint (768px) from sheet 06: below it the app is the mobile web app (bottom nav, bottom sheets). */
export const useIsMobile = () => !useMediaQuery("(min-width: 768px)", true)
