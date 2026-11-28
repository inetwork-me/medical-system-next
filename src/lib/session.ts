/**
 * Mock session (until the real auth API exists): a cookie set after the 2-step code is verified.
 * The proxy keeps signed-out users on the auth pages; /[locale]/logout clears it.
 */
export const SESSION_COOKIE = "ms_session"

/**
 * Real session (HIS_AUTH_MODE=api): the cookie `his_session` is set by the API, httpOnly, and signed. The proxy verifies the
 * signature and expiry (src/lib/api/session-cookie.ts); the browser never reads it. The name is also in session-cookie.ts.
 */
export { API_SESSION_COOKIE } from "./api/session-cookie"

/** Paths (without locale) reachable without a session. */
export const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/logout", "/dev"]

export const isPublicPath = (path: string) =>
  path === "/" || PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))

/** Keep me signed in → 30 days; otherwise a browser-session cookie. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30
