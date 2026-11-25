// Counts the guarded links into each module and module tab (IfModule / IfTab / isModuleEnabled / isTabEnabled call sites
// outside the module itself), so Settings › Modules can say how many links move to the replacement when one is turned off.
// Run: node scripts/module-links.mjs  → writes src/config/module-links.json
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, sep } from "node:path"

const ROOTS = ["src/modules", "src/components", "src/app"]
const DIR_OF = { lab: "labs" }
const files = []
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(tsx|ts)$/.test(f)) files.push(p)
  }
}
ROOTS.forEach(walk)

const modules = {}
const tabs = {}
const PATTERNS = [
  [/IfModule\s+id="([a-z]+)"/g, "m"],
  [/isModuleEnabled\("([a-z]+)"\)/g, "m"],
  [/IfTab\s+module="([a-z]+)"\s+tab="([a-z]+)"/g, "t"],
  [/isTabEnabled\("([a-z]+)",\s*"([a-z]+)"\)/g, "t"],
]
for (const f of files) {
  const src = readFileSync(f, "utf8")
  const parts = f.split(sep)
  for (const [re, kind] of PATTERNS) {
    for (const m of src.matchAll(re)) {
      const mod = m[1]
      const own = parts.includes(DIR_OF[mod] ?? mod) && parts.includes("modules")
      // Route guards (layouts / tab guards in src/app) aren't links.
      if (own || parts.includes("app")) continue
      if (kind === "m") modules[mod] = (modules[mod] ?? 0) + 1
      else {
        const key = `${mod}.${m[2]}`
        tabs[key] = (tabs[key] ?? 0) + 1
        modules[mod] = (modules[mod] ?? 0) + 1
      }
    }
  }
}
// Every module is also reached from the 4 nav surfaces (sidebar, rail, bottom nav or More sheet, header title).
const NAV = 4
const out = { nav: NAV, modules, tabs }
writeFileSync("src/config/module-links.json", JSON.stringify(out, null, 2) + "\n")
console.log(out)
