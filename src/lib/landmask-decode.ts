// Client-side half of landmask.ts, kept separate so the browser never bundles world.json.

/** Cell size in degrees. 1° is plenty for an ASCII globe ~60 rows tall. */
export const MASK_STEP = 1

export function decodeLandMask(rle: string): Uint8Array {
  const out = new Uint8Array((360 / MASK_STEP) * (180 / MASK_STEP))
  let i = 0
  for (const run of rle.split('.')) {
    if (!run) continue
    const ch = run[0]
    const n = parseInt(run.slice(1), 36)
    const v = ch === '0' ? 0 : ch === '1' ? 1 : ch.charCodeAt(0) - 95 // 'a' -> 2
    out.fill(v, i, i + n)
    i += n
  }
  return out
}
