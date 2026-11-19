"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-media-query"
import { LAB_NOW, RECEIVE_NOTE, RECEPTION_STAFF, TUBES, analyteOf, barcodeOf, minsBetween, testOf, timeOf, type LabOrder, type Tube } from "./data"
import { collect, receive, receiveProblem, type ReceiveProblem } from "./machine"
import { Latin, ltrRun, PriorityChip, TubeDot } from "./parts"
import { RejectDialog } from "./reject-dialog"
import { labCan } from "./roles"
import { applyStep, getLabOrder, useLabOrders, useLabRole } from "./store"
import { useLabText } from "./text"

/** S + yymmdd + 4-digit order seq + "-" + 2-digit tube no (S2611190142-01). */
export const BARCODE_RE = /^S\d{10}-\d{2}$/

export type ScanRow = {
  id: number
  kind: "received" | "already" | "unknown" | "noted" | "rejected" | "rejectedNoRecollect"
  code: string
  orderNo?: string
  tubeNo?: number
  /** Received time (received / noted) or when it was already received (already). */
  at?: string
}
export type CheckState = { orderNo: string; tubeNo: number; problem: ReceiveProblem }

let rowId = 1
export const scanRow = (r: Omit<ScanRow, "id">): ScanRow => ({ id: rowId++, ...r })

/** Finds a tube by its label barcode among today's orders. */
export function findTube(orders: LabOrder[], code: string): { o: LabOrder; t: Tube } | null {
  for (const o of orders) for (const t of o.tubes) if (barcodeOf(o, t.no) === code) return { o, t }
  return null
}

/**
 * Overlay · Receive samples (Samples · "Samples today" → Scan sample; desktop dialog 560, mobile sheet). Lab reception
 * scans each tube as it arrives: a USB / keyboard-wedge scanner types into a hidden input that stays focused (Enter
 * ends a scan); on mobile the camera reads Code 128 (BarcodeDetector) and the viewfinder hides if the camera isn't
 * available; a typed barcode is the fallback on both. Each scan adds a row to "Scanned now": Received hh:mm, Already in
 * lab · hh:mm (nothing changes) or Not in today's orders. A tube that breaks a rule (stability limit, missing collection
 * info) shows the Check sample card and pauses scanning until it's rejected or received anyway with a note.
 * Done · n received closes with the "samples-received" toast; Close keeps everything already received.
 */
