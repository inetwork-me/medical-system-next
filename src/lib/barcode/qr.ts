/*
 * QR Code encoder (ISO/IEC 18004:2015), no dependencies. Byte mode only (UTF-8 / binary payloads such as the ZATCA
 * TLV base64 string), error correction L / M / Q / H, versions 1–40 (smallest that fits), Reed-Solomon over GF(256)
 * with the 0x11D polynomial, block interleaving, all 8 masks scored with the standard penalty rules.
 *
 * encodeQr(bytesOrText, { ecc }) → { size, modules: boolean[][] }  (modules[y][x], true = dark; no quiet zone)
 */

export type Ecc = "L" | "M" | "Q" | "H"

const ECC_FORMAT_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 }

// Error-correction codewords per block and number of blocks, by ECC level and version (index 0 unused).
// prettier-ignore
const ECC_PER_BLOCK: Record<Ecc, number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
}
// prettier-ignore
const NUM_BLOCKS: Record<Ecc, number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
}

/** Modules available for data + ECC in a version (everything but function patterns, format and version info). */
export function rawDataModules(ver: number) {
  let n = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2
    n -= (25 * align - 10) * align - 55
    if (ver >= 7) n -= 36
  }
  return n
}

/** Data codewords (after ECC) of a version + level. */
export const dataCodewords = (ver: number, ecc: Ecc) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecc][ver] * NUM_BLOCKS[ecc][ver]

/** Centre coordinates of the alignment patterns (both axes). */
export function alignmentPositions(ver: number): number[] {
  if (ver === 1) return []
  const n = Math.floor(ver / 7) + 2
  const size = ver * 4 + 17
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2
  const out = [6]
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos)
  return out
}

/* ------------------------------------------------------------------ Reed-Solomon over GF(256), poly 0x11D */

function gfMul(x: number, y: number) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

/** Generator polynomial coefficients (highest degree first, leading 1 dropped) for `degree` ECC codewords. */
export function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return result
}

export function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)))
  }
  return result
}

/* ------------------------------------------------------------------ encoder */

const utf8 = (s: string) => Array.from(new TextEncoder().encode(s))

export type QrMatrix = { version: number; ecc: Ecc; mask: number; size: number; modules: boolean[][] }

