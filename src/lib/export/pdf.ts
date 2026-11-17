/**
 * Client-side PDF documents (mock storage, no server yet). Pages are drawn on a canvas — so the app's own
 * font, Arabic shaping and RTL work — then each page is embedded as a JPEG in a minimal A4 PDF.
 * Swap for server-rendered PDFs when the backend lands; callers only see `pdfDocument(...)` → Blob.
 */

export type PdfBlock =
  | { kind: "brand"; title: string; subtitle?: string }
  | { kind: "title"; text: string }
  | { kind: "meta"; text: string }
  | { kind: "kv"; rows: [string, string][] }
  | { kind: "table"; head: string[]; rows: string[][]; weights?: number[]; endAlign?: number[] }
  | { kind: "note"; text: string }

const PT_W = 595
const PT_H = 842
const SCALE = 2 // px per pt → crisp text at 144 dpi
const M = 48 // page margin (pt)

const C = {
  fg: "#020618",
  muted: "#62748E",
  border: "#E2E8F0",
  soft: "#F8FAFC",
  primary: "#155DFC",
  white: "#FFFFFF",
}

function fontFamily() {
  return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"
}

/** Draw blocks onto as many A4 canvases as needed. */
function drawPages(blocks: PdfBlock[], dir: "ltr" | "rtl") {
  const family = fontFamily()
  const pages: HTMLCanvasElement[] = []
  let ctx!: CanvasRenderingContext2D
  let y = M
  const inner = PT_W - M * 2

  const newPage = () => {
    const c = document.createElement("canvas")
    c.width = PT_W * SCALE
    c.height = PT_H * SCALE
    ctx = c.getContext("2d")!
    ctx.scale(SCALE, SCALE)
    ctx.fillStyle = C.white
    ctx.fillRect(0, 0, PT_W, PT_H)
    ctx.direction = dir
    ctx.textBaseline = "alphabetic"
    pages.push(c)
    y = M
  }
  const ensure = (h: number) => {
    if (y + h > PT_H - M) newPage()
  }
  /** x of the logical start / end edge of a box that starts `off` pt from the logical start. */
  const sx = (off: number) => (dir === "rtl" ? PT_W - M - off : M + off)
  const ex = (off: number, w: number) => (dir === "rtl" ? PT_W - M - off - w : M + off + w)
  const font = (size: number, weight = 400) => (ctx.font = `${weight} ${size}px ${family}`)
  const wrap = (text: string, width: number) => {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let line = ""
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (ctx.measureText(next).width > width && line) {
        lines.push(line)
        line = w
      } else line = next
    }
    if (line) lines.push(line)
    return lines
  }
  const text = (s: string, x: number, yy: number, align: CanvasTextAlign, color = C.fg) => {
    ctx.fillStyle = color
    ctx.textAlign = align
    // In RTL, a value with no Arabic letters (phone "059 300 1287", amounts, codes) is isolated as LTR so its
    // space-separated groups keep their order; mixed Arabic text is left to the bidi algorithm.
    ctx.fillText(dir === "rtl" && !/[؀-ۿ]/.test(s) ? `⁦${s}⁩` : s, x, yy)
  }

  newPage()
  for (const b of blocks) {
    switch (b.kind) {
      case "brand": {
        ensure(44)
        const box = 30
        const bx = dir === "rtl" ? PT_W - M - box : M
        ctx.fillStyle = C.primary
        ctx.beginPath()
        ctx.roundRect(bx, y, box, box, 6)
        ctx.fill()
        font(13, 700)
        text("+", bx + box / 2, y + 20, "center", C.white)
        font(12, 600)
        text(b.title, sx(box + 10), y + 13, "start")
        if (b.subtitle) {
          font(9)
          text(b.subtitle, sx(box + 10), y + 26, "start", C.muted)
        }
        y += box + 18
        break
      }
      case "title": {
        font(18, 600)
        ensure(28)
        text(b.text, sx(0), y + 18, "start")
        y += 30
        break
      }
      case "meta":
      case "note": {
        font(9)
        const lines = wrap(b.text, inner)
        ensure(lines.length * 13 + 6)
        for (const l of lines) {
          text(l, b.kind === "note" ? PT_W / 2 : sx(0), y + 10, b.kind === "note" ? "center" : "start", C.muted)
          y += 13
        }
        y += 10
        break
      }
      case "kv": {
        const rowH = 26
        ensure(rowH * Math.min(b.rows.length, 3))
        b.rows.forEach(([k, v], i) => {
          ensure(rowH)
          if (i > 0) {
            ctx.fillStyle = C.border
            ctx.fillRect(M, y, inner, 0.75)
          }
          font(10)
          text(k, sx(10), y + 17, "start", C.muted)
          font(10, 500)
          text(v, ex(-10, inner), y + 17, "end")
          y += rowH
        })
        y += 12
        break
      }
      case "table": {
        const weights = b.weights ?? b.head.map(() => 1)
        const total = weights.reduce((a, w) => a + w, 0)
        const widths = weights.map((w) => (w / total) * inner)
        const offs = widths.map((_, i) => widths.slice(0, i).reduce((a, w) => a + w, 0))
        const cell = (s: string, i: number, yy: number, color = C.fg) => {
          const end = b.endAlign?.includes(i)
          const pad = 8
          const max = widths[i] - pad * 2
          let v = s
          while (v.length > 1 && ctx.measureText(v).width > max) v = v.slice(0, -2) + "…"
          if (end) text(v, ex(offs[i] - pad, widths[i]), yy, "end", color)
          else text(v, sx(offs[i] + pad), yy, "start", color)
        }
        const head = () => {
          ctx.fillStyle = C.soft
          ctx.fillRect(M, y, inner, 24)
          font(9, 500)
          b.head.forEach((h, i) => cell(h, i, y + 16, C.muted))
          y += 24
        }
        ensure(24 + 24)
        head()
        for (const r of b.rows) {
          if (y + 24 > PT_H - M) {
            newPage()
            head()
          }
          ctx.fillStyle = C.border
          ctx.fillRect(M, y, inner, 0.75)
          font(9.5)
          r.forEach((v, i) => cell(v, i, y + 16))
          y += 24
        }
        y += 14
        break
      }
    }
  }
  return pages
}

