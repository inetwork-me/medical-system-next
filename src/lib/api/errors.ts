/**
 * Typed API errors. The front-end matches the stable `code` the API sends, never the English `message`.
 * `network` is a request that did not reach the API (offline, reset, the proxy is down); `server` is any 5xx or an
 * answer that is not JSON; `unknown` is a 4xx the front-end has no code for.
 */
export type ApiErrorCode =
  | "invalid_credentials"
  | "locked"
  | "inactive"
  | "no_branch"
  | "too_many_requests"
  | "csrf_origin"
  | "invalid_code"
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "network"
  | "server"
  | "unknown"

const KNOWN: readonly string[] = [
  "invalid_credentials",
  "locked",
  "inactive",
  "no_branch",
  "too_many_requests",
  "csrf_origin",
  "invalid_code",
]

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  /** Seconds until the next try (423 and 429). */
  readonly retryAfter?: number
  /** Wrong-password tries left before the lock (401 invalid_credentials). */
  readonly attemptsLeft?: number
  /** Field errors of a 422. */
  readonly fieldErrors?: Record<string, string[]>

  constructor(status: number, code: ApiErrorCode, extra: { retryAfter?: number; attemptsLeft?: number; fieldErrors?: Record<string, string[]> } = {}) {
    // The message is for developers and logs: the code, never text from the API.
    super(`API error ${status} ${code}`)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.retryAfter = extra.retryAfter
    this.attemptsLeft = extra.attemptsLeft
    this.fieldErrors = extra.fieldErrors
  }
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined)

/** Builds the error for a non-2xx reply from its status, parsed JSON body (or null) and Retry-After header. */
export function apiErrorFrom(status: number, body: unknown, retryAfterHeader?: string | null): ApiError {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null
  const sent = b && typeof b.code === "string" ? b.code : null
  const retryAfter = num(b?.retry_after) ?? (retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : undefined)
  const attemptsLeft = num(b?.attempts_left)

  let code: ApiErrorCode
  if (sent && KNOWN.includes(sent)) code = sent as ApiErrorCode
  else if (status >= 500 || b === null) code = "server"
  else if (status === 401) code = "unauthenticated"
  else if (status === 403) code = "forbidden"
  else if (status === 404) code = "not_found"
  else if (status === 422) code = "validation"
  else if (status === 429) code = "too_many_requests"
  else code = "unknown"

  const raw = b?.errors
  const fieldErrors = status === 422 && raw && typeof raw === "object" ? (raw as Record<string, string[]>) : undefined
  return new ApiError(status, code, { retryAfter, attemptsLeft, fieldErrors })
}

export const networkError = () => new ApiError(0, "network")
