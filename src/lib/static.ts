/**
 * Static export (GitHub Pages): `npm run build:pages` builds the app as plain files under a base path
 * (NEXT_PUBLIC_BASE_PATH, e.g. "/medical-system-next"). There's no server there, so:
 *  · the proxy (locale + sign-in redirect) is replaced by client-side guards (AuthGate, home redirect)
 *  · cookies are read in the browser only
 *  · files in /public need the base path — use `asset()` for them (next/image doesn't add it)
 */
export const STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1"
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

/** asset("/specialties/eye.png") → "/medical-system-next/specialties/eye.png" on the static site. */
export const asset = (path: string) => `${BASE_PATH}${path}`

/** Signed-in check in the browser (the mock session cookie set by the verify step). */
export const hasSessionCookie = (name: string) => typeof document !== "undefined" && document.cookie.split("; ").some((c) => c.startsWith(`${name}=`))
