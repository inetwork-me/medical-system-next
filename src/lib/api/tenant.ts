/**
 * The tenant is the first label of the host the browser used: `demo.localhost:3010` gives `demo`, `demo.example.com` gives
 * `demo`. A host with one label (`localhost`) or an IP address gives none. The proxy sets `X-Tenant-Subdomain` from this and
 * removes any value the client sent, so a client cannot choose another tenant than the address it opened.
 */
export function tenantFromHost(host: string | null | undefined): string | null {
  if (!host) return null
  const name = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "")
  if (name === "" || name.startsWith("[") || /^\d+(\.\d+){3}$/.test(name)) return null
  const labels = name.split(".")
  if (labels.length < 2) return null
  const first = labels[0]
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(first) ? first : null
}
