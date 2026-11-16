"use client"

import * as React from "react"
import { useLocale } from "next-intl"
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker"
import { ar, enUS } from "react-day-picker/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Icon } from "@/components/ds/icon"

/**
 * DS sheet 10 · Date Picker calendar (the popover surface/footer live in <DatePicker>):
 * header = month label (14 Medium) at the start, outline 32px prev/next at the end;
 * weekdays 12 muted; day cells ~37×34, gap 2, rounded-md, 12 Regular.
 * Today = primary ring; selected / range ends = primary + 12 Medium; range middle = accent.
 * Locale follows the app: Arabic month names, Gregorian calendar, Latin digits, week starts Sunday.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames()
  const isAr = useLocale() === "ar"

  return (
    <DayPicker
      locale={isAr ? ar : enUS}
      dir={isAr ? "rtl" : "ltr"}
      numerals="latn"
      weekStartsOn={0}
      showOutsideDays={showOutsideDays}
      className={cn("group/calendar w-full [--cell-h:--spacing(8.5)]", className)}
      formatters={{
        formatWeekdayName: (date) =>
          isAr
            ? new Intl.DateTimeFormat("ar", { weekday: "narrow" }).format(date)
            : new Intl.DateTimeFormat("en", { weekday: "short" }).format(date).slice(0, 2),
        ...formatters,
      }}
      classNames={{
        root: cn("w-full", defaults.root),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaults.months),
        month: cn("flex w-full flex-col gap-3", defaults.month),
        nav: cn("absolute end-0 top-0 flex items-center gap-1.5", defaults.nav),
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "select-none aria-disabled:opacity-50",
          defaults.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "select-none aria-disabled:opacity-50",
          defaults.button_next
        ),
        month_caption: cn("flex h-8 items-center pe-20", defaults.month_caption),
        caption_label: cn("text-sm font-medium text-foreground select-none", defaults.caption_label),
        month_grid: cn("w-full border-collapse", defaults.month_grid),
        weekdays: cn("flex gap-0.5", defaults.weekdays),
        weekday: cn("flex-1 text-xs font-normal text-muted-foreground select-none", defaults.weekday),
        week: cn("mt-1 flex w-full gap-0.5", defaults.week),
        day: cn("group/day relative h-(--cell-h) flex-1 p-0 text-center select-none", defaults.day),
        range_start: cn("rounded-md", defaults.range_start),
        range_middle: cn("rounded-md", defaults.range_middle),
        range_end: cn("rounded-md", defaults.range_end),
        today: cn("today", defaults.today),
        outside: cn("text-muted-foreground", defaults.outside),
        disabled: cn("text-muted-foreground opacity-50", defaults.disabled),
        hidden: cn("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...rootProps }) => (
          <div data-slot="calendar" ref={rootRef} className={cn(className)} {...rootProps} />
        ),
        Chevron: ({ className, orientation }) => (
          <Icon
            name={orientation === "left" ? "arrow-left-1" : orientation === "right" ? "arrow-right-1" : "arrow-down"}
            size={16}
            className={className}
          />
        ),
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toISOString().slice(0, 10)}
      data-today={modifiers.today || undefined}
      data-outside={modifiers.outside || undefined}
      data-selected-single={
        (modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle) || undefined
      }
      data-range-start={modifiers.range_start || undefined}
      data-range-end={modifiers.range_end || undefined}
      data-range-middle={modifiers.range_middle || undefined}
      className={cn(
        "flex size-full cursor-pointer items-center justify-center rounded-md text-xs text-foreground tabular-nums transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none",
        "data-[outside]:text-muted-foreground",
        "data-[today]:ring-1 data-[today]:ring-primary data-[today]:ring-inset",
        "data-[range-middle]:bg-accent data-[range-middle]:text-accent-foreground",
        "data-[selected-single]:bg-primary data-[selected-single]:font-medium data-[selected-single]:text-primary-foreground",
        "data-[range-start]:bg-primary data-[range-start]:font-medium data-[range-start]:text-primary-foreground",
        "data-[range-end]:bg-primary data-[range-end]:font-medium data-[range-end]:text-primary-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