export function ReceiveDialog({
  open,
  onOpenChange,
  initialRows,
  initialCheck,
  cameraPreview,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preview stories: start with these rows / this check card; show the viewfinder without a camera. */
  initialRows?: ScanRow[]
  initialCheck?: CheckState
  cameraPreview?: boolean
}) {
  const t = useTranslations("labs.receive")
  const role = useLabRole()
  const mobile = useIsMobile()
  const { b } = useLabText()
  const orders = useLabOrders()
  const [rows, setRows] = React.useState<ScanRow[]>(initialRows ?? [])
  const [check, setCheck] = React.useState<CheckState | null>(initialCheck ?? null)
  const [received, setReceived] = React.useState<{ orderNo: string; stat: boolean }[]>([])
  const [typed, setTyped] = React.useState("")
  const [typedErr, setTypedErr] = React.useState(false)
  const [rejecting, setRejecting] = React.useState<{ orderNo: string; tubeNo: number } | null>(null)
  const [camera, setCamera] = React.useState<"on" | "off">(cameraPreview ? "on" : "on")
  const scanner = React.useRef<HTMLInputElement>(null)
  // Latest orders / check card for the scanner handlers (camera loop, key events) without re-binding them.
  const ordersRef = React.useRef(orders)
  const checkRef = React.useRef(check)
  React.useEffect(() => {
    ordersRef.current = orders
    checkRef.current = check
  })

  /**
   * Keep the hidden scanner input focused (desktop / tablet: USB or keyboard-wedge scanners type there). `force` takes
   * focus back from the typed field after a typed barcode; otherwise only when nothing else has focus. Not on mobile:
   * focusing an input would open the keyboard over the camera.
   */
  const refocus = React.useCallback(
    (force = false) => {
      if (mobile) return
      window.setTimeout(() => {
        const a = document.activeElement
        const idle = !a || a === document.body || (a instanceof HTMLElement && a.getAttribute("role") === "dialog")
        if (force || idle) scanner.current?.focus()
      }, 30)
    },
    [mobile]
  )

  const doReceive = (o: LabOrder, tube: Tube, remark?: string) => {
    const note = o.priority === "stat" ? RECEIVE_NOTE.stat : RECEIVE_NOTE.normal
    const step = applyStep(o.no, (x) => {
      // A tube that was never marked collected is collected and received in one go.
      const c = x.tubes.find((y) => y.no === tube.no)?.state === "pending" ? collect(x, [tube.no], RECEPTION_STAFF, LAB_NOW) : { ok: true as const, order: x }
      return c.ok ? receive(c.order, [tube.no], RECEPTION_STAFF, LAB_NOW, { note, remark }) : c
    })
    if (!step.ok) return
    setRows((r) => [scanRow({ kind: remark ? "noted" : "received", code: barcodeOf(o, tube.no), orderNo: o.no, tubeNo: tube.no, at: LAB_NOW }), ...r])
    setReceived((r) => [...r, { orderNo: o.no, stat: o.priority === "stat" }])
  }

  const scan = (raw: string) => {
    const code = raw.trim().toUpperCase()
    if (!code) return
    if (checkRef.current) return // paused until the check card is resolved
    const hit = findTube(ordersRef.current, code)
    if (!hit) {
      setRows((r) => [scanRow({ kind: "unknown", code }), ...r])
      return
    }
    const { o, t: tube } = hit
    if (tube.state === "rejected") {
      setRows((r) => [scanRow({ kind: "rejected", code, orderNo: o.no, tubeNo: tube.no }), ...r])
      return
    }
    if (tube.receivedAt) {
      setRows((r) => [scanRow({ kind: "already", code, orderNo: o.no, tubeNo: tube.no, at: tube.receivedAt }), ...r])
      return
    }
    const problem = receiveProblem(o, tube.no)
    if (problem) {
      setCheck({ orderNo: o.no, tubeNo: tube.no, problem })
      return
    }
    doReceive(o, tube)
  }

  // Keyboard-wedge scanners type the code then Enter into the focused hidden input.
  const onScannerKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    scan(e.currentTarget.value)
    e.currentTarget.value = ""
  }

  // Take focus from the dialog's own autofocus (the typed field) once it has opened.
  React.useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => refocus(true), 80)
    return () => window.clearTimeout(id)
  }, [open, refocus])

  const addTyped = () => {
    const v = typed.trim().toUpperCase()
    if (!BARCODE_RE.test(v)) {
      setTypedErr(true)
      return
    }
    setTypedErr(false)
    setTyped("")
    scan(v)
    refocus(true)
  }

  const done = () => {
    onOpenChange(false)
    const stat = received.find((r) => r.stat)
    const statOrder = stat && orders.find((o) => o.no === stat.orderNo)
    if (!received.length) return
    toast.success(t("toast"), {
      description: statOrder ? t("toastStat", { name: b(statOrder.patient.name) }) : t("toastText", { n: received.length }),
    })
  }

  const checkHit = check ? orders.find((o) => o.no === check.orderNo) : undefined
  const checkTube = checkHit?.tubes.find((x) => x.no === check?.tubeNo)

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={t("title")}
        description={t("text")}
        icon="scan-barcode"
        width="sm:max-w-140"
        secondary={
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
        }
        primary={<Button onClick={done}>{t("done", { n: received.length })}</Button>}
      >
        <input
          ref={scanner}
          aria-label={t("scannerLabel")}
          className="sr-only"
          autoComplete="off"
          onKeyDown={onScannerKey}
          onBlur={() => refocus()}
          tabIndex={-1}
        />

        {mobile && camera === "on" ? (
          <CameraScanner preview={cameraPreview} paused={!!check} onCode={scan} onUnavailable={() => setCamera("off")} />
        ) : (
          !mobile && <ScannerBox compact={!!check} paused={!!check} />
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Input
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value)
                setTypedErr(false)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addTyped()
                }
              }}
              dir="ltr"
              placeholder="S2611190…"
              aria-label={t("typed")}
              aria-invalid={typedErr || undefined}
              autoComplete="off"
              className="flex-1 tabular-nums rtl:text-right"
            />
            <Button variant="outline" onClick={addTyped}>
              {t("add")}
            </Button>
          </div>
          {typedErr && <p className="text-xs text-destructive">{t("badFormat")}</p>}
        </div>

        {check && checkHit && checkTube && (
          <CheckCard
            order={checkHit}
            tube={checkTube}
            problem={check.problem}
            canReject={labCan(role, "reject")}
            onReject={() => setRejecting({ orderNo: check.orderNo, tubeNo: check.tubeNo })}
            onReceive={(note) => {
              setCheck(null)
              doReceive(checkHit, checkTube, note)
              refocus()
            }}
          />
        )}

        <ScannedList rows={rows} orders={orders} />
      </ResponsiveDialog>

      {rejecting && (
        <RejectDialog
          orderNo={rejecting.orderNo}
          tubeNo={rejecting.tubeNo}
          onOpenChange={(v) => {
            if (v) return
            const o = getLabOrder(rejecting.orderNo)
            const tube = o?.tubes.find((x) => x.no === rejecting.tubeNo)
            if (o && tube?.state === "rejected") {
              const recollect = o.tubes.some((x) => x.recollectOf === tube.no)
              setRows((r) => [scanRow({ kind: recollect ? "rejected" : "rejectedNoRecollect", code: barcodeOf(o, tube.no), orderNo: o.no, tubeNo: tube.no }), ...r])
              setCheck(null)
            }
            setRejecting(null)
            refocus()
          }}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ scan area */

/** Desktop / tablet: dashed muted box "Scanner ready"; one row while a check card is open. */
function ScannerBox({ compact, paused }: { compact: boolean; paused: boolean }) {
  const t = useTranslations("labs.receive")
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex rounded-xl border border-dashed border-border bg-muted",
        compact ? "items-center gap-3 p-3 text-start" : "flex-col items-center gap-2 px-6 py-6 text-center"
      )}
    >
      <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-card text-primary", compact ? "size-11" : "size-12")}>
        <Icon name="scan-barcode" size={24} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{t("ready")}</span>
        <span className="text-xs text-muted-foreground">{paused ? t("paused") : t("readyText")}</span>
      </div>
    </div>
  )
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

