import { motion, useInView } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MASK_STEP, decodeLandMask } from '@/lib/landmask-decode'

export type Place = {
  name: string
  iso: string
  city: string
  lat: number
  lon: number
  utc: string
  home?: boolean
}

interface Props {
  places: Place[]
  /** RLE land mask from buildLandMask(places.map(p => p.name)) */
  mask: string
}

const WORLD = 195
const RAD = Math.PI / 180
const INKS = [
  'var(--phosphor)',
  'var(--glitch-a)',
  'var(--glitch-b)',
  'var(--foreground)',
]

function haversineKm(a: Place, b: Place) {
  const dLat = (b.lat - a.lat) * RAD
  const dLon = (b.lon - a.lon) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Minimum round trip for light in fibre (~204,000 km/s), no routers. */
const rttMs = (km: number) => km / 102

const fmtCoord = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(2)}${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}${lon >= 0 ? 'E' : 'W'}`

const toVec = (lat: number, lon: number): [number, number, number] => [
  Math.cos(lat * RAD) * Math.sin(lon * RAD),
  Math.sin(lat * RAD),
  Math.cos(lat * RAD) * Math.cos(lon * RAD),
]

// --- globe --------------------------------------------------------------------

function Globe({
  places,
  mask,
  focus,
  hudRef,
}: {
  places: Place[]
  mask: Uint8Array
  focus: number | null
  hudRef: React.RefObject<HTMLSpanElement | null>
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const focusRef = useRef(focus)
  focusRef.current = focus

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const css = getComputedStyle(document.documentElement)
    const col = (v: string) => css.getPropertyValue(v).trim()
    const PH = col('--phosphor')
    const FG = col('--foreground')
    const MUTED = col('--muted-foreground')
    const BORDER = col('--border')
    const PINK = col('--glitch-a')
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const home = places.find((p) => p.home) ?? places[0]
    const RAMP = '.,:;=+*#'
    const MW = 360 / MASK_STEP
    const MH = 180 / MASK_STEP

    // view state, in degrees
    const view = { lon: home.lon - 8, lat: 18, vLon: 0, vLat: 0 }
    let dragging = false
    let lastX = 0
    let lastY = 0
    let idleSince = 0
    let size = 0
    let cellW = 0
    let cellH = 0
    let font = 12
    let raf = 0
    let visible = true

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      size = rect.width
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = size * dpr
      canvas.height = size * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const rows = size < 420 ? 46 : 62
      cellH = size / rows
      font = cellH / 1.12
      ctx.font = `${font}px "CaskaydiaCove Mono", ui-monospace, monospace`
      ctx.textBaseline = 'middle'
      cellW = ctx.measureText('M').width
    }

    // world -> view for the current centre
    const project = (v: [number, number, number]) => {
      const cl = Math.cos(view.lon * RAD)
      const sl = Math.sin(view.lon * RAD)
      const cp = Math.cos(view.lat * RAD)
      const sp = Math.sin(view.lat * RAD)
      const x1 = v[0] * cl - v[2] * sl
      const z1 = v[0] * sl + v[2] * cl
      const y2 = v[1] * cp - z1 * sp
      const z2 = v[1] * sp + z1 * cp
      return [x1, y2, z2] as const
    }

    const slerp = (a: number[], b: number[], t: number) => {
      const dot = Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])
      const om = Math.acos(dot)
      const s = Math.sin(om) || 1
      const k0 = Math.sin((1 - t) * om) / s
      const k1 = Math.sin(t * om) / s
      return [
        a[0] * k0 + b[0] * k1,
        a[1] * k0 + b[1] * k1,
        a[2] * k0 + b[2] * k1,
      ] as [number, number, number]
    }

    const draw = (time: number) => {
      const t = time / 1000
      ctx.clearRect(0, 0, size, size)
      const cx = size / 2
      const cy = size / 2
      const R = size * 0.42
      const cl = Math.cos(view.lon * RAD)
      const sl = Math.sin(view.lon * RAD)
      const cp = Math.cos(view.lat * RAD)
      const sp = Math.sin(view.lat * RAD)
      const f = focusRef.current
      const focusCode = f === null ? -1 : f + 2
      const homeCode = places.indexOf(home) + 2
      const L = [-0.45, 0.55, 0.7]

      // atmosphere
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.18)
      halo.addColorStop(0, 'rgba(198,255,61,0.10)')
      halo.addColorStop(1, 'rgba(198,255,61,0)')
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, size, size)

      const cols = Math.ceil(size / cellW)
      const rows = Math.ceil(size / cellH)
      const buckets: Record<string, [string, number, number][]> = {}
      const put = (color: string, ch: string, x: number, y: number) =>
        (buckets[color] ??= []).push([ch, x, y])

      for (let r = 0; r < rows; r++) {
        const py = (r + 0.5) * cellH
        const ny = (cy - py) / R
        for (let c = 0; c < cols; c++) {
          const px = (c + 0.5) * cellW
          const nx = (px - cx) / R
          const d2 = nx * nx + ny * ny
          if (d2 > 1) continue
          const nz = Math.sqrt(1 - d2)
          // view -> world
          const y1 = ny * cp + nz * sp
          const z1 = -ny * sp + nz * cp
          const wx = nx * cl + z1 * sl
          const wz = -nx * sl + z1 * cl
          const lat = Math.asin(Math.max(-1, Math.min(1, y1))) / RAD
          const lon = Math.atan2(wx, wz) / RAD
          const mr = Math.min(MH - 1, Math.floor((90 - lat) / MASK_STEP))
          const mc = Math.min(MW - 1, Math.floor((lon + 180) / MASK_STEP))
          const code = mask[mr * MW + mc]
          const shade = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2])
          if (code === 0) {
            const gLat = Math.abs(((lat % 15) + 15) % 15) < 1.2
            const gLon =
              Math.abs(((lon % 15) + 15) % 15) < 1.2 * (cellW / cellH) * 2
            if ((gLat || gLon) && shade > 0.15) put(BORDER, '·', px, py)
            continue
          }
          const lum = 0.15 + 0.7 * shade
          const ch =
            RAMP[Math.min(RAMP.length - 1, Math.floor(lum * RAMP.length))]
          let color = lum > 0.45 ? MUTED : BORDER
          if (code >= 2) {
            color = code === focusCode ? PINK : PH
            if (code === homeCode && code !== focusCode) {
              const pulse = 0.5 + 0.5 * Math.sin(t * 3)
              color = pulse > 0.35 ? PH : FG
            }
          }
          put(color, ch, px, py)
        }
      }
      for (const [color, list] of Object.entries(buckets)) {
        ctx.fillStyle = color
        for (const [ch, x, y] of list) ctx.fillText(ch, x - cellW / 2, y)
      }

      // limb
      ctx.strokeStyle = 'rgba(198,255,61,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, R + 2, 0, Math.PI * 2)
      ctx.stroke()

      // flight arcs from home
      const hv = toVec(home.lat, home.lon)
      places.forEach((p, i) => {
        if (p === home) return
        const pv = toVec(p.lat, p.lon)
        const hot = f === i
        const N = 70
        for (let k = 0; k <= N; k++) {
          const tt = k / N
          const v = slerp(hv, pv, tt)
          const lift = 1 + 0.16 * Math.sin(Math.PI * tt)
          const [x, y, z] = project([v[0] * lift, v[1] * lift, v[2] * lift])
          const behind = z < 0 && x * x + y * y < 1
          if (behind) continue
          const dash = (k + (reduced ? 0 : t * 14)) % 6 < 3
          if (!dash) continue
          ctx.fillStyle = hot ? PINK : PH
          const s = hot ? 3 : 2
          ctx.fillRect(cx + x * R - s / 2, cy - y * R - s / 2, s, s)
        }
        // the "plane"
        const tt = reduced ? 0.5 : (t * 0.18 + i * 0.29) % 1
        const v = slerp(hv, pv, tt)
        const lift = 1 + 0.16 * Math.sin(Math.PI * tt)
        const [x, y, z] = project([v[0] * lift, v[1] * lift, v[2] * lift])
        if (!(z < 0 && x * x + y * y < 1)) {
          const gx = cx + x * R
          const gy = cy - y * R
          const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 14)
          g.addColorStop(0, 'rgba(255,255,255,0.9)')
          g.addColorStop(1, 'rgba(198,255,61,0)')
          ctx.fillStyle = g
          ctx.fillRect(gx - 14, gy - 14, 28, 28)
        }
      })

      // markers
      places.forEach((p, i) => {
        const [x, y, z] = project(toVec(p.lat, p.lon))
        if (z < 0.05) return
        const mx = cx + x * R
        const my = cy - y * R
        const hot = f === i
        const ring = (t * 0.8 + i * 0.25) % 1
        ctx.strokeStyle = hot ? PINK : PH
        ctx.globalAlpha = reduced ? 0.6 : 1 - ring
        ctx.beginPath()
        ctx.arc(mx, my, 4 + ring * 16, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.fillStyle = hot ? PINK : '#fff'
        ctx.fillRect(mx - 2.5, my - 2.5, 5, 5)
      })

      if (hudRef.current) {
        const lon = ((((view.lon + 180) % 360) + 360) % 360) - 180
        hudRef.current.textContent = fmtCoord(view.lat, lon)
      }
    }

    const step = (time: number) => {
      raf = requestAnimationFrame(step)
      if (!visible) return
      const f = focusRef.current
      if (f !== null) {
        const target = places[f]
        let dLon = target.lon - view.lon
        dLon = ((((dLon + 180) % 360) + 360) % 360) - 180
        view.lon += dLon * 0.08
        view.lat += (Math.max(-50, Math.min(50, target.lat)) - view.lat) * 0.08
        view.vLon = view.vLat = 0
      } else if (!dragging) {
        view.lon += view.vLon
        view.lat = Math.max(-60, Math.min(60, view.lat + view.vLat))
        view.vLon *= 0.94
        view.vLat *= 0.94
        if (!reduced && time - idleSince > 1500) view.lon += 0.06
      }
      draw(time)
    }

    const down = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      const k = 180 / size
      view.vLon = -(e.clientX - lastX) * k
      view.vLat = (e.clientY - lastY) * k
      view.lon += view.vLon
      view.lat = Math.max(-60, Math.min(60, view.lat + view.vLat))
      lastX = e.clientX
      lastY = e.clientY
    }
    const up = () => {
      dragging = false
      idleSince = performance.now()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(canvas)
    canvas.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    document.fonts.ready.then(() => {
      resize()
      raf = requestAnimationFrame(step)
    })
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      canvas.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [places, mask])

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`ASCII globe highlighting ${places.map((p) => p.name).join(', ')}`}
      className="aspect-square w-full cursor-grab touch-none active:cursor-grabbing"
    />
  )
}

// --- traceroute ---------------------------------------------------------------

function Traceroute({
  hops,
  onFocus,
  focus,
}: {
  hops: { place: Place; index: number; km: number }[]
  onFocus: (i: number | null) => void
  focus: number | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const [shown, setShown] = useState(0)
  const [resolved, setResolved] = useState(0)

  useEffect(() => {
    if (!inView) return
    const timers: number[] = []
    hops.forEach((_, i) => {
      timers.push(window.setTimeout(() => setShown(i + 1), 300 + i * 650))
      timers.push(window.setTimeout(() => setResolved(i + 1), 650 + i * 650))
    })
    timers.push(
      window.setTimeout(
        () => setShown(hops.length + 1),
        300 + hops.length * 650,
      ),
    )
    return () => timers.forEach(clearTimeout)
  }, [inView])

  return (
    <div
      ref={ref}
      className="border-border bg-background/70 border text-[12px] sm:text-[13px]"
    >
      <div className="border-border text-muted-foreground flex justify-between border-b px-4 py-2 text-xs">
        <span>br34d@bi0s: ~ — traceroute</span>
        <span className="text-phosphor">
          {shown > hops.length ? 'done' : 'running'}
        </span>
      </div>
      <div className="space-y-1 p-4 leading-relaxed">
        <p className="text-muted-foreground">
          <span className="text-phosphor">$</span> traceroute world.local
        </p>
        <p className="text-muted-foreground mb-3">
          traceroute to world.local ({WORLD} countries), 30 hops max
        </p>
        {hops.slice(0, shown).map(({ place, index, km }, i) => {
          const done = resolved > i
          const host = `${place.city.toLowerCase().replace(/\s+/g, '-')}.${place.iso.toLowerCase()}`
          return (
            <motion.button
              type="button"
              key={place.iso}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              onMouseEnter={() => onFocus(index)}
              onMouseLeave={() => onFocus(null)}
              onFocus={() => onFocus(index)}
              onBlur={() => onFocus(null)}
              className={`grid w-full grid-cols-[1.5rem_1fr_auto] gap-x-3 text-left transition-colors sm:grid-cols-[1.5rem_1fr_6rem_5rem] ${
                focus === index ? 'text-glitch-a' : 'hover:text-phosphor'
              }`}
            >
              <span className="text-muted-foreground tabular-nums">
                {String(i + 1).padStart(2, ' ')}
              </span>
              <span className="truncate">{host}</span>
              {done ? (
                <>
                  <span className="text-muted-foreground hidden text-right tabular-nums sm:inline">
                    {Math.round(km).toLocaleString('en-US')} km
                  </span>
                  <span className="text-right tabular-nums">
                    {rttMs(km).toFixed(2)} ms
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground text-right sm:col-span-2">
                  * * *
                </span>
              )}
            </motion.button>
          )
        })}
        {shown > hops.length && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground"
          >
            <span className="tabular-nums">
              {String(hops.length + 1).padStart(2, ' ')}
            </span>
            &nbsp;&nbsp;&nbsp;* * * request timed out — next hop pending
            <span className="bg-phosphor animate-blink ml-1 inline-block h-3.5 w-2 align-middle" />
          </motion.p>
        )}
      </div>
      <p className="border-border text-muted-foreground border-t px-4 py-2 text-[11px]">
        rtt = best case for light in fibre from New Delhi, there and back. no
        routers, no excuses.
      </p>
    </div>
  )
}

// --- stamps -------------------------------------------------------------------

function Stamp({
  place,
  km,
  ink,
  tilt,
  index,
  active,
  onFocus,
}: {
  place: Place
  km: number
  ink: string
  tilt: number
  index: number
  active: boolean
  onFocus: (i: number | null) => void
}) {
  return (
    <div className="relative">
      {/* outside the button: the stamp's ink mask would clip it */}
      {active && (
        <motion.span
          layoutId="stamp-focus"
          className="pointer-events-none absolute -inset-3 border border-dashed"
          style={{ borderColor: ink }}
        />
      )}
      <motion.button
        type="button"
        initial={{ opacity: 0, scale: 1.9, rotate: tilt - 14 }}
        whileInView={{ opacity: 1, scale: 1, rotate: tilt }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{
          type: 'spring',
          stiffness: 520,
          damping: 22,
          delay: index * 0.12,
        }}
        whileHover={{ rotate: 0, scale: 1.04 }}
        onMouseEnter={() => onFocus(index)}
        onMouseLeave={() => onFocus(null)}
        onFocus={() => onFocus(index)}
        onBlur={() => onFocus(null)}
        style={{ color: ink }}
        className="stamp relative flex aspect-[5/4] w-full flex-col justify-between p-4 text-left sm:p-5"
      >
        <span className="flex items-center justify-between text-[10px] tracking-[0.3em] uppercase">
          <span>{place.home ? 'issued' : 'arrived'}</span>
          <span>{place.utc}</span>
        </span>
        <span className="flex items-end justify-between gap-2">
          <span className="text-6xl leading-none font-extrabold tracking-tighter sm:text-7xl">
            {place.iso}
          </span>
          <span className="pb-1 text-right text-[10px] leading-tight uppercase">
            {place.name}
            <br />
            {place.city}
          </span>
        </span>
        <span className="flex justify-between border-t border-dashed border-current/40 pt-2 text-[10px] tabular-nums">
          <span>{fmtCoord(place.lat, place.lon)}</span>
          <span>
            {place.home
              ? 'home'
              : `${Math.round(km).toLocaleString('en-US')} km`}
          </span>
        </span>
      </motion.button>
    </div>
  )
}

// --- page ---------------------------------------------------------------------

export default function TravelLog({ places, mask: rle }: Props) {
  const mask = useMemo(() => decodeLandMask(rle), [rle])
  const [focus, setFocus] = useState<number | null>(null)
  const hudRef = useRef<HTMLSpanElement>(null)
  const home = places.find((p) => p.home) ?? places[0]

  const hops = useMemo(
    () =>
      places
        .map((place, index) => ({ place, index, km: haversineKm(home, place) }))
        .sort((a, b) => a.km - b.km),
    [places],
  )
  const furthest = hops[hops.length - 1]
  const offsets = places.map((p) =>
    parseFloat(p.utc.replace('UTC', '').replace(':30', '.5')),
  )
  const pct = (places.length / WORLD) * 100
  const bar = Math.max(1, Math.round((places.length / WORLD) * 24))

  return (
    <div className="flex flex-col gap-16">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="relative">
          <div className="text-muted-foreground pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between text-[11px] tracking-wider uppercase">
            <span>
              centre{' '}
              <span ref={hudRef} className="text-foreground tabular-nums" />
            </span>
            <span className="hidden sm:inline">drag to spin</span>
          </div>
          <Globe places={places} mask={mask} focus={focus} hudRef={hudRef} />
          <div className="text-muted-foreground pointer-events-none absolute inset-x-0 bottom-0 flex justify-between text-[11px] tracking-wider uppercase">
            <span>proj: orthographic</span>
            <span>1° raster · natural earth</span>
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:pt-6">
          <dl className="border-border bg-border grid grid-cols-2 gap-px border text-sm">
            <div className="bg-background col-span-2 p-4">
              <dt className="text-muted-foreground text-xs tracking-[0.15em] uppercase">
                world explored
              </dt>
              <dd className="mt-2 flex flex-wrap items-baseline gap-x-3">
                <span className="text-3xl font-extrabold tracking-tighter">
                  {String(places.length).padStart(2, '0')}
                  <span className="text-muted-foreground text-base font-normal">
                    /{WORLD}
                  </span>
                </span>
                <span className="tabular-nums">
                  [<span className="text-phosphor">{'█'.repeat(bar)}</span>
                  <span className="text-muted-foreground/40">
                    {'░'.repeat(24 - bar)}
                  </span>
                  ] {pct.toFixed(1)}%
                </span>
              </dd>
            </div>
            <div className="bg-background p-4">
              <dt className="text-muted-foreground text-xs tracking-[0.15em] uppercase">
                time zones
              </dt>
              <dd className="mt-1 font-semibold tabular-nums">
                UTC{Math.min(...offsets) >= 0 ? '+' : ''}
                {Math.min(...offsets)} → +{Math.max(...offsets)}
              </dd>
            </div>
            <div className="bg-background p-4">
              <dt className="text-muted-foreground text-xs tracking-[0.15em] uppercase">
                furthest hop
              </dt>
              <dd className="mt-1 font-semibold">
                {furthest.place.city}{' '}
                <span className="text-muted-foreground font-normal tabular-nums">
                  {Math.round(furthest.km).toLocaleString('en-US')} km
                </span>
              </dd>
            </div>
          </dl>
          <Traceroute hops={hops} onFocus={setFocus} focus={focus} />
        </div>
      </div>

      <section className="-mx-4 flex flex-col gap-8 overflow-x-clip px-4 py-4">
        <p className="section-label">passport stamps</p>
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 px-2 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {places.map((p, i) => (
            <Stamp
              key={p.iso}
              place={p}
              index={i}
              km={haversineKm(home, p)}
              ink={INKS[i % INKS.length]}
              tilt={[-4, 3, -2, 5][i % 4]}
              active={focus === i}
              onFocus={setFocus}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