/** Encode bytes (or a string as UTF-8) in byte mode at the smallest version that fits. */
export function encodeQr(input: string | Uint8Array | number[], opts: { ecc?: Ecc; minVersion?: number; mask?: number } = {}): QrMatrix {
  const ecc = opts.ecc ?? "M"
  const bytes = typeof input === "string" ? utf8(input) : Array.from(input)

  // Smallest version whose data capacity holds mode (4) + count (8 or 16 bits) + the bytes.
  let ver = Math.max(1, opts.minVersion ?? 1)
  for (; ; ver++) {
    if (ver > 40) throw new Error("QR: data too long")
    const countBits = ver <= 9 ? 8 : 16
    if (4 + countBits + bytes.length * 8 <= dataCodewords(ver, ecc) * 8) break
  }
  const capacityBits = dataCodewords(ver, ecc) * 8

  // Bit stream: mode 0100, count, data, terminator (≤4 zeros), pad to a byte, pad codewords 0xEC 0x11.
  const bits: number[] = []
  const put = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
  }
  put(0b0100, 4)
  put(bytes.length, ver <= 9 ? 8 : 16)
  for (const b of bytes) put(b, 8)
  put(0, Math.min(4, capacityBits - bits.length))
  put(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) put(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0))

  // Split into blocks, add ECC, interleave.
  const numBlocks = NUM_BLOCKS[ecc][ver]
  const eccLen = ECC_PER_BLOCK[ecc][ver]
  const rawCodewords = Math.floor(rawDataModules(ver) / 8)
  const numShort = numBlocks - (rawCodewords % numBlocks)
  const shortLen = Math.floor(rawCodewords / numBlocks)
  const divisor = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const block = [...dat, ...rsRemainder(dat, divisor)]
    if (i < numShort) block.splice(shortLen - eccLen, 0, -1) // placeholder so all blocks line up
    blocks.push(block)
  }
  const codewords: number[] = []
  for (let i = 0; i < blocks[0].length; i++)
    blocks.forEach((blk, j) => {
      if (i !== shortLen - eccLen || j >= numShort) codewords.push(blk[i])
    })

  // Matrix with function patterns.
  const size = ver * 4 + 17
  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const isFn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const setFn = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark
    isFn[y][x] = true
  }
  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0)
    setFn(i, 6, i % 2 === 0)
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        const x = cx + dx
        const y = cy + dy
        if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4)
      }
  }
  finder(3, 3)
  finder(size - 4, 3)
  finder(3, size - 4)
  const align = alignmentPositions(ver)
  align.forEach((ay, i) =>
    align.forEach((ax, j) => {
      const corner = (i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)
      if (corner) return
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    })
  )
  const drawFormat = (mask: number) => {
    const fdata = (ECC_FORMAT_BITS[ecc] << 3) | mask
    let rem = fdata
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const fbits = ((fdata << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((fbits >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i))
    setFn(8, 7, bit(6))
    setFn(8, 8, bit(7))
    setFn(7, 8, bit(8))
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i))
    setFn(8, size - 8, true) // the dark module
  }
  drawFormat(0) // reserve the format areas
  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const vbits = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const dark = ((vbits >>> i) & 1) !== 0
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      setFn(a, b, dark)
      setFn(b, a, dark)
    }
  }

  // Codewords in the zig-zag order (2-module columns, right to left, skipping the vertical timing column).
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!isFn[y][x] && i < codewords.length * 8) {
          modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0
          i++
        }
      }
  }

  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (isFn[y][x]) continue
        let invert: boolean
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break // prettier-ignore
          case 1: invert = y % 2 === 0; break // prettier-ignore
          case 2: invert = x % 3 === 0; break // prettier-ignore
          case 3: invert = (x + y) % 3 === 0; break // prettier-ignore
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break // prettier-ignore
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break // prettier-ignore
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break // prettier-ignore
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0 // prettier-ignore
        }
        if (invert) modules[y][x] = !modules[y][x]
      }
  }

  let mask = opts.mask ?? -1
  if (mask < 0) {
    let best = Infinity
    for (let m = 0; m < 8; m++) {
      applyMask(m)
      drawFormat(m)
      const p = penalty(modules)
      if (p < best) {
        best = p
        mask = m
      }
      applyMask(m) // XOR again undoes it
    }
  }
  applyMask(mask)
  drawFormat(mask)
  return { version: ver, ecc, mask, size, modules }
}

/** Standard penalty score (rules 1–4) used to pick the mask. */
function penalty(m: boolean[][]) {
  const n = m.length
  let score = 0
  const line = (get: (i: number) => boolean) => {
    let run = 1
    for (let i = 1; i < n; i++) {
      if (get(i) === get(i - 1)) run++
      else {
        if (run >= 5) score += 3 + (run - 5)
        run = 1
      }
    }
    if (run >= 5) score += 3 + (run - 5)
    // 1:1:3:1:1 finder-like pattern with 4 light modules on either side (outside counts as light).
    const at = (i: number) => (i < 0 || i >= n ? false : get(i))
    for (let i = 0; i + 6 < n; i++) {
      if (at(i) && !at(i + 1) && at(i + 2) && at(i + 3) && at(i + 4) && !at(i + 5) && at(i + 6)) {
        const before = !at(i - 1) && !at(i - 2) && !at(i - 3) && !at(i - 4)
        const after = !at(i + 7) && !at(i + 8) && !at(i + 9) && !at(i + 10)
        if (before || after) score += 40
      }
    }
  }
  for (let y = 0; y < n; y++) line((x) => m[y][x])
  for (let x = 0; x < n; x++) line((y) => m[y][x])
  for (let y = 0; y + 1 < n; y++)
    for (let x = 0; x + 1 < n; x++) {
      const c = m[y][x]
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3
    }
  const dark = m.reduce((s, row) => s + row.filter(Boolean).length, 0)
  const total = n * n
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10
  return score
}

/** SVG path data for the dark modules (1 unit per module, offset by the quiet zone). */
export function qrPath(q: Pick<QrMatrix, "size" | "modules">, quiet = 4) {
  const parts: string[] = []
  for (let y = 0; y < q.size; y++) {
    let x = 0
    while (x < q.size) {
      if (!q.modules[y][x]) {
        x++
        continue
      }
      let w = 1
      while (x + w < q.size && q.modules[y][x + w]) w++
      parts.push(`M${x + quiet} ${y + quiet}h${w}v1h-${w}z`)
      x += w
    }
  }
  return parts.join("")
}
