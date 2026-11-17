// Static build for GitHub Pages: `npm run build:pages` → ./out
//  · NEXT_PUBLIC_STATIC_EXPORT=1 switches next.config to `output: "export"` (+ base path, trailing slashes, unoptimized images)
//  · src/proxy.ts (locale + sign-in redirects) can't run on static hosting: it's set aside during the build and restored
//    after; the app's client-side guards take over (see src/lib/static.ts)
//  · out/index.html sends the site root to /en/, and .nojekyll keeps GitHub from hiding the _next folder
import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, readdirSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/medical-system-next"
const proxy = "src/proxy.ts"
const parked = "src/proxy.ts.static-off"

if (existsSync(proxy)) renameSync(proxy, parked)
let status = 1
try {
  const r = spawnSync("npx next build", {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NEXT_PUBLIC_STATIC_EXPORT: "1", NEXT_PUBLIC_BASE_PATH: base },
  })
  status = r.status ?? 1
} finally {
  if (existsSync(parked)) renameSync(parked, proxy)
}
if (status !== 0) process.exit(status)

// Next writes client-navigation payloads as nested folders (__next.$d$locale/!KGFwcCk/dashboard/__PAGE__.txt) but the
// browser asks for the dot-joined name (__next.$d$locale.!KGFwcCk.dashboard.__PAGE__.txt) — a server would map that,
// static hosting can't. Write a flat copy next to each nested file so in-app navigation stays a soft (no-reload) one.
let flat = 0
function flatten(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (!e.isDirectory()) continue
    if (e.name.startsWith("__next.")) {
      const walk = (d, prefix) => {
        for (const x of readdirSync(d, { withFileTypes: true })) {
          const q = join(d, x.name)
          if (x.isDirectory()) walk(q, `${prefix}.${x.name}`)
          else {
            copyFileSync(q, join(dir, `${prefix}.${x.name}`))
            flat++
          }
        }
      }
      walk(p, e.name)
    } else flatten(p)
  }
}
flatten("out")
console.log(`Flattened ${flat} navigation payloads`)

writeFileSync(
  "out/index.html",
  `<!doctype html><meta charset="utf-8"><title>Medical System</title><meta http-equiv="refresh" content="0; url=${base}/en/"><link rel="canonical" href="${base}/en/"><a href="${base}/en/">Medical System</a>\n`,
)
writeFileSync("out/.nojekyll", "")
console.log(`\nStatic site ready in ./out (base path ${base || "/"})`)
