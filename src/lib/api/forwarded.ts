import { isIP } from "node:net"

/**
 * The API must see each browser's own address, not the front-end server's. The proxy sets the forwarded headers itself and
 * never passes on what the browser sent, so a browser cannot choose its own address.
 *
 * Where the address comes from: the proxy cannot read the connection's socket, so it relies on the proxy in front of Next
 * (nginx or a load balancer, see docs/DEPLOYMENT.md in the API repo), which writes `X-Forwarded-For` for the connection it
 * accepted. Entries are counted from the right, because each trusted hop adds its own entry at the right end and anything
 * the browser sent stays on the left. `hops` is how many trusted proxies sit in front of Next (default 1: the last entry is
 * the browser). The address chosen is sent on alone; the rest of the chain is dropped.
 */
const FORWARDED_NAMES = ["x-forwarded-for", "x-forwarded-proto", "x-forwarded-host", "x-forwarded-port", "x-forwarded-prefix", "x-real-ip", "forwarded"]

export function trustedHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return 1
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : 1
}

/** The browser's address from an `X-Forwarded-For` value, or null when there is none we can trust. */
export function clientAddress(xff: string | null | undefined, hops: number): string | null {
  if (!xff || hops < 1) return null
  const parts = xff.split(",").map((p) => p.trim())
  const candidate = parts[parts.length - hops]
  return candidate && isIP(candidate) ? candidate : null
}

/** Replace every forwarded header on `headers` (a copy of the browser's request) with values the server decided. */
export function setForwardedHeaders(
  headers: Headers,
  opts: { host: string | null; protocol: string; hops: number },
): void {
  const address = clientAddress(headers.get("x-forwarded-for"), opts.hops)
  for (const name of FORWARDED_NAMES) headers.delete(name)
  if (address) headers.set("x-forwarded-for", address)
  headers.set("x-forwarded-proto", opts.protocol === "https:" ? "https" : "http")
  if (opts.host) headers.set("x-forwarded-host", opts.host)
}
