"use client"

import * as React from "react"

/**
 * What each Billing list shows right now (its filter and search), so Export can offer "Only what the filter shows
 * (Unpaid)". In memory only: it's the screen's state, not data.
 */
export type ListView = { filter: string; query: string }
type Lists = Partial<Record<"invoices" | "claims" | "contracts", ListView>>

let views: Lists = {}
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function setListView(list: keyof Lists, v: ListView) {
  const cur = views[list]
  if (cur && cur.filter === v.filter && cur.query === v.query) return
  views = { ...views, [list]: v }
  for (const l of listeners) l()
}

export const useListView = (list: keyof Lists) =>
  React.useSyncExternalStore(
    subscribe,
    () => views[list],
    () => undefined
  )

/** Lists call this with their current filter + search; it keeps the shared view in step. */
export function usePublishListView(list: keyof Lists, v: ListView) {
  React.useEffect(() => {
    setListView(list, v)
  }, [list, v.filter, v.query]) // eslint-disable-line react-hooks/exhaustive-deps
}
