import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]
const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789BR34D<>{}#$'

function Rain({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const phosphor =
      getComputedStyle(document.documentElement).getPropertyValue('--phosphor') ||
      '#c6ff3d'
    const size = 16
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = innerWidth * dpr
    canvas.height = innerHeight * dpr
    ctx.scale(dpr, dpr)
    ctx.font = `${size}px "CaskaydiaCove Mono", monospace`
    const cols = Math.ceil(innerWidth / size)
    const drops = Array.from({ length: cols }, () => Math.random() * -50)
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (t - last < 45) return
      last = t
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(0, 0, innerWidth, innerHeight)
      for (let i = 0; i < cols; i++) {
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0]
        const y = drops[i] * size
        ctx.fillStyle = '#fff'
        ctx.fillText(ch, i * size, y)
        ctx.fillStyle = phosphor
        ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * size, y - size)
        if (y > innerHeight && Math.random() > 0.97) drops[i] = 0
        drops[i]++
      }
    }
    raf = requestAnimationFrame(loop)
    const timer = setTimeout(onDone, 7000)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onDone()
    window.addEventListener('keydown', esc)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      window.removeEventListener('keydown', esc)
    }
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-[150] bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
    >
      <canvas ref={ref} className="h-full w-full" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2 }}
        className="text-phosphor text-glow absolute inset-0 flex flex-col items-center justify-center gap-2 text-center"
      >
        <p className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          ACCESS GRANTED
        </p>
        <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
          welcome to the lab — esc to leave
        </p>
      </motion.div>
    </motion.div>
  )
}

/** Konami code or the terminal's `hack` command → matrix rain. */
export default function EasterEggs() {
  const [rain, setRain] = useState(false)

  useEffect(() => {
    let pos = 0
    const onKey = (e: KeyboardEvent) => {
      pos = e.key === KONAMI[pos] ? pos + 1 : e.key === KONAMI[0] ? 1 : 0
      if (pos === KONAMI.length) {
        pos = 0
        setRain(true)
      }
    }
    const onMatrix = () => setRain(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('br34d:matrix', onMatrix)

    console.log(
      '%c br34d %c you opened devtools. respect. try the konami code. ',
      'background:#c6ff3d;color:#111;font-weight:bold;padding:2px 4px',
      'color:#c6ff3d',
    )
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('br34d:matrix', onMatrix)
    }
  }, [])

  return (
    <AnimatePresence>
      {rain && <Rain key="rain" onDone={() => setRain(false)} />}
    </AnimatePresence>
  )
}
