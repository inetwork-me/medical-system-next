"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { bi } from "@/lib/mock/bi"
import { RECENT_SEARCHES, SEARCH_PATIENTS } from "@/lib/mock/shell"
import { Icon } from "@/components/ds/icon"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

/**
 * Header quick search (prototype: Input → "Search results", anchored bottomLeft on desktop/tablet,
 * topCenter panel on mobile). Panel: query row (focused input + "Close"), "Patients · n" results
 * (avatar, name, MRN · detail, chevron), recent searches (clock), hint bar on bg-muted.
 */
function SearchPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("shell.search")
  const tc = useTranslations("common.actions")
  const locale = useLocale()
  const router = useRouter()
  const [q, setQ] = React.useState("")

  const query = q.trim().toLowerCase()
  const results = query
    ? SEARCH_PATIENTS.filter(
        (p) => p.name.en.toLowerCase().includes(query) || p.name.ar.includes(q.trim()) || p.mrn.includes(query)
      )
    : []

  return (
    <div className="flex flex-col">
      <form
        role="search"
        className="flex items-center gap-2 border-b px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!query) return
          onClose()
          router.push(`/patients?q=${encodeURIComponent(q.trim())}`)
        }}
      >
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={useTranslations("shell.header")("searchPlaceholder")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="flex-1"
          aria-label={tc("search")}
        />
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {tc("close")}
        </Button>
      </form>
      <div className="flex max-h-[min(60dvh,28rem)] flex-col gap-1 overflow-y-auto p-2">
        {query && (
          <>
            <p className="px-2 pt-1 text-xs font-medium text-muted-foreground">
              {t("patients", { count: results.length })}
            </p>
            {results.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">{t("noResults")}</p>}
            {results.map((p, i) => (
              <Link
                key={p.id}
                href={`/patients/${p.id}`}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-2.5 rounded-md p-2 outline-none transition-colors hover:bg-accent focus-visible:bg-accent",
                  i === 0 && "bg-accent"
                )}
              >
                <Avatar size="sm">
                  <AvatarFallback>{p.initials}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{bi(p.name, locale)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    <bdi dir="ltr">{t("mrn", { mrn: p.mrn })}</bdi>
                    {p.mobile && (
                      <>
                        {" · "}
                        <bdi dir="ltr">{p.mobile}</bdi>
                      </>
                    )}
                    {p.age !== undefined && <> · {t("age", { n: p.age })}</>}
                    {p.note && <> · {bi(p.note, locale)}</>}
                  </span>
                </span>
                <Icon name="arrow-right-1" size={16} className="text-muted-foreground" />
              </Link>
            ))}
          </>
        )}
        <p className="px-2 pt-2 text-xs font-medium text-muted-foreground">{t("recent")}</p>
        {RECENT_SEARCHES.map((r) => (
          <button
            key={r.en}
            type="button"
            onClick={() => setQ(bi(r, locale))}
            className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-start text-sm text-foreground outline-none hover:bg-accent focus-visible:bg-accent"
          >
            <Icon name="clock" size={16} className="text-muted-foreground" />
            <bdi>{bi(r, locale)}</bdi>
          </button>
        ))}
      </div>
      <p className="bg-muted px-3 py-2 text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  )
}

/** Desktop / tablet: input-looking trigger in the header; results drop down under it. */
export function HeaderSearch({ className }: { className?: string }) {
  const th = useTranslations("shell.header")
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-start text-sm text-muted-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            className
          )}
        >
          <Icon name="search-normal-1" size={16} />
          <span className="truncate lg:hidden">{th("searchShort")}</span>
          <span className="hidden truncate lg:inline">{th("searchPlaceholder")}</span>
        </button>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={-36}
        className="w-[min(35rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-xl p-0 shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SearchPanel onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

/** Mobile: icon button in the app bar; the panel slides down from the top. */
export function MobileSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const tc = useTranslations("common.actions")
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" showCloseButton={false} className="gap-0 overflow-hidden rounded-b-2xl p-0">
        <SheetTitle className="sr-only">{tc("search")}</SheetTitle>
        <SearchPanel onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}
