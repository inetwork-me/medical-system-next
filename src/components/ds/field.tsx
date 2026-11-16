"use client"

import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

/**
 * Form field = label (12 Medium) · control · helper or error (12), gap 6 (Textarea set, sheet 10).
 * Wires id / aria-describedby / aria-invalid onto the control so Input/Select/Textarea show their error state.
 *
 *   <Field label="Note" helper="0 / 500" error={errors.note}><Textarea /></Field>
 */
type FieldProps = {
  label?: React.ReactNode
  /** Rendered next to the label at the end (e.g. "Forgot password?" link). */
  labelEnd?: React.ReactNode
  helper?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  className?: string
  /** The control, or a render function for composite controls (e.g. Select → put the props on <SelectTrigger>). */
  children: React.ReactElement | ((control: ControlProps) => React.ReactNode)
}

type ControlProps = {
  id: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  "aria-required"?: boolean
}

export function Field({ label, labelEnd, helper, error, required, className, children }: FieldProps) {
  const id = React.useId()
  const controlId =
    (typeof children !== "function" && (children.props as { id?: string }).id) || `${id}-control`
  const describedBy = error || helper ? `${id}-desc` : undefined
  const control: ControlProps = {
    id: controlId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": required || undefined,
  }

  return (
    <div data-slot="field" className={cn("flex flex-col gap-1.5", className)}>
      {(label || labelEnd) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <Label htmlFor={controlId}>
              {label}
              {required && <span aria-hidden className="text-destructive">*</span>}
            </Label>
          )}
          {labelEnd}
        </div>
      )}
      {typeof children === "function" ? children(control) : <Slot.Root {...control}>{children}</Slot.Root>}
      {(error || helper) && (
        <p id={describedBy} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {error || helper}
        </p>
      )}
    </div>
  )
}
