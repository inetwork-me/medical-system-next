"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Icon, type IconName } from "@/components/ds/icon"
import { Spinner } from "@/components/ds/spinner"
import { Button } from "@/components/ui/button"
import { useIsMobile, useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

/**
 * DS sheet 12 · Toasts — alert-style tinted toast, the only toast the app shows.
 *  · Card: tone-soft fill + 1px border in the same colour, radius 10, Shadow/lg, padding 16 (Compact 12/16), gap 12.
 *    Width 380 on desktop / tablet, screen − 32 on mobile. Neutral = popover + border.
 *  · Icon 20 linear in the tone-soft-foreground colour (no tile, no side strip). Loading = Spinner sm.
 *  · Title Body/Default Medium, description Body/Default (tabular numbers), both in the tone colour
 *    (Neutral: foreground / muted-foreground).
 *  · Actions (max 2) 8px under the text: Outline sm + Ghost sm. Compact = one line, one Ghost sm action.
 *  · Close = plain ✕ 16 in a 24×24 ghost button (none on Loading).
 *  · Timer = 3px bar in the solid tone colour along the bottom edge, draining toward the inline-start edge.
 *    Not on Error / Loading.
 * Behaviour (Toaster): bottom-end 24px on desktop / tablet, top under the app bar on mobile; newest in front, max 3
 * visible, older ones peek 8px behind and expand on hover / focus; 5s (Warning or with an action 8s), Error and
 * Loading stay; the timer pauses on hover, focus or while the tab is hidden; ✕ / Esc / swipe closes; an identical
 * toast restarts the timer and shows ×2; F6 reaches the "Notifications" region; focus never moves to a toast.
 */

export type ToastTone = "success" | "error" | "warning" | "info" | "neutral" | "loading"
export type ToastAction = { label: string; onClick: () => void }

export type ToastOptions = {
  /** Reuse an id to update a toast in place (e.g. Loading → Success). */
  id?: string
  description?: React.ReactNode
  /** Primary action — Button Outline sm (Compact: Ghost sm). */
  action?: ToastAction
  /** Secondary action — Button Ghost sm. Max 2 actions in total. */
  secondaryAction?: ToastAction
  /** ms; defaults: 5s, Warning or with an action 8s, Error / Loading until closed. */
  duration?: number
  /** One line: icon, title, one action, ✕. For quick utility feedback (copied, draft saved). */
  compact?: boolean
}
/** Error toasts always offer Try again (its label comes from the locale); `retry` is what it runs. */
export type ErrorToastOptions = Omit<ToastOptions, "action"> & { retry: () => void }

type ToastData = {
  id: string
  tone: ToastTone
  title: React.ReactNode
  description?: React.ReactNode
  action?: ToastAction
  secondaryAction?: ToastAction
  retry?: () => void
  compact?: boolean
  duration: number
  /** Changes whenever the timer restarts (new, duplicate, updated). */
  started: number
  count: number
  closing: boolean
  sig?: string
}

const ENTER_MS = 200
const EXIT_MS = 150
const GAP = 8
const PEEK = 8
const SHRINK = 0.05
const VISIBLE = 3

/* ───────────────────────────── store ───────────────────────────── */

let toasts: ToastData[] = [] // newest first
let seq = 0
const listeners = new Set<() => void>()
const set = (next: ToastData[]) => {
  toasts = next
  listeners.forEach((l) => l())
}

const durationOf = (tone: ToastTone, hasAction: boolean, duration?: number) => {
  if (duration !== undefined) return duration
  if (tone === "error" || tone === "loading") return Infinity
  return tone === "warning" || hasAction ? 8000 : 5000
}

function show(tone: ToastTone, title: React.ReactNode, opts: ToastOptions & { retry?: () => void } = {}) {
  const { id: wanted, description, action, secondaryAction, retry, compact, duration } = opts
  const dur = durationOf(tone, !!(action || retry), duration)
  const now = Date.now()
  const plain = typeof title === "string" && (description === undefined || typeof description === "string")
  const sig = plain && tone !== "loading" ? `${tone}|${title}|${description ?? ""}` : undefined

  // Update in place (Loading → Success / Error, or an explicit id).
  if (wanted && toasts.some((t) => t.id === wanted && !t.closing)) {
    set(toasts.map((t) => (t.id === wanted ? { ...t, tone, title, description, action, secondaryAction, retry, compact, duration: dur, started: now, sig } : t)))
    return wanted
  }
  // Identical toast already showing → restart its timer and count it (×2); it doesn't stack.
  const dupe = sig && toasts.find((t) => t.sig === sig && !t.closing)
  if (dupe) {
    set(toasts.map((t) => (t.id === dupe.id ? { ...t, count: t.count + 1, started: now } : t)))
    return dupe.id
  }
  const id = wanted ?? `toast-${++seq}`
  set([{ id, tone, title, description, action, secondaryAction, retry, compact, duration: dur, started: now, count: 1, closing: false, sig }, ...toasts])
  return id
}

function dismiss(id?: string) {
  const ids = new Set(id ? [id] : toasts.map((t) => t.id))
  if (!toasts.some((t) => ids.has(t.id) && !t.closing)) return
  set(toasts.map((t) => (ids.has(t.id) ? { ...t, closing: true } : t)))
  window.setTimeout(() => set(toasts.filter((t) => !(ids.has(t.id) && t.closing))), EXIT_MS)
}

type Msg = string | { title: React.ReactNode; description?: React.ReactNode }
const msg = (m: Msg) => (typeof m === "string" ? { title: m } : m)

/** The app's toast API (DS sheet 12). Never call a toast library directly. */
export const toast = {
  success: (title: React.ReactNode, opts?: ToastOptions) => show("success", title, opts),
  /** Always offers Try again, which runs `retry`. Stays until closed. */
  error: (title: React.ReactNode, opts: ErrorToastOptions) => show("error", title, opts),
  warning: (title: React.ReactNode, opts?: ToastOptions) => show("warning", title, opts),
  info: (title: React.ReactNode, opts?: ToastOptions) => show("info", title, opts),
  /** Neutral — small utility feedback (copied, link shared). */
  message: (title: React.ReactNode, opts?: ToastOptions) => show("neutral", title, opts),
  /** Loading — stays until it's updated (same id) or dismissed; no ✕, no timer. */
  loading: (title: React.ReactNode, opts?: Omit<ToastOptions, "duration">) => show("loading", title, opts),
  dismiss,
  /** Loading → Success or Error. `run` is called now, and again by the error toast's Try again. */
  promise<T>(
    run: () => Promise<T>,
    m: { loading: Msg; success: Msg | ((v: T) => Msg); error: Msg | ((e: unknown) => Msg); action?: ToastAction }
  ): Promise<T> {
    const l = msg(m.loading)
    const id = show("loading", l.title, { description: l.description })
    const p = run()
    p.then(
      (v) => {
        const s = msg(typeof m.success === "function" ? m.success(v) : m.success)
        show("success", s.title, { id, description: s.description, action: m.action })
      },
      (e) => {
        const s = msg(typeof m.error === "function" ? m.error(e) : m.error)
        show("error", s.title, { id, description: s.description, retry: () => void toast.promise(run, m) })
      }
    )
    return p
  },
}

/* ───────────────────────────── card ───────────────────────────── */

const TONES: Record<ToastTone, { icon?: IconName; card: string; desc?: string; close?: string; bar?: string }> = {
  success: { icon: "tick-circle", card: "border-success-soft bg-success-soft text-success-soft-foreground", bar: "bg-success" },
  error: { icon: "danger", card: "border-destructive-soft bg-destructive-soft text-destructive-soft-foreground" },
  warning: { icon: "warning-2", card: "border-warning-soft bg-warning-soft text-warning-soft-foreground", bar: "bg-warning" },
  info: { icon: "info-circle", card: "border-info-soft bg-info-soft text-info-soft-foreground", bar: "bg-info" },
  neutral: { icon: "info-circle", card: "border-border bg-popover text-foreground", desc: "text-muted-foreground", close: "text-muted-foreground", bar: "bg-muted-foreground" },
  loading: { card: "border-accent bg-accent text-primary" },
}

/**
 * The toast card (presentational). The Toaster renders it with a live timer; previews pass `timer` as the
 * remaining fraction (0–1) to draw a static bar.
 */
export function ToastCard({
  tone,
  title,
  description,
  action,
  secondaryAction,
  compact,
  count = 1,
  onClose,
  closeLabel = "Close",
  timer,
  className,
}: {
  tone: ToastTone
  title: React.ReactNode
  description?: React.ReactNode
  action?: ToastAction
  secondaryAction?: ToastAction
  compact?: boolean
  count?: number
  onClose?: () => void
  closeLabel?: string
  /** Remaining fraction for a static bar, or the live bar element. */
  timer?: number | React.ReactNode
  className?: string
}) {
  const s = TONES[tone]
  return (
    <div data-slot="toast" data-tone={tone} className={cn("flex w-full flex-col overflow-hidden rounded-[10px] border font-sans shadow-lg", s.card, className)}>
      <div className={cn("flex gap-3", compact ? "items-center px-4 py-3" : "items-start p-4")}>
        <span className="flex size-5 shrink-0 items-center justify-center">{s.icon ? <Icon name={s.icon} size={20} /> : <Spinner size="sm" />}</span>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <p className="text-sm font-medium">
            {title}
            {count > 1 && (
              <bdi dir="ltr" className="ms-1.5 font-normal tabular-nums opacity-75">
                ×{count}
              </bdi>
            )}
          </p>
          {!compact && description && <p className={cn("text-sm tabular-nums", s.desc)}>{description}</p>}
          {!compact && (action || secondaryAction) && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {action && (
                <Button variant="outline" size="sm" onClick={action.onClick}>
                  {action.label}
                </Button>
              )}
              {secondaryAction && (
                <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </Button>
              )}
            </div>
          )}
        </div>
        {compact && action && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {tone !== "loading" && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className={cn(
              "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none hover:bg-current/10 focus-visible:ring-[3px] focus-visible:ring-ring/50",
              s.close
            )}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      {s.bar && timer !== undefined && (
        <div className="h-0.75 w-full shrink-0" aria-hidden>
          {typeof timer === "number" ? <div className={cn("h-full", s.bar)} style={{ inlineSize: `${timer * 100}%` }} /> : timer}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────────── toaster ───────────────────────────── */

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
const EMPTY: ToastData[] = []
const useToasts = () => React.useSyncExternalStore(subscribe, () => toasts, () => EMPTY)

const useDocumentHidden = () =>
  React.useSyncExternalStore(
    (l) => {
      document.addEventListener("visibilitychange", l)
      return () => document.removeEventListener("visibilitychange", l)
    },
    () => document.hidden,
    () => false
  )

/** One global toaster, mounted once in the app providers. */
export function Toaster() {
  const t = useTranslations("common.toast")
  const tc = useTranslations("common.actions")
  const list = useToasts()
  const mobile = useIsMobile()
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)")
  const hidden = useDocumentHidden()
  const [hovered, setHovered] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [heights, setHeights] = React.useState<Record<string, number>>({})
  const region = React.useRef<HTMLOListElement>(null)
  const before = React.useRef<HTMLElement | null>(null)

  const live = list.filter((x) => !x.closing)
  const engaged = (hovered || focused) && live.length > 0
  const expanded = engaged && live.length > 1
  const paused = engaged || hidden

  // F6 jumps to the Notifications region and back again.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F6" || !region.current) return
      if (region.current.contains(document.activeElement)) {
        e.preventDefault()
        before.current?.focus()
      } else if (toasts.some((x) => !x.closing)) {
        e.preventDefault()
        before.current = document.activeElement as HTMLElement | null
        region.current.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const onHeight = React.useCallback((id: string, h: number) => setHeights((m) => (m[id] === h ? m : { ...m, [id]: h })), [])

  const dir = mobile ? 1 : -1 // the stack grows down from the top on mobile, up from the bottom elsewhere
  const front = heights[live[0]?.id] ?? 0
  const pos: Record<string, { y: number; i: number }> = {}
  let offset = 0
  live.forEach((x, i) => {
    // Collapsed: each older card is scaled by (1 − i·5%) around the anchored edge, so push it out by that much more
    // to keep an 8px peek per card.
    pos[x.id] = { y: expanded ? offset : i * (PEEK + front * SHRINK), i }
    offset += (heights[x.id] ?? 0) + GAP
  })
  const shown = Math.min(live.length, VISIBLE)
  const height =
    live.length === 0 ? 0 : expanded ? live.slice(0, VISIBLE).reduce((s, x) => s + (heights[x.id] ?? 0), 0) + GAP * (shown - 1) : front + PEEK * (shown - 1)

  /**
   * Close a toast. If focus is inside it (its ✕ / action was clicked, or Esc), hand focus on first — removing a focused
   * element fires no blur, which would leave the stack "focused" and every later timer paused. With other toasts left,
   * focus stays in the region; otherwise it goes back where it was (or simply leaves).
   */
  const close = React.useCallback((id: string) => {
    const ol = region.current
    const active = document.activeElement as HTMLElement | null
    if (ol && active && ol.contains(active)) {
      const others = toasts.some((x) => x.id !== id && !x.closing)
      if (others) ol.focus()
      else if (before.current && before.current !== document.body && before.current.isConnected) before.current.focus()
      else active.blur()
      if (!others) setFocused(false)
    }
    // The stack under the cursor goes away with its last toast; no pointerleave would follow.
    if (!toasts.some((x) => x.id !== id && !x.closing)) setHovered(false)
    dismiss(id)
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return
    const li = (e.target as HTMLElement).closest<HTMLElement>("[data-toast-id]")
    const id = li?.dataset.toastId ?? live[0]?.id
    if (!id) return
    e.stopPropagation()
    close(id)
  }

  return (
    <section aria-label={t("region")} className="pointer-events-none fixed z-[100] max-md:inset-x-4 max-md:top-16 md:end-6 md:bottom-6 md:w-95">
      <ol
        ref={region}
        tabIndex={-1}
        // Hover pauses only once the mouse really moves over the stack: a toast that appears under a resting cursor
        // (e.g. right where the button you just clicked was) keeps counting. Browsers' synthetic moves have no delta.
        onPointerMove={(e) => e.pointerType === "mouse" && (e.movementX !== 0 || e.movementY !== 0) && !hovered && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocused(false)}
        onKeyDown={onKeyDown}
        className={cn("relative outline-none", live.length > 0 && "pointer-events-auto")}
        style={{ height, transition: reduced ? undefined : `height ${ENTER_MS}ms ease-out` }}
      >
        {list.map((x) => {
          const p = pos[x.id] ?? { y: 0, i: 0 }
          return (
            <ToastItem
              key={x.id}
              data={x}
              y={p.y * dir}
              index={p.i}
              collapsed={!expanded && p.i > 0 ? front : undefined}
              mobile={mobile}
              reduced={reduced}
              paused={paused || p.i >= VISIBLE}
              closeLabel={t("close")}
              retryLabel={tc("tryAgain")}
              onHeight={onHeight}
              onClose={close}
            />
          )
        })}
      </ol>
    </section>
  )
}

function ToastItem({
  data: x,
  y,
  index,
  collapsed,
  mobile,
  reduced,
  paused,
  closeLabel,
  retryLabel,
  onHeight,
  onClose,
}: {
  onClose: (id: string) => void
  data: ToastData
  y: number
  index: number
  /** Height of the front toast when this one is collapsed behind it. */
  collapsed?: number
  mobile: boolean
  reduced: boolean
  paused: boolean
  closeLabel: string
  retryLabel: string
  onHeight: (id: string, h: number) => void
}) {
  const inner = React.useRef<HTMLDivElement>(null)
  const [entered, setEntered] = React.useState(false)
  const [drag, setDrag] = React.useState<{ x0: number; dx: number } | null>(null)
  const [swiped, setSwiped] = React.useState(0)
  const remaining = React.useRef(x.duration)
  const since = React.useRef(0)

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Measure the natural height only while uncollapsed (a collapsed card is clamped to the front card's height).
  const isCollapsed = collapsed !== undefined
  const clamped = React.useRef(isCollapsed)
  React.useLayoutEffect(() => {
    clamped.current = isCollapsed
  })
  React.useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const ro = new ResizeObserver(() => !clamped.current && onHeight(x.id, el.offsetHeight))
    ro.observe(el)
    onHeight(x.id, el.offsetHeight)
    return () => ro.disconnect()
  }, [x.id, onHeight])

  // Timer: restarts whenever `started` changes, pauses while `paused`. (Cleanups run before setups, so a restart
  // first books the elapsed time, then resets it.)
  React.useEffect(() => {
    remaining.current = x.duration
  }, [x.started, x.duration])
  const timed = Number.isFinite(x.duration) && !x.closing
  React.useEffect(() => {
    if (!timed || paused) return
    since.current = Date.now()
    const id = window.setTimeout(() => dismiss(x.id), Math.max(0, remaining.current))
    return () => {
      window.clearTimeout(id)
      remaining.current -= Date.now() - since.current
    }
  }, [timed, paused, x.id, x.started])

  const act = (a?: ToastAction) =>
    a && {
      label: a.label,
      onClick: () => {
        onClose(x.id)
        a.onClick()
      },
    }

  // Swipe sideways to dismiss (touch / pen).
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button")) return
    setDrag({ x0: e.clientX, dx: 0 })
  }
  const onPointerMove = (e: React.PointerEvent) => drag && setDrag({ ...drag, dx: e.clientX - drag.x0 })
  const onPointerUp = () => {
    if (!drag) return
    if (Math.abs(drag.dx) > 64) {
      setSwiped(Math.sign(drag.dx))
      dismiss(x.id)
    }
    setDrag(null)
  }

  const behind = index >= VISIBLE
  const enter = entered || reduced ? 0 : mobile ? -100 : 100
  const dx = swiped ? swiped * 160 : (drag?.dx ?? 0)
  const scale = isCollapsed ? 1 - index * SHRINK : 1
  const fade = `opacity ${x.closing ? EXIT_MS : ENTER_MS}ms ease-out`

  return (
    <li
      data-toast-id={x.id}
      role={x.tone === "error" ? "alert" : "status"}
      aria-live={x.tone === "error" ? "assertive" : "polite"}
      aria-atomic
      aria-hidden={behind || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      className={cn("absolute inset-x-0 touch-pan-y", mobile ? "top-0 origin-top" : "bottom-0 origin-bottom", (behind || x.closing) && "pointer-events-none")}
      style={{
        zIndex: 100 - index,
        transform: `translate3d(${dx}px, calc(${y}px + ${enter}%), 0) scale(${scale})`,
        opacity: !entered || x.closing || behind ? 0 : drag ? Math.max(0.3, 1 - Math.abs(drag.dx) / 200) : 1,
        transition: reduced ? fade : drag ? "none" : `transform ${ENTER_MS}ms ease-out, height ${ENTER_MS}ms ease-out, ${fade}`,
        height: collapsed,
        overflow: isCollapsed ? "hidden" : undefined,
      }}
    >
      <div ref={inner} className={cn(isCollapsed && "h-full [&>[data-slot=toast]>*]:opacity-0")}>
        <ToastCard
          tone={x.tone}
          title={x.title}
          description={x.description}
          action={act(x.retry ? { label: retryLabel, onClick: x.retry } : x.action)}
          secondaryAction={act(x.secondaryAction)}
          compact={x.compact}
          count={x.count}
          onClose={() => onClose(x.id)}
          closeLabel={closeLabel}
          timer={
            Number.isFinite(x.duration) ? (
              <div
                key={x.started}
                className={cn("h-full", TONES[x.tone].bar)}
                style={{ animation: `toast-timer ${x.duration}ms linear forwards`, animationPlayState: paused || x.closing ? "paused" : "running" }}
              />
            ) : undefined
          }
          className={cn(isCollapsed && "h-full")}
        />
      </div>
    </li>
  )
}
