"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { useRouter } from "@/i18n/navigation"
import { csvBlob, saveBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SET_TODAY } from "./data"
import { SettingsFrame } from "./frame"
import { SetCard, useUserText } from "./parts"
import { useAuditLog, writeAudit, type AuditEntry, type AuditKind } from "./store"

type Filter = "all" | AuditKind
const FIRST = 6
const MORE = 20

/** The "where" column: a Settings section or a module. */
function useWhere() {
  const { t } = useUserText()
  return (w: AuditEntry["where"]) => {
    if (w === "signin") return t("audit.signin")
    if (["reports", "billing", "records", "messages", "patients"].includes(w)) return t(`modules.${w as "billing"}`)
    return t(`sections.${w as "users"}`)
  }
}

/**
 * Settings · Audit log: search and filter (All / Settings / Sign-ins / Failed · n / Exports), columns time, who, what, where
 * (section), IP; failed sign-ins tinted red. Kept 10 years, read-only. Header: Export (the export is logged too).
 */
export function AuditLogPage() {
  const x = useUserText()
  const { t, b, l, n } = x
  const where = useWhere()
  const router = useRouter()
  const params = useSearchParams()
  const log = useAuditLog()
  const [filter, setFilter] = React.useState<Filter>(() => (["settings", "signin", "failed", "export"].includes(params.get("filter") ?? "") ? (params.get("filter") as Filter) : "all"))
  const [q, setQ] = React.useState("")
  const [shown, setShown] = React.useState(FIRST)

  const failed = log.filter((e) => e.kind === "failed").length
  const words = q.trim().toLowerCase()
  const rows = log.filter((e) => {
    if (filter !== "all" && e.kind !== filter) return false
    if (!words) return true
    return [e.who.en, e.who.ar, e.what.en, e.what.ar, e.ip, where(e.where)].join(" ").toLowerCase().includes(words)
  })
  const visible = rows.slice(0, shown)
  const time = (iso: string) => (iso.slice(0, 10) === SET_TODAY ? l(iso.slice(11, 16)) : x.ago(iso) === t("time.yesterday") ? t("time.yesterday") : l(x.dates.dayMonth(iso)))
  const timeTable = (iso: string) => (iso.slice(0, 10) === SET_TODAY ? l(iso.slice(11, 16)) : l(x.dates.dayMonth(iso)))

  const pick = (f: Filter) => {
    setFilter(f)
    setShown(FIRST)
    router.replace(f === "all" ? "/settings/audit-log" : `/settings/audit-log?filter=${f}`, { scroll: false })
  }
  const exportRows = () => {
    saveBlob(
      csvBlob(
        ["Time", "Who", "What", "Where", "IP", "Type"],
        rows.map((e) => [e.at.replace("T", " "), e.who.en, e.what.en, where(e.where), e.ip, e.kind])
      ),
      `audit-log-${SET_TODAY}.csv`
    )
    // The export itself is logged.
    writeAudit({ kind: "export", what: { en: `Exported the audit log · ${rows.length} rows`, ar: `صدّر سجل التغييرات · ${rows.length} سطر` }, where: "audit" })
    toast.info(t("toasts.exported"), { description: t("toasts.exportedText") })
  }
  const more = () => {
    const add = Math.min(MORE, rows.length - shown)
    setShown((s) => s + MORE)
    toast.info(t("toasts.moreLoaded", { n: add }), { description: t("toasts.moreLoadedText") })
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: t("audit.all") },
    { value: "settings", label: t("audit.kinds.settings") },
    { value: "signin", label: t("audit.kinds.signin") },
    { value: "failed", label: t("audit.failedN", { n: n(failed) }) },
    { value: "export", label: t("audit.kinds.export") },
  ]
  const avatar = (e: AuditEntry) => (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium", e.kind === "failed" && e.initials === "?" ? "bg-card text-primary" : "bg-accent text-primary")}>
      {e.initials ?? "·"}
    </span>
  )

  return (
    <SettingsFrame
      section="audit"
      actions={
        <Button variant="outline" onClick={exportRows}>
          <Icon name="export" size={20} />
          {t("users.export")}
        </Button>
      }
    >
      <SetCard title={t("pageTitles.audit")} sub={t("audit.sub")}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative xl:w-60">
            <Icon name="search-normal-1" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setShown(FIRST)
              }}
              placeholder={t("audit.search")}
              aria-label={t("audit.search")}
              className="ps-9"
            />
          </div>
          <Segmented size="sm" value={filter} onValueChange={pick} options={filters} aria-label={t("users.filterLabel")} className="hidden xl:inline-flex" />
          {/* Below xl the design keeps three (the others show when they're the active filter). */}
          <Segmented
            value={filter}
            onValueChange={pick}
            options={filters.filter((f) => ["all", "settings", "signin"].includes(f.value) || f.value === filter)}
            aria-label={t("users.filterLabel")}
            className="w-full xl:hidden"
          />
        </div>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("audit.none")}</p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-lg border xl:block">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-[9%] px-4 py-3 text-start font-normal">{t("audit.colTime")}</th>
                    <th className="w-[25%] px-3 py-3 text-start font-normal">{t("audit.colWho")}</th>
                    <th className="w-[37%] px-3 py-3 text-start font-normal">{t("audit.colWhat")}</th>
                    <th className="w-[14%] px-3 py-3 text-start font-normal">{t("audit.colWhere")}</th>
                    <th className="px-3 py-3 text-start font-normal">{t("audit.colIp")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.id} className={cn("border-t", e.kind === "failed" && "bg-destructive-soft/70")}>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-foreground tabular-nums">{timeTable(e.at)}</td>
                      <td className="px-3 py-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          {avatar(e)}
                          <span className="min-w-0 text-foreground">{b(e.who)}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-foreground">{b(e.what)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{where(e.where)}</td>
                      <td className={cn("px-3 py-3 text-xs tabular-nums", e.kind === "failed" ? "text-destructive" : "text-muted-foreground")}>{l(e.ip)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col divide-y xl:hidden">
              {visible.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-3">
                  {avatar(e)}
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm text-foreground">{b(e.what)}</span>
                    <span className="text-xs text-muted-foreground">
                      {b(e.who)} · {time(e.at)}
                    </span>
                    {e.kind === "failed" && (
                      <StatusBadge tone="destructive" className="w-fit">
                        {t("audit.kinds.failed")}
                      </StatusBadge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 max-xl:flex-col xl:justify-between">
              <p className="text-xs text-muted-foreground max-xl:hidden">{t("audit.showing", { shown: n(visible.length), total: n(rows.length) })}</p>
              {shown < rows.length && (
                <Button variant="outline" onClick={more} className="max-xl:w-full">
                  {t("users.showMore")}
                </Button>
              )}
            </div>
          </>
        )}
      </SetCard>
    </SettingsFrame>
  )
}
