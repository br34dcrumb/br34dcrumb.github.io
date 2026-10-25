import { MASK_STEP } from './landmask-decode'
import world from './world.json'

type Ring = number[][]
type Feature = {
  properties: { name: string }
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }
}

function inRing([x, y]: [number, number], ring: Ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

/**
 * Rasterises world.json at build time into a run-length encoded string, one
 * char per cell (lon -180→180, lat 90→-90): '0' water, '1' land, and
 * 'a', 'b', … for the countries in `highlight`, in order.
 */
export function buildLandMask(highlight: string[]): string {
  const polys = (world.features as Feature[])
    .map((f) => {
      const list = (
        f.geometry.type === 'Polygon'
          ? [f.geometry.coordinates]
          : f.geometry.coordinates
      ) as Ring[][]
      return list.map((rings) => {
        let minX = 180,
          maxX = -180,
          minY = 90,
          maxY = -90
        for (const [x, y] of rings[0]) {
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
        return {
          name: f.properties.name,
          rings,
          bbox: [minX, minY, maxX, maxY],
        }
      })
    })
    .flat()

  const cols = 360 / MASK_STEP
  const rows = 180 / MASK_STEP
  const cells: string[] = []
  for (let r = 0; r < rows; r++) {
    const lat = 90 - (r + 0.5) * MASK_STEP
    for (let c = 0; c < cols; c++) {
      const lon = -180 + (c + 0.5) * MASK_STEP
      let code = '0'
      for (const p of polys) {
        const [x0, y0, x1, y1] = p.bbox
        if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue
        if (!inRing([lon, lat], p.rings[0])) continue
        if (p.rings.slice(1).some((h) => inRing([lon, lat], h))) continue
        const k = highlight.indexOf(p.name)
        code = k >= 0 ? String.fromCharCode(97 + k) : '1'
        break
      }
      cells.push(code)
    }
  }

  let out = ''
  for (let i = 0; i < cells.length; ) {
    let j = i
    while (j < cells.length && cells[j] === cells[i]) j++
    out += cells[i] + (j - i).toString(36) + '.'
    i = j
  }
  return out
}
