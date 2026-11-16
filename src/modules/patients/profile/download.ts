"use client"

import * as React from "react"

import type { PatientFile } from "./record"

/**
 * File downloads for the patient Files tab (mock storage). Progress is shown inside the file card
 * (Upload Item pattern), then the browser saves the file:
 *  · files uploaded this session → the original file (object URL kept on the record)
 *  · the design's sample files → a small generated stand-in with the same name (1-page PDF or an image)
 */

const DURATION = 1200
const STEP = 120

export type DownloadState = { progress: number; done: boolean }

export function useFileDownloads() {
  const [state, setState] = React.useState<Record<string, DownloadState>>({})
  const timers = React.useRef<number[]>([])
  React.useEffect(() => () => timers.current.forEach((t) => window.clearInterval(t)), [])

  const start = React.useCallback((file: PatientFile) => {
    setState((s) => (s[file.name] && !s[file.name].done ? s : { ...s, [file.name]: { progress: 0, done: false } }))
    let p = 0
    const id = window.setInterval(() => {
      p = Math.min(100, p + (STEP / DURATION) * 100)
      if (p >= 100) {
        window.clearInterval(id)
        setState((s) => ({ ...s, [file.name]: { progress: 100, done: true } }))
        void save(file)
        // Back to the normal card after a moment.
        const back = window.setTimeout(
          () =>
            setState((s) => {
              const next = { ...s }
              delete next[file.name]
              return next
            }),
          2500
        )
        timers.current.push(back)
      } else {
        setState((s) => ({ ...s, [file.name]: { progress: Math.round(p), done: false } }))
      }
    }, STEP)
    timers.current.push(id)
  }, [])

  return { downloads: state, startDownload: start }
}

/** Save a patient file right away (viewer "Download"). */
export async function save(file: PatientFile) {
  const href = file.url ?? URL.createObjectURL(await standIn(file))
  const a = document.createElement("a")
  a.href = href
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (!file.url) window.setTimeout(() => URL.revokeObjectURL(href), 1000)
}

/** A small valid file with the same name, for the design's sample files (no real storage yet). */
async function standIn(file: PatientFile): Promise<Blob> {
  const ext = file.ext.toLowerCase()
  if (ext === "png" || ext === "jpg" || ext === "jpeg") {
    const canvas = document.createElement("canvas")
    canvas.width = 800
    canvas.height = 500
    const g = canvas.getContext("2d")!
    g.fillStyle = "#EFF6FF"
    g.fillRect(0, 0, 800, 500)
    g.fillStyle = "#155DFC"
    g.font = "600 28px system-ui, sans-serif"
    g.fillText(file.title.en, 40, 80)
    g.fillStyle = "#64748B"
    g.font = "20px system-ui, sans-serif"
    g.fillText(`${file.name} · ${file.date}`, 40, 120)
    g.fillText("Sample file · Medical System demo", 40, 450)
    const type = ext === "png" ? "image/png" : "image/jpeg"
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), type, 0.92))
  }
  return new Blob([pdf([file.title.en, `${file.name} · ${file.date}`, "Sample file · Medical System demo"])], { type: "application/pdf" })
}

/** Minimal one-page PDF with a few lines of text. */
function pdf(lines: string[]) {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7E]/g, "?")
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 18 : 12} Tf 56 ${780 - i * 28} Td (${esc(l)}) Tj ET`).join("\n")
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return out
}
