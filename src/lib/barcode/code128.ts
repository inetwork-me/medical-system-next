/**
 * Code 128 encoder (ISO/IEC 15417), no dependencies. Used for lab tube labels (CLSI AUTO12 specimen barcodes).
 *
 * encode128("S2611190142-01") → bar/space widths in modules, starting with a bar:
 *   start code · data (code set B for text, C for digit pairs) · check symbol (mod 103) · stop.
 * Code set C packs two digits per symbol, so digit runs (the date + order number) stay short.
 * Leave a quiet zone of at least 10 modules on both sides when drawing.
 */

/** Bar/space widths for symbol values 0–106 (each symbol is 11 modules; stop is 13). */
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
]

const START_B = 104
const START_C = 105
const CODE_C = 99
const CODE_B = 100
const STOP = 106

const isDigit = (c: string) => c >= "0" && c <= "9"
/** Length of the digit run starting at i. */
const digitRun = (s: string, i: number) => {
  let n = 0
  while (i + n < s.length && isDigit(s[i + n])) n++
  return n
}

/**
 * Symbol values for the text (start, data, check, stop). Code set B for printable ASCII (32–126), switching to C
 * for digit runs worth it: 4+ digits at the start or end, 6+ in the middle (the usual minimal-length rule).
 */
export function code128Values(text: string): number[] {
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    if (c < 32 || c > 126) throw new Error(`Code 128 (sets B/C) can't encode "${ch}"`)
  }
  const values: number[] = []
  let set: "B" | "C"
  let i = 0
  const lead = digitRun(text, 0)
  if (lead >= 4 || (lead === text.length && lead >= 2 && lead % 2 === 0)) {
    set = "C"
    values.push(START_C)
  } else {
    set = "B"
    values.push(START_B)
  }
  while (i < text.length) {
    const run = digitRun(text, i)
    if (set === "B") {
      const atEnd = i + run === text.length
      if (run >= 6 || (atEnd && run >= 4)) {
        // Switch to C; an odd run keeps its first digit in B.
        if (run % 2 === 1) {
          values.push(text.charCodeAt(i) - 32)
          i++
        }
        values.push(CODE_C)
        set = "C"
        continue
      }
      values.push(text.charCodeAt(i) - 32)
      i++
    } else {
      if (run >= 2) {
        values.push(Number(text.slice(i, i + 2)))
        i += 2
      } else {
        values.push(CODE_B)
        set = "B"
      }
    }
  }
  const check = values.reduce((sum, v, k) => sum + v * (k === 0 ? 1 : k), 0) % 103
  values.push(check, STOP)
  return values
}

/** Bar/space widths in modules (bar first). Total = 11 × symbols + 2 (stop is 13). */
export function encode128(text: string): number[] {
  return code128Values(text).flatMap((v) => PATTERNS[v].split("").map(Number))
}

/** Quiet zone each side, in modules (the minimum is 10). */
export const QUIET_ZONE = 10
