import { ApiError } from "./api/errors.ts"

/** What the code page does with an answer of POST /api/login/2fa. The API decides the tries; the page only shows them. */
export type VerifyProblem =
  | { kind: "wrong"; triesLeft: number }
  | { kind: "over" }
  | { kind: "expired" }
  | { kind: "tooMany"; seconds: number }
  | { kind: "network" }

export function verifyProblem(e: unknown): VerifyProblem {
  if (!(e instanceof ApiError)) return { kind: "network" }
  if (e.code === "invalid_code") return { kind: "wrong", triesLeft: e.triesLeft ?? 0 }
  if (e.code === "code_tries_exhausted") return { kind: "over" }
  if (e.code === "step_expired" || e.code === "unauthenticated") return { kind: "expired" }
  if (e.code === "too_many_requests") return { kind: "tooMany", seconds: e.retryAfter ?? 60 }
  return { kind: "network" }
}

/** What the code page does with an answer of POST /api/login/2fa/resend. */
export type ResendProblem =
  | { kind: "wait"; seconds: number }
  | { kind: "expired" }
  | { kind: "tooMany"; seconds: number }
  | { kind: "failed" }
  | { kind: "network" }

export function resendProblem(e: unknown): ResendProblem {
  if (!(e instanceof ApiError)) return { kind: "network" }
  if (e.code === "resend_wait") return { kind: "wait", seconds: e.retryAfter ?? 45 }
  if (e.code === "step_expired" || e.code === "unauthenticated") return { kind: "expired" }
  if (e.code === "too_many_requests") return { kind: "tooMany", seconds: e.retryAfter ?? 60 }
  if (e.code === "send_failed" || e.code === "resend_unavailable") return { kind: "failed" }
  return { kind: "network" }
}
