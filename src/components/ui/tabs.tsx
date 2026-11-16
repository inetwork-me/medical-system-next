"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * DS sheet 08 · Tabs (segmented): list bg-muted, rounded-md, 3px inset, gap-0.5; tab 32px, px-3,
 * rounded-sm, 14 Medium muted → active bg-card + foreground + shadow-xs.
 * variant="module" = Module Tabs (sheet 08 · Module pages): list rounded-lg p-1 gap-1, tab 36px px-3.5 rounded-md,
 * icon 18 (Linear → Bold when active, see <TabIcon>), optional count pill.
 */
function Tabs({ className, orientation = "horizontal", ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn("group/tabs flex gap-4 data-[orientation=horizontal]:flex-col", className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit max-w-full items-center overflow-x-auto bg-muted text-muted-foreground [scrollbar-width:none] group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "gap-0.5 rounded-md p-[3px]",
        module: "gap-1 rounded-lg p-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group/tab relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color,box-shadow] outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "group-data-[variant=default]/tabs-list:h-8 group-data-[variant=default]/tabs-list:rounded-sm group-data-[variant=default]/tabs-list:px-3",
        "group-data-[variant=module]/tabs-list:h-9 group-data-[variant=module]/tabs-list:gap-2 group-data-[variant=module]/tabs-list:rounded-md group-data-[variant=module]/tabs-list:px-3.5",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("min-w-0 flex-1 outline-none", className)} {...props} />
}

/** Count pill inside a module tab: accent when the tab is active, card otherwise. */
function TabCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tab-count"
      className={cn(
        "inline-flex h-5 items-center rounded-full bg-card px-1.5 text-xs font-medium text-muted-foreground tabular-nums group-data-[state=active]/tab:bg-accent group-data-[state=active]/tab:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabCount, tabsListVariants }
