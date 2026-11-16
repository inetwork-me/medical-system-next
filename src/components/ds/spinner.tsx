import { cn } from "@/lib/utils"

/**
 * DS sheet 08 · Spinner (drawn: Iconsax has no loader). Track = border, arc = primary;
 * inverse tone for use on primary buttons (white arc on a translucent track).
 */
const SIZES = { sm: 16, md: 24, lg: 32 } as const

export function Spinner({
  size = "md",
  tone = "default",
  label,
  className,
}: {
  size?: keyof typeof SIZES
  tone?: "default" | "inverse"
  /** Accessible label; omit when the surrounding text already says what is loading. */
  label?: string
  className?: string
}) {
  const px = SIZES[size]
  const stroke = size === "sm" ? 2 : size === "md" ? 2.5 : 3
  const r = (px - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 animate-spin motion-reduce:animate-[spin_1.5s_linear_infinite]", className)}
    >
      <circle
        cx={px / 2}
        cy={px / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className={tone === "inverse" ? "stroke-primary-foreground/35" : "stroke-border"}
      />
      <circle
        cx={px / 2}
        cy={px / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * 0.28} ${c}`}
        className={tone === "inverse" ? "stroke-primary-foreground" : "stroke-primary"}
      />
    </svg>
  )
}
