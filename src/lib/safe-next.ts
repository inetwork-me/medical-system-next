/**
 * Where to go after sign-in: the `?next=` path, only if it is a path on this site. Anything else (another site, `//host`,
 * a backslash, a scheme, a path that already is a sign-in page) falls back to null and the caller uses the dashboard.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null
  if (/^\/(login|logout)(\/|\?|$)/.test(next)) return null
  try {
    const url = new URL(next, "http://placeholder.invalid")
    if (url.origin !== "http://placeholder.invalid") return null
  } catch {
    return null
  }
  return next
}
