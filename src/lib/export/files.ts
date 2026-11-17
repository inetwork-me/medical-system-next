/** Browser downloads for generated files (mock storage — no server yet). */

/** Save a Blob (or an existing object URL) under `name`. */
export function saveBlob(file: Blob | string, name: string) {
  const href = typeof file === "string" ? file : URL.createObjectURL(file)
  const a = document.createElement("a")
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (typeof file !== "string") window.setTimeout(() => URL.revokeObjectURL(href), 1000)
}

/** CSV with a BOM so Excel opens Arabic text correctly. */
export function csvBlob(head: string[], rows: string[][]) {
  const cell = (c: string) => `"${c.replaceAll('"', '""')}"`
  const text = [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n")
  return new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" })
}

/** Excel workbook (.xlsx, one sheet, bold frozen header row, RTL sheet for Arabic). */
export function xlsxBlob(head: string[], rows: string[][], { sheet = "Sheet1", rtl = false } = {}) {
  return xlsxBook([{ name: sheet, head, rows }], { rtl })
}

export type XlsxSheet = { name: string; head: string[]; rows: string[][] }

/** Excel workbook (.xlsx) with one or more sheets; each has a bold frozen header row (RTL sheets for Arabic). */
export function xlsxBook(sheets: XlsxSheet[], { rtl = false } = {}) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const col = (i: number) => {
    let s = ""
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
    return s
  }
  const row = (r: string[], y: number, style = 0) =>
    `<row r="${y}">${r.map((c, x) => `<c r="${col(x)}${y}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${esc(c)}</t></is></c>`).join("")}</row>`
  const x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  const names = sheets.map((sh, i) => {
    const base = sh.name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || `Sheet${i + 1}`
    return sheets.slice(0, i).some((o) => o.name === sh.name) ? `${base} ${i + 1}` : base
  })
  const sheetXml = ({ head, rows }: XlsxSheet) => {
    const widths = head.map((h, i) => Math.min(60, Math.max(10, h.length, ...rows.map((r) => (r[i] ?? "").length)) + 2))
    return `${x}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"${rtl ? ' rightToLeft="1"' : ""}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${row(head, 1, 1)}${rows.map((r, i) => row(r, i + 2)).join("")}</sheetData></worksheet>`
  }
  const files: [string, string][] = [
    [
      "[Content_Types].xml",
      `${x}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `${x}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `${x}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `${x}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    [
      "xl/styles.xml",
      `${x}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
    ],
    ...sheets.map((sh, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh)] as [string, string]),
  ]
  return new Blob([zip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

/* ---------------------------------------------------------------- minimal zip (stored, no compression) */

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (d: Uint8Array) => {
  let c = 0xffffffff
  for (const b of d) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zip(entries: [string, string][]) {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  const header = (size: number) => {
    const b = new Uint8Array(size)
    return { b, v: new DataView(b.buffer) }
  }
  for (const [name, text] of entries) {
    const n = enc.encode(name)
    const data = enc.encode(text)
    const crc = crc32(data)
    const local = header(30)
    local.v.setUint32(0, 0x04034b50, true)
    local.v.setUint16(4, 20, true)
    local.v.setUint16(6, 0x0800, true) // UTF-8 names
    local.v.setUint32(14, crc, true)
    local.v.setUint32(18, data.length, true)
    local.v.setUint32(22, data.length, true)
    local.v.setUint16(26, n.length, true)
    chunks.push(local.b, n, data)
    const cen = header(46)
    cen.v.setUint32(0, 0x02014b50, true)
    cen.v.setUint16(4, 20, true)
    cen.v.setUint16(6, 20, true)
    cen.v.setUint16(8, 0x0800, true)
    cen.v.setUint32(16, crc, true)
    cen.v.setUint32(20, data.length, true)
    cen.v.setUint32(24, data.length, true)
    cen.v.setUint16(28, n.length, true)
    cen.v.setUint32(42, offset, true)
    central.push(cen.b, n)
    offset += 30 + n.length + data.length
  }
  const size = central.reduce((a, c) => a + c.length, 0)
  const end = header(22)
  end.v.setUint32(0, 0x06054b50, true)
  end.v.setUint16(8, entries.length, true)
  end.v.setUint16(10, entries.length, true)
  end.v.setUint32(12, size, true)
  end.v.setUint32(16, offset, true)
  return new Blob([...chunks, ...central, end.b] as BlobPart[])
}

/** yyyy-mm-dd for file names. */
export const stamp = () => new Date().toISOString().slice(0, 10)
