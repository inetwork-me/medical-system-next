"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Icon } from "@/components/ds/icon"
import { Progress } from "@/components/ui/progress"

/**
 * DS sheet 08 · Drop Zone: rounded-xl, 1.5px dashed border, p-8, gap-3, centred.
 * Default = card / border-input · Drag over = accent / primary border · Error = destructive-soft / destructive border.
 * The whole zone is a button that opens the file picker; keyboard and screen-reader friendly.
 */
export function DropZone({
  accept = ".pdf,.jpg,.jpeg,.png",
  maxBytes = 10 * 1024 * 1024,
  multiple = true,
  onFiles,
  className,
}: {
  accept?: string
  maxBytes?: number
  multiple?: boolean
  onFiles: (files: File[]) => void
  className?: string
}) {
  const t = useTranslations("common.upload")
  const input = React.useRef<HTMLInputElement>(null)
  const [state, setState] = React.useState<"default" | "over" | "error">("default")

  const allowed = accept.split(",").map((s) => s.trim().toLowerCase())
  const accepts = (f: File) => f.size <= maxBytes && allowed.some((ext) => f.name.toLowerCase().endsWith(ext))

  const handle = (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (!files.length) return
    if (!files.every(accepts)) return setState("error")
    setState("default")
    onFiles(files)
  }

  return (
    <button
      type="button"
      data-slot="drop-zone"
      data-state={state}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setState("over")
      }}
      onDragLeave={() => setState("default")}
      onDrop={(e) => {
        e.preventDefault()
        handle(e.dataTransfer.files)
      }}
      className={cn(
        "group/drop flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-[1.5px] border-dashed border-input bg-card p-8 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "data-[state=over]:border-primary data-[state=over]:bg-accent",
        "data-[state=error]:border-destructive data-[state=error]:bg-destructive-soft",
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-foreground group-data-[state=error]/drop:bg-card group-data-[state=error]/drop:text-destructive group-data-[state=over]/drop:bg-card">
        <Icon name={state === "error" ? "danger" : "document-upload"} size={24} />
      </span>
      <span
        className={cn("text-sm font-medium", state === "error" ? "text-destructive" : "text-foreground")}
        aria-live="polite"
      >
        {state === "over" ? t("dropActive") : state === "error" ? t("dropError") : t("dropTitle")}
      </span>
      {state !== "over" && (
        <span className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">{t("or")}</span>
          <span className="font-medium text-primary">{t("browse")}</span>
        </span>
      )}
      <span className="text-xs text-muted-foreground">{t("hint")}</span>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          handle(e.target.files)
          e.target.value = ""
        }}
      />
    </button>
  )
}

/**
 * DS sheet 08 · Upload Item: card row, p-3, gap-3, rounded-lg, border; 40px file tile (accent / destructive-soft),
 * name 14 Medium, progress + "x MB of y MB" while uploading, tick when complete, retry when failed.
 */
export function UploadItem({
  name,
  state,
  progress = 0,
  doneMb,
  totalMb,
  onRemove,
  onRetry,
}: {
  name: string
  state: "uploading" | "complete" | "error"
  progress?: number
  doneMb?: string
  totalMb: string
  onRemove?: () => void
  onRetry?: () => void
}) {
  const t = useTranslations("common")
  const error = state === "error"
  return (
    <div
      data-slot="upload-item"
      data-state={state}
      className={cn("flex items-center gap-3 rounded-lg border bg-card p-3", error && "border-destructive")}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md",
          error ? "bg-destructive-soft text-destructive" : "bg-accent text-primary"
        )}
      >
        <Icon name="document-text" size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <bdi className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</bdi>
          {state === "uploading" && <span className="text-xs font-medium text-muted-foreground tabular-nums">{progress}%</span>}
          {state === "complete" && <Icon name="tick-circle" size={16} className="text-success" />}
        </div>
        {state === "uploading" && <Progress value={progress} aria-label={name} />}
        <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {state === "uploading" && t("upload.progress", { done: doneMb ?? "0", total: totalMb })}
          {state === "complete" && t("upload.uploaded", { size: totalMb })}
          {error && t("upload.failed")}
        </p>
      </div>
      <button
        type="button"
        onClick={error ? onRetry : onRemove}
        aria-label={error ? t("a11y.retryUpload") : t("a11y.removeFile")}
        className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Icon name={error ? "refresh" : "close-circle"} size={24} />
      </button>
    </div>
  )
}
