"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Icon } from "@/components/ds/icon"
import { Input } from "@/components/ui/input"

/**
 * DS sheet 11 · Password Input: 40px Input with a lock icon at the start and a 24px show/hide toggle
 * (eye / eye-slash) at the end. Default / Focus / Error come from Input. Password text stays LTR.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "startIcon" | "end">) {
  const t = useTranslations("common.a11y")
  const [visible, setVisible] = React.useState(false)

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      dir="ltr"
      fieldSize={props.fieldSize ?? "lg"}
      autoComplete={props.autoComplete ?? "current-password"}
      className={cn("[&>input]:text-start", className)}
      startIcon={<Icon name="lock" size={16} />}
      end={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Icon name={visible ? "eye-slash" : "eye"} size={16} />
        </button>
      }
    />
  )
}
