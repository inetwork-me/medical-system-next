import { STATIC_EXPORT } from "@/lib/static"

/**
 * How the server build treats sign-in, from the server environment variable HIS_AUTH_MODE (read at request time):
 *  - "mock": today's behaviour, a front-end-only sign-in with a fake cookie (`ms_session=1`) and sample user.
 *  - "api": the real sign-in on the API; pages need a valid `his_session` cookie; the shell shows the signed-in user.
 * The static export (GitHub Pages) has no server and no API: it is always "mock".
 */
export type AuthMode = "mock" | "api"

export function authMode(): AuthMode {
  if (STATIC_EXPORT) return "mock"
  return process.env.HIS_AUTH_MODE === "api" ? "api" : "mock"
}
