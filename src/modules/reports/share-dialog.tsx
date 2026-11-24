"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Icon } from "@/components/ds/icon"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PEOPLE, REP_NOW } from "./data"
import { SHARE_ROLES, type SavedReport, type ShareEntry } from "./library"
import { useB } from "./parts"
import { logReport, saveShares, useShares } from "./store"

/**
 * Overlay · Share the report (Share). Search people or roles; the list with access (Can view / Can edit; the owner
 * always edits); "each person sees only the branches they have access to" (enforced on the server, always on).
 * Removing someone takes the row away in place. Share → report-shared ("8 people can open it now"); logged.
 */
export function ShareDialog({ report, onOpenChange }: { report: SavedReport; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("reports.share")
  const b = useB()
  const current = useShares(report.id, report.shares)
  // The owner is always on the list, with edit; the design lists them second, after the roles.
  const start = React.useMemo<ShareEntry[]>(() => {
    const list = current.filter((x) => !(x.kind === "person" && x.id === report.owner))
    const roles = list.filter((x) => x.kind === "role")
    const people = list.filter((x) => x.kind === "person")
    return [...roles, { kind: "person", id: report.owner, access: "edit" }, ...people]
  }, [current, report.owner])
  const [list, setList] = React.useState<ShareEntry[]>(start)
  const [query, setQuery] = React.useState("")
  const id = React.useId()
  const q = query.trim().toLowerCase()
  const has = (kind: ShareEntry["kind"], x: string) => list.some((e) => e.kind === kind && e.id === x)
  const roleHits = q ? SHARE_ROLES.filter((r) => !has("role", r.id) && (r.name.en.toLowerCase().includes(q) || r.name.ar.includes(query.trim()))) : []
  const personHits = q ? PEOPLE.filter((p) => !has("person", p.id) && (p.name.en.toLowerCase().includes(q) || p.name.ar.includes(query.trim()) || p.email.includes(q))) : []
  const add = (e: ShareEntry) => {
    setList((xs) => [...xs, e])
    setQuery("")
  }
  const people = list.reduce((n, e) => n + (e.kind === "role" ? (SHARE_ROLES.find((r) => r.id === e.id)?.people ?? 0) : 1), 0)

  const share = () => {
    saveShares(
      report.id,
      list.filter((e) => !(e.kind === "person" && e.id === report.owner))
    )
    logReport({ at: REP_NOW, kind: "share", what: report.id, detail: list.map((e) => `${e.kind}:${e.id}:${e.access}`).join(", ") })
    onOpenChange(false)
    toast.success(t("toast"), { description: t("toastText", { n: people }) })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="share"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={share}>{t("share")}</Button>}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-q`} className="text-xs font-medium text-foreground">
          {t("add")}
        </label>
        <Input id={`${id}-q`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("addPlaceholder")} startIcon={<Icon name="search-normal-1" size={18} />} />
        {(roleHits.length > 0 || personHits.length > 0) && (
          <ul className="flex flex-col rounded-lg border bg-card">
            {roleHits.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => add({ kind: "role", id: r.id, access: "view" })} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm outline-none hover:bg-muted focus-visible:bg-muted">
                  <span className="flex-1 text-foreground">{b(r.name)}</span>
                  <span className="text-xs text-muted-foreground">{t("roleOf", { n: r.people })}</span>
                </button>
              </li>
            ))}
            {personHits.slice(0, 4).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => add({ kind: "person", id: p.id, access: "view" })} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm outline-none hover:bg-muted focus-visible:bg-muted">
                  <span className="flex-1 text-foreground">{b(p.name)}</span>
                  <span className="text-xs text-muted-foreground">{b(p.role)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ul className="flex flex-col rounded-lg border px-3" aria-label={t("listLabel")}>
        {list.map((e) => {
          const role = e.kind === "role" ? SHARE_ROLES.find((r) => r.id === e.id) : undefined
          const person = e.kind === "person" ? PEOPLE.find((p) => p.id === e.id) : undefined
          const owner = e.kind === "person" && e.id === report.owner
          const name = role ? b(role.name) : person ? b(person.name) : e.id
          return (
            <li key={`${e.kind}:${e.id}`} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
              <span aria-hidden dir="ltr" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">
                {role?.initials ?? person?.initials}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{role ? t("roleOf", { n: role.people }) : person ? (owner ? t("owner", { role: b(person.role) }) : b(person.role)) : ""}</span>
              </span>
              {owner ? (
                <span className="text-sm text-muted-foreground">{t("canEdit")}</span>
              ) : (
                <>
                  <Select value={e.access} onValueChange={(v) => setList((xs) => xs.map((x) => (x === e ? { ...x, access: v as "view" | "edit" } : x)))}>
                    <SelectTrigger className="h-8 w-auto border-0 shadow-none text-muted-foreground" aria-label={t("accessFor", { name })}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">{t("canView")}</SelectItem>
                      <SelectItem value="edit">{t("canEdit")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => setList((xs) => xs.filter((x) => x !== e))} aria-label={t("remove", { name })}>
                    <Icon name="close" size={18} />
                  </Button>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <label htmlFor={`${id}-b`} className="flex items-center gap-2 text-sm">
        <Checkbox id={`${id}-b`} checked disabled />
        {t("branches")}
      </label>
    </ResponsiveDialog>
  )
}
