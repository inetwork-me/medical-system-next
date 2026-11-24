import * as React from "react"

import { cn } from "@/lib/utils"
import { Icon, type IconName } from "@/components/ds/icon"

/** Info / warning / error strip inside dialogs and cards (validation never goes in a toast). */
export function Strip({ tone, icon, children, className }: { tone: "info" | "success" | "warning" | "destructive"; icon: IconName; children: React.ReactNode; className?: string }) {
  return (
    <p
      role={tone === "warning" || tone === "destructive" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-lg p-3 text-xs",
        tone === "info" && "bg-info-soft text-info-soft-foreground",
        tone === "success" && "bg-success-soft text-success-soft-foreground",
        tone === "warning" && "bg-warning-soft text-warning-soft-foreground",
        tone === "destructive" && "bg-destructive-soft text-destructive-soft-foreground",
        className
      )}
    >
      <Icon name={icon} size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  )
}
