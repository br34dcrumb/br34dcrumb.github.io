import { useEffect, useRef } from 'react'
import { onBooted } from '@/lib/boot'

const RAMP = ' .`-:;=+*#%@'
const NOISE = '01<>/\\{}[]#$%&*+='

/**
 * Full-bleed canvas: a dim ASCII interference field with a spinning
 * donut.c-style torus on top. The cursor lights up the field and tilts the
 * torus; clicking sends a shockwave through both.
 */
export default function AsciiHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const css = getComputedStyle(document.documentElement)
    const PHOSPHOR = css.getPropertyValue('--phosphor').trim() || '#c6ff3d'
    const FG = css.getPropertyValue('--foreground').trim() || '#e8eee0'
    const MUTED = css.getPropertyValue('--muted-foreground').trim() || '#888'
    const BORDER = css.getPropertyValue('--border').trim() || '#333'

    let w = 0
    let h = 0
    let cols = 0
    let rows = 0
    let cellW = 8
    let cellH = 16
    let fontSize = 14
    let lum = new Float32Array(0)
    let kind = new Uint8Array(0) // 0 bg, 1 torus
    let zbuf = new Float32Array(0)

    const mouse = { x: -9999, y: -9999, tx: 0, ty: 0, sx: 0, sy: 0 }
    let burst = 0
    let burstX = 0
    let burstY = 0
    let A = 0.6
    let B = 0.2
    let running = false
    let visible = true
    let raf = 0
    let last = 0
    let fade = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      fontSize = w < 640 ? 10 : w < 1100 ? 12 : 13
      ctx.font = `${fontSize}px "CaskaydiaCove Mono", ui-monospace, monospace`
      ctx.textBaseline = 'top'
      cellW = ctx.measureText('M').width || fontSize * 0.6
      cellH = fontSize * 1.18
      cols = Math.ceil(w / cellW)
      rows = Math.ceil(h / cellH)
      lum = new Float32Array(cols * rows)
      kind = new Uint8Array(cols * rows)
      zbuf = new Float32Array(cols * rows)
    }

    const draw = (t: number) => {
      lum.fill(0)
      kind.fill(0)
      zbuf.fill(0)
      const mobile = w < 768

      // --- torus -----------------------------------------------------------
      const D = mobile ? Math.min(w * 0.95, h * 0.55) : Math.min(w * 0.42, h * 0.78)
      const cx = mobile ? w * 0.5 : w * 0.73
      const cy = mobile ? h * 0.66 : h * 0.5
      const K2 = 5
      const K1 = (D * K2) / 6.4
      const cA = Math.cos(A + mouse.sy * 0.6)
      const sA = Math.sin(A + mouse.sy * 0.6)
      const cB = Math.cos(B + mouse.sx * 0.8)
      const sB = Math.sin(B + mouse.sx * 0.8)
      const thetaStep = mobile ? 0.09 : 0.06
      const phiStep = mobile ? 0.03 : 0.018

      for (let theta = 0; theta < 6.283; theta += thetaStep) {
        const ct = Math.cos(theta)
        const st = Math.sin(theta)
        for (let phi = 0; phi < 6.283; phi += phiStep) {
          const cp = Math.cos(phi)
          const sp = Math.sin(phi)
          const circleX = 2 + ct
          const circleY = st
          const x = circleX * (cB * cp + sA * sB * sp) - circleY * cA * sB
          const y = circleX * (sB * cp - sA * cB * sp) + circleY * cA * cB
          const z = K2 + cA * circleX * sp + circleY * sA
          const ooz = 1 / z
          const px = cx + K1 * ooz * x
          const py = cy - K1 * ooz * y
          const c = (px / cellW) | 0
          const r = (py / cellH) | 0
          if (c < 0 || c >= cols || r < 0 || r >= rows) continue
          const L =
            cp * ct * sB -
            cA * ct * sp -
            sA * st +
            cB * (cA * st - ct * sA * sp)
          const i = r * cols + c
          if (ooz > zbuf[i]) {
            zbuf[i] = ooz
            lum[i] = Math.max(0.08, L / 1.42)
            kind[i] = 1
          }
        }
      }

      // --- background field + cursor glow -----------------------------------
      const ts = t * 0.001
      const glowR = mobile ? 90 : 160
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          if (kind[i]) continue
          const v =
            Math.sin(c * 0.07 + ts * 0.9) * Math.cos(r * 0.13 - ts * 0.6) +
            Math.sin((c + r * 1.7) * 0.035 + ts * 0.4)
          let val = Math.max(0, (v + 0.6) / 2.6) ** 3 * 0.55
          const dx = c * cellW - mouse.x
          const dy = r * cellH - mouse.y
          const d2 = dx * dx + dy * dy
          if (d2 < glowR * glowR * 4) {
            const d = Math.sqrt(d2)
            val += Math.exp(-d2 / (2 * glowR * glowR)) *
              (0.55 + 0.45 * Math.sin(d * 0.06 - ts * 5)) * 0.8
            kind[i] = d < glowR * 1.2 ? 2 : 0
          }
          if (burst > 0.01) {
            const bx = c * cellW - burstX
            const by = r * cellH - burstY
            const bd = Math.sqrt(bx * bx + by * by)
            const ring = (1 - burst) * Math.max(w, h) * 0.9
            const band = Math.abs(bd - ring)
            if (band < 40) {
              val += (1 - band / 40) * burst
              kind[i] = 3
            }
          }
          lum[i] = val
        }
      }

      // --- paint -------------------------------------------------------------
      ctx.clearRect(0, 0, w, h)
      // On phones the field sits behind the copy, so keep it in the background.
      ctx.globalAlpha = mobile ? fade * 0.4 : fade
      const passes: [string, (i: number) => boolean][] = [
        [BORDER, (i) => kind[i] === 0 && lum[i] < 0.28],
        [MUTED, (i) => kind[i] === 0 && lum[i] >= 0.28],
        [FG, (i) => kind[i] === 1 && lum[i] < 0.45],
        [PHOSPHOR, (i) => (kind[i] === 1 && lum[i] >= 0.45) || kind[i] >= 2],
      ]
      for (const [color, test] of passes) {
        ctx.fillStyle = color
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c
            const l = lum[i]
            if (l < 0.04 || !test(i)) continue
            let ch: string
            if (kind[i] === 3 || (kind[i] === 1 && burst > 0.3 && Math.random() < burst * 0.5)) {
              ch = NOISE[(Math.random() * NOISE.length) | 0]
            } else {
              ch = RAMP[Math.min(RAMP.length - 1, (l * RAMP.length) | 0)]
            }
            if (ch !== ' ') ctx.fillText(ch, c * cellW, r * cellH)
          }
        }
      }
      ctx.globalAlpha = 1
    }

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (!visible) return
      if (t - last < 33) return // ~30fps is plenty for ASCII
      const dt = Math.min(64, t - (last || t))
      last = t
      const spin = 1 + burst * 8
      A += 0.0009 * dt * spin
      B += 0.00045 * dt * spin
      burst *= 0.955
      fade = Math.min(1, fade + dt / 900)
      mouse.sx += (mouse.tx - mouse.sx) * 0.06
      mouse.sy += (mouse.ty - mouse.sy) * 0.06
      draw(t)
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.tx = (mouse.x / w - 0.5) * 2
      mouse.ty = (mouse.y / h - 0.5) * 2
    }
    const onLeave = () => {
      mouse.x = mouse.y = -9999
      mouse.tx = mouse.ty = 0
    }
    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (e.clientY > rect.bottom || e.clientY < rect.top) return
      const target = e.target as HTMLElement
      if (target.closest('a, button, input')) return
      burst = 1
      burstX = e.clientX - rect.left
      burstY = e.clientY - rect.top
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(canvas)
    const ro = new ResizeObserver(() => {
      resize()
      if (reduced) {
        fade = 1
        draw(0)
      }
    })
    ro.observe(canvas)

    const start = () => {
      if (running) return
      running = true
      if (reduced) {
        fade = 1
        draw(0)
        return
      }
      raf = requestAnimationFrame(loop)
    }

    let cancelBoot = () => {}
    document.fonts.ready.then(() => {
      resize()
      cancelBoot = onBooted(start)
    })

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    window.addEventListener('pointerdown', onDown)

    return () => {
      cancelAnimationFrame(raf)
      cancelBoot()
      io.disconnect()
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
