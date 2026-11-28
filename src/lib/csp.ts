/**
 * Content-Security-Policy for pages (set per request by src/proxy.ts, with a fresh nonce).
 *
 *  - Scripts: only 'self' files and scripts that carry this request's nonce ('strict-dynamic' lets those load their own chunks).
 *    No 'unsafe-inline' and no 'unsafe-eval' in production. Development adds 'unsafe-eval' because React needs it there.
 *  - Styles: 'unsafe-inline' stays. The design system, Radix, recharts and Sonner set `style="..."` attributes and inject
 *    <style> tags at run time, and a nonce does not cover style attributes. Style injection is a much smaller risk than script
 *    injection; the policy blocks every other source of CSS.
 *  - Images: own files, `data:` and `blob:` (previews of files the user picks). Fonts: own files (next/font self-hosts them).
 *  - connect-src 'self': the browser talks only to this origin; the proxy forwards /api to the API.
 *  - No framing (frame-ancestors 'none'), no plug-ins, <base> and form posts only to this origin.
 */
export function buildCsp({ nonce, dev, https }: { nonce: string; dev: boolean; https: boolean }): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
  if (https) directives.push("upgrade-insecure-requests")
  return directives.join("; ")
}

export const HSTS = "max-age=31536000; includeSubDomains"
