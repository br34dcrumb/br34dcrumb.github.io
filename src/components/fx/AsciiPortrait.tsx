import { useEffect, useRef } from 'react'

const RAMP = ' .:-=+*#%@'

/**
 * Renders an image as live ASCII. Hovering opens a lens that shows the
 * original pixels underneath. `src` must be same-origin (pixel reads).
 */
export default function AsciiPortrait({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const css = getComputedStyle(document.documentElement)
    const PHOSPHOR = css.getPropertyValue('--phosphor').trim()
    const MUTED = css.getPropertyValue('--muted-foreground').trim()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const img = new Image()
    img.src = src
    let raf = 0
    let size = 0
    let cols = 0
    let rows = 0
    let cellW = 0
    let cellH = 0
    let bright = new Float32Array(0)
    const lens = { x: -999, y: -999, r: 0, tr: 0 }
    let reveal = 0

    const sample = () => {
      const rect = canvas.getBoundingClientRect()
      size = rect.width
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = size * dpr
      canvas.height = size * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const fontSize = Math.max(7, Math.round(size / 64))
      ctx.font = `${fontSize}px "CaskaydiaCove Mono", monospace`
      ctx.textBaseline = 'top'
      cellW = ctx.measureText('M').width
      cellH = fontSize * 1.05
      cols = Math.floor(size / cellW)
      rows = Math.floor(size / cellH)
      const off = document.createElement('canvas')
      off.width = cols
      off.height = rows
      const octx = off.getContext('2d', { willReadFrequently: true })!
      octx.drawImage(img, 0, 0, cols, rows)
      const data = octx.getImageData(0, 0, cols, rows).data
      bright = new Float32Array(cols * rows)
      for (let i = 0; i < cols * rows; i++) {
        const r = data[i * 4]
        const g = data[i * 4 + 1]
        const b = data[i * 4 + 2]
        bright[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      }
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, size, size)
      reveal = Math.min(1, reveal + 0.02)
      lens.r += (lens.tr - lens.r) * 0.15
      const sweep = reveal * (rows + 10)
      for (let r = 0; r < rows; r++) {
        if (r > sweep) break
        for (let c = 0; c < cols; c++) {
          const b = bright[r * cols + c]
          // jitter a few cells each frame so the portrait feels alive
          const jitter = !reduced && Math.random() < 0.004 ? Math.random() * 0.4 : 0
          const idx = Math.min(RAMP.length - 1, Math.floor((b + jitter) * RAMP.length))
          const ch = Math.abs(r - sweep) < 2 ? '█' : RAMP[idx]
          if (ch === ' ') continue
          ctx.fillStyle = b > 0.6 ? PHOSPHOR : MUTED
          ctx.fillText(ch, c * cellW, r * cellH)
        }
      }
      if (lens.r > 1) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(lens.x, lens.y, lens.r, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(img, 0, 0, size, size)
        ctx.restore()
        ctx.strokeStyle = PHOSPHOR
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(lens.x, lens.y, lens.r, 0, Math.PI * 2)
        ctx.stroke()
      }
      raf = requestAnimationFrame(draw)
      void t
    }

    const move = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      lens.x = e.clientX - rect.left
      lens.y = e.clientY - rect.top
      lens.tr = size * 0.2
    }
    const leave = () => (lens.tr = 0)

    let ro: ResizeObserver | undefined
    img.onload = () =>
      document.fonts.ready.then(() => {
        sample()
        if (reduced) reveal = 1
        raf = requestAnimationFrame(draw)
        ro = new ResizeObserver(sample)
        ro.observe(canvas)
      })
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerleave', leave)
    }
  }, [src])

  return <canvas ref={ref} role="img" aria-label={alt} className="aspect-square w-full" />
}