const enc = new TextEncoder()

function jpegBytes(c: HTMLCanvasElement) {
  const b64 = c.toDataURL("image/jpeg", 0.8).split(",")[1]
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Minimal PDF: one A4 page per canvas, each page = one full-bleed JPEG image. */
function writePdf(pages: HTMLCanvasElement[], title: string) {
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (p: string | Uint8Array) => {
    const bytes = typeof p === "string" ? enc.encode(p) : p
    parts.push(bytes)
    length += bytes.length
  }
  const obj = (n: number, body: () => void) => {
    offsets[n] = length
    push(`${n} 0 obj\n`)
    body()
    push("\nendobj\n")
  }
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
  const n = pages.length
  // 1 catalog · 2 pages · 3 info · then per page: page, content, image
  const pageId = (i: number) => 4 + i * 3
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"))
  obj(2, () => push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] /Count ${n} >>`))
  const safeTitle = title.replace(/[^\x20-\x7E]/g, "").replace(/[\\()]/g, "")
  obj(3, () => push(`<< /Title (${safeTitle}) /Producer (Medical System) >>`))
  pages.forEach((c, i) => {
    const id = pageId(i)
    const img = jpegBytes(c)
    const content = `q ${PT_W} 0 0 ${PT_H} 0 0 cm /Im0 Do Q`
    obj(id, () =>
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PT_W} ${PT_H}] /Contents ${id + 1} 0 R /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> >>`),
    )
    obj(id + 1, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`))
    obj(id + 2, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`,
      )
      push(img)
      push("\nendstream")
    })
  })
  const count = 4 + n * 3
  const xref = length
  push(`xref\n0 ${count}\n0000000000 65535 f \n`)
  for (let i = 1; i < count; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`)
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF`)
  return new Blob(parts as BlobPart[], { type: "application/pdf" })
}

/** Build a PDF from blocks, in the page's language direction. Waits for web fonts so canvas text uses them. */
export async function pdfDocument(blocks: PdfBlock[], { dir, title }: { dir: "ltr" | "rtl"; title: string }) {
  await document.fonts.ready
  return writePdf(drawPages(blocks, dir), title)
}