/**
 * Mobile: camera viewfinder (dark box, radius 16, white target frame, red scan line). Reads Code 128 with the
 * browser's BarcodeDetector; if there's no camera, no permission or no detector, it reports unavailable and the dialog
 * keeps only the typed input.
 */
function CameraScanner({ preview, paused, onCode, onUnavailable }: { preview?: boolean; paused: boolean; onCode: (code: string) => void; onUnavailable: () => void }) {
  const t = useTranslations("labs.receive")
  const video = React.useRef<HTMLVideoElement>(null)
  const last = React.useRef<{ code: string; at: number }>({ code: "", at: 0 })
  const cb = React.useRef({ onCode, onUnavailable, paused })
  React.useEffect(() => {
    cb.current = { onCode, onUnavailable, paused }
  })

  React.useEffect(() => {
    if (preview) return
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      cb.current.onUnavailable()
      return
    }
    const detector = new Ctor({ formats: ["code_128"] })
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((x) => x.stop())
        stream = s
        if (video.current) {
          video.current.srcObject = s
          void video.current.play()
        }
        const tick = async () => {
          if (stopped) return
          if (!cb.current.paused && video.current && video.current.readyState >= 2) {
            try {
              const found = await detector.detect(video.current)
              const code = found[0]?.rawValue
              // The same label stays in view: ignore repeats for 2.5 s.
              if (code && (code !== last.current.code || Date.now() - last.current.at > 2500)) {
                last.current = { code, at: Date.now() }
                cb.current.onCode(code)
              }
            } catch {}
          }
          timer = window.setTimeout(tick, 350)
        }
        void tick()
      })
      .catch(() => cb.current.onUnavailable())
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((x) => x.stop())
    }
  }, [preview])

  return (
    <div className="relative flex h-45 flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-[#111827]">
      {!preview && <video ref={video} muted playsInline className="absolute inset-0 size-full object-cover opacity-80" />}
      <div aria-hidden className="relative flex h-16 w-[72%] items-center rounded-lg border-2 border-white px-4">
        <span className="h-0.5 w-full rounded-full bg-red-600" />
      </div>
      <span className="relative text-xs text-white">{t("camera")}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ check card */

function CheckCard({
  order: o,
  tube,
  problem,
  canReject,
  onReject,
  onReceive,
}: {
  order: LabOrder
  tube: Tube
  problem: ReceiveProblem
  canReject: boolean
  onReject: () => void
  onReceive: (note: string) => void
}) {
  const t = useTranslations("labs.receive")
  const { b } = useLabText()
  const [noting, setNoting] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [noteErr, setNoteErr] = React.useState(false)
  const code = barcodeOf(o, tube.no)
  const test = b(testOf(tube.tests[0])?.name ?? { en: tube.tests[0], ar: tube.tests[0] })
  const age = tube.collectedAt ? minsBetween(tube.collectedAt, LAB_NOW) : 0
  const h = Math.floor(age / 60)
  const m = age % 60
  const collected = tube.collectedAt
    ? t("collectedLine", { time: timeOf(tube.collectedAt), place: t(`place.${o.place}`), ago: t("ago", { h, m, both: String(h > 0 && m > 0) }) })
    : t("missingTime")
  const why =
    problem.reason === "stability"
      ? t("stability", { analyte: b(analyteOf(problem.analyte)?.name ?? { en: problem.analyte, ar: problem.analyte }), h: problem.hours })
      : t("missingInfo")
  const row = "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"

  return (
    <section role="alert" className="flex flex-col gap-3 rounded-xl border border-warning bg-warning-soft p-4">
      <div className="flex items-start gap-2 text-warning-soft-foreground">
        <Icon name="warning-2" size={20} className="shrink-0" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{t("check")}</span>
          <span className="text-xs">
            <bdi>{t("checkLine", { code: ltrRun(code), patient: b(o.patient.name), test })}</bdi>
          </span>
        </div>
      </div>
      <dl className="flex flex-col rounded-lg bg-card p-3">
        <div className={row}>
          <dt className="text-xs text-muted-foreground">{t("tube")}</dt>
          <dd className="flex items-center gap-2 text-sm text-foreground">
            <TubeDot tube={tube.type} />
            {b(TUBES[tube.type].full)}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-xs text-muted-foreground">{t("collected")}</dt>
          <dd className={cn("text-sm tabular-nums", problem.reason === "stability" || !tube.collectedAt ? "text-destructive" : "text-foreground")}>
            <bdi>{collected}</bdi>
          </dd>
        </div>
        <div className={row}>
          <dt className="text-xs text-muted-foreground">{t("why")}</dt>
          <dd className="text-sm text-foreground">{why}</dd>
        </div>
      </dl>

      {noting ? (
        <div className="flex flex-col gap-2">
          <Field label={t("note")} required error={noteErr ? t("noteRequired") : undefined}>
            {(p) => (
              <Textarea
                {...p}
                autoFocus
                rows={2}
                value={note}
                placeholder={t("notePlaceholder")}
                onChange={(e) => {
                  setNote(e.target.value)
                  setNoteErr(false)
                }}
                className="bg-card"
              />
            )}
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="bg-card" onClick={() => setNoting(false)}>
              {t("cancelNote")}
            </Button>
            <Button
              onClick={() => {
                if (!note.trim()) return setNoteErr(true)
                onReceive(note.trim())
              }}
            >
              {t("receiveWithNote")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          {canReject && (
            <Button variant="destructive" onClick={onReject}>
              <Icon name="close-circle" size={24} />
              {t("reject")}
            </Button>
          )}
          <Button variant="outline" className="bg-card" onClick={() => setNoting(true)}>
            {t("receiveAnyway")}
          </Button>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ scanned now */

const ROW_TONE: Record<ScanRow["kind"], StatusTone> = {
  received: "success",
  noted: "warning",
  already: "neutral",
  unknown: "destructive",
  rejected: "destructive",
  rejectedNoRecollect: "destructive",
}
const ROW_TEXT: Record<ScanRow["kind"], string> = {
  received: "text-success",
  noted: "text-warning-soft-foreground",
  already: "text-muted-foreground",
  unknown: "text-destructive",
  rejected: "text-destructive",
  rejectedNoRecollect: "text-destructive",
}

function ScannedList({ rows, orders }: { rows: ScanRow[]; orders: LabOrder[] }) {
  const t = useTranslations("labs.receive")
  const { b } = useLabText()
  if (!rows.length) return null
  const label = (r: ScanRow) =>
    r.kind === "received"
      ? t("received", { time: timeOf(r.at!) })
      : r.kind === "noted"
        ? t("noted", { time: timeOf(r.at!) })
        : r.kind === "already"
          ? t("already", { time: r.at ? timeOf(r.at) : "—" })
          : r.kind === "unknown"
            ? t("unknown")
            : r.kind === "rejected"
              ? t("rejected")
              : t("rejectedNoRecollect")
  return (
    <section className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-sm font-medium text-foreground">{t("scanned")}</h3>
        <span className="text-xs text-muted-foreground">{t("count", { n: rows.length })}</span>
      </div>
      <ul className="flex flex-col overflow-hidden rounded-lg border">
        {rows.map((r) => {
          const o = r.orderNo ? orders.find((x) => x.no === r.orderNo) : undefined
          const tube = o?.tubes.find((x) => x.no === r.tubeNo)
          const test = tube ? b(testOf(tube.tests[0])?.name ?? { en: tube.tests[0], ar: tube.tests[0] }) : ""
          return (
            <li key={r.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
              {tube ? <TubeDot tube={tube.type} /> : <Icon name="danger" size={16} className="shrink-0 text-destructive" />}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{o ? b(o.patient.name) : t("unknownTitle")}</span>
                  {o && <PriorityChip priority={o.priority} statOnly />}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{o ? <bdi>{t("line", { code: ltrRun(r.code), test })}</bdi> : <Latin>{r.code}</Latin>}</span>
                <span className={cn("text-xs sm:hidden", ROW_TEXT[r.kind])}>
                  <bdi>{label(r)}</bdi>
                </span>
              </div>
              <StatusBadge tone={ROW_TONE[r.kind]} className="hidden sm:inline-flex">
                {label(r)}
              </StatusBadge>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
