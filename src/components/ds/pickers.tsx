"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandCheck, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const triggerClass =
  "flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-start text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive data-[placeholder]:text-muted-foreground"

/**
 * DS sheet 10 · Date Picker (single): input-style trigger with calendar-2 icon → popover (304 wide, p-4, gap-3,
 * rounded-xl, shadow-md) with the calendar and a footer: selected date (12 muted) + "Apply" (primary sm).
 */
export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
  ...aria
}: {
  value?: Date
  onChange: (d: Date | undefined) => void
  placeholder: string
  className?: string
  "aria-invalid"?: boolean
  id?: string
}) {
  const t = useTranslations("common.actions")
  const format = useFormatter()
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<Date | undefined>(value)

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setDraft(value)
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={cn(triggerClass, className)} data-placeholder={!value || undefined} {...aria}>
          <Icon name="calendar-2" size={16} className="text-muted-foreground" />
          <span className="flex-1 truncate tabular-nums">{value ? format.dateTime(value, "short") : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-76 gap-3 shadow-md">
        <Calendar mode="single" selected={draft} onSelect={setDraft} defaultMonth={draft} />
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-xs text-muted-foreground tabular-nums">
            {draft && format.dateTime(draft, "weekday")}
          </span>
          <Button
            size="sm"
            onClick={() => {
              onChange(draft)
              setOpen(false)
            }}
          >
            {t("apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Range variant (reports): footer shows "1 – 15 Nov 2026 · 15 days". */
export function DateRangePicker({
  value,
  onChange,
  placeholder,
  daysLabel,
  className,
}: {
  value?: DateRange
  onChange: (r: DateRange | undefined) => void
  placeholder: string
  /** e.g. (n) => t("days", { n }) — module supplies the plural string. */
  daysLabel: (days: number) => string
  className?: string
}) {
  const t = useTranslations("common.actions")
  const format = useFormatter()
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DateRange | undefined>(value)
  const label = (r?: DateRange) =>
    r?.from && r.to ? format.dateTimeRange(r.from, r.to, "short") : r?.from ? format.dateTime(r.from, "short") : ""
  const days = draft?.from && draft.to ? Math.round((+draft.to - +draft.from) / 86_400_000) + 1 : 0

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setDraft(value)
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={cn(triggerClass, className)} data-placeholder={!value?.from || undefined}>
          <Icon name="calendar-2" size={16} className="text-muted-foreground" />
          <span className="flex-1 truncate tabular-nums">{label(value) || placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-76 gap-3 shadow-md">
        <Calendar mode="range" selected={draft} onSelect={setDraft} defaultMonth={draft?.from} />
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-xs text-muted-foreground tabular-nums">
            {days > 0 && `${label(draft)} · ${daysLabel(days)}`}
          </span>
          <Button
            size="sm"
            onClick={() => {
              onChange(draft)
              setOpen(false)
            }}
          >
            {t("apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export type ComboOption = { value: string; label: string; group?: string }

/**
 * DS sheet 10 · Combobox: input-style trigger → searchable options list (Command) in a popover the width
 * of the trigger. Selected option = accent + tick-circle.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
  ...aria
}: {
  options: ComboOption[]
  value?: string
  onChange: (v: string) => void
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  className?: string
  "aria-invalid"?: boolean
  id?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((o) => o.value === value)
  const groups = Array.from(new Set(options.map((o) => o.group ?? "")))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(triggerClass, className)}
          data-placeholder={!selected || undefined}
          {...aria}
        >
          <span className="flex-1 truncate">{selected?.label ?? placeholder}</span>
          <Icon name="arrow-down" size={16} className="text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-60 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g || "_"} heading={g || undefined}>
                {options
                  .filter((o) => (o.group ?? "") === g)
                  .map((o) => (
                    <CommandItem
                      key={o.value}
                      value={o.label}
                      data-checked={o.value === value}
                      onSelect={() => {
                        onChange(o.value)
                        setOpen(false)
                      }}
                    >
                      <span className="flex-1">{o.label}</span>
                      <CommandCheck checked={o.value === value} />
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
