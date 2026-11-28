import { ApiError, apiErrorFrom, networkError } from "./errors.ts"

/**
 * The one API client (fetch wrapper). Rules (security/inherited-findings.md: HIGH-008, MEDIUM-001/002, LOW-005/008):
 *  - Same-origin requests to `/api/...`; the proxy forwards them to the API (src/proxy.ts). No other host is ever called.
 *  - `X-Auth-Mode: cookie`: the API sets an httpOnly cookie and sends no token. This module never holds, stores or reads a
 *    token: no localStorage, sessionStorage, JS-readable cookie or URL.
 *  - Errors are typed by the API's `code` (errors.ts), never by the English message.
 *  - `api` (signed-in calls): a 401 clears the client's state and sends the user to sign in; a 403 reloads /api/user once.
 *  - `publicApi` (sign-in and other signed-out calls): neither of those, the caller shows the error.
 */
export type Query = Record<string, string | number | boolean | null | undefined>
export type RequestOptions = { body?: unknown; query?: Query; signal?: AbortSignal }
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type Listener = () => void
const endedListeners = new Set<Listener>()
let forbiddenHandler: (() => Promise<unknown>) | null = null
let forbiddenInFlight: Promise<unknown> | null = null

/** Called when the session ended (401): drop every cached copy of who the user is. */
export function onSessionEnded(fn: Listener) {
  endedListeners.add(fn)
  return () => {
    endedListeners.delete(fn)
  }
}

/** The session provider registers how to reload /api/user after a 403 (permissions may have changed). */
export function setForbiddenHandler(fn: (() => Promise<unknown>) | null) {
  forbiddenHandler = fn
}

/** `/en/patients?x=1` → `/en/login?next=%2Fpatients%3Fx%3D1`; already on a sign-in page → the same page without `next`. */
export function loginUrlFor(pathname: string, search = ""): string {
  const m = pathname.match(/^\/([a-z]{2})(\/.*)?$/)
  const locale = m ? m[1] : ""
  const rest = m ? (m[2] ?? "/") : pathname
  const prefix = locale ? `/${locale}` : ""
  if (rest === "/login" || rest.startsWith("/login/")) return `${prefix}/login`
  const next = rest === "/" ? "" : `?next=${encodeURIComponent(rest + search)}`
  return `${prefix}/login${next}`
}

function endSession() {
  for (const fn of endedListeners) fn()
  if (typeof window !== "undefined") {
    const target = loginUrlFor(window.location.pathname, window.location.search)
    if (window.location.pathname + window.location.search !== target) window.location.assign(target)
  }
}

function reloadUserOnce() {
  if (!forbiddenHandler) return
  forbiddenInFlight ??= forbiddenHandler()
    .catch(() => undefined)
    .finally(() => {
      forbiddenInFlight = null
    })
}

function buildUrl(path: string, query?: Query) {
  if (!path.startsWith("/api/")) throw new Error("API paths start with /api/")
  if (!query) return path
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) params.set(k, String(v))
  const s = params.toString()
  return s ? `${path}?${s}` : path
}

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null
  const text = await res.text().catch(() => "")
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Defence in depth: in cookie mode the API sends no `token`; if one ever arrives it is dropped, never kept. */
function dropToken(body: unknown) {
  if (body && typeof body === "object" && "token" in body) delete (body as Record<string, unknown>).token
  return body
}

async function send<T>(method: Method, path: string, opts: RequestOptions, isPublic: boolean): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", "X-Auth-Mode": "cookie" }
  const init: RequestInit = { method, headers, credentials: "same-origin", cache: "no-store", signal: opts.signal }
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json"
    init.body = JSON.stringify(opts.body)
  }

  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), init)
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw networkError()
  }

  const body = await readBody(res)
  if (res.ok) return dropToken(body) as T

  const error = apiErrorFrom(res.status, body, res.headers.get("Retry-After"))
  if (!isPublic) {
    if (res.status === 401) endSession()
    else if (res.status === 403 && path !== "/api/user") reloadUserOnce()
  }
  throw error
}

function make(isPublic: boolean) {
  return {
    get: <T>(path: string, opts: Omit<RequestOptions, "body"> = {}) => send<T>("GET", path, opts, isPublic),
    post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "body"> = {}) => send<T>("POST", path, { ...opts, body }, isPublic),
    put: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "body"> = {}) => send<T>("PUT", path, { ...opts, body }, isPublic),
    patch: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "body"> = {}) => send<T>("PATCH", path, { ...opts, body }, isPublic),
    delete: <T>(path: string, opts: Omit<RequestOptions, "body"> = {}) => send<T>("DELETE", path, opts, isPublic),
  }
}

/** Signed-in calls. */
export const api = make(false)
/** Signed-out calls (sign-in, code, branch, password reset): no redirect on 401, no /api/user reload on 403. */
export const publicApi = make(true)

export { ApiError }
