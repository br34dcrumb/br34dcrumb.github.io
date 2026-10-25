import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useState } from 'react'

/**
 * Crosshair cursor: a sharp dot that tracks exactly, plus a lagging frame that
 * expands over anything clickable. Fine pointers only.
 */
export default function Cursor() {
  const [enabled, setEnabled] = useState(false)
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const [hidden, setHidden] = useState(true)
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, { stiffness: 450, damping: 35, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 450, damping: 35, mass: 0.6 })

  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine)')
    if (!mq.matches) return
    setEnabled(true)
    window.__br34dCursor = true
    document.documentElement.classList.add('custom-cursor')

    const move = (e: PointerEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
      setHidden(false)
      const t = e.target as HTMLElement | null
      setHover(!!t?.closest('a, button, [role="button"], input, label, summary'))
    }
    const leave = () => setHidden(true)
    const press = () => setDown(true)
    const release = () => setDown(false)
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerleave', leave)
    window.addEventListener('pointerdown', press)
    window.addEventListener('pointerup', release)
    return () => {
      document.documentElement.classList.remove('custom-cursor')
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
      window.removeEventListener('pointerdown', press)
      window.removeEventListener('pointerup', release)
    }
  }, [])

  if (!enabled) return null

  const size = hover ? 44 : 22
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[200] mix-blend-difference"
      style={{ opacity: hidden ? 0 : 1 }}
    >
      <motion.div
        className="absolute top-0 left-0 size-1.5 bg-white"
        style={{ x, y, translateX: '-50%', translateY: '-50%' }}
      />
      <motion.div
        className="absolute top-0 left-0"
        style={{ x: sx, y: sy, translateX: '-50%', translateY: '-50%' }}
        animate={{
          width: size,
          height: size,
          rotate: hover ? 45 : 0,
          scale: down ? 0.7 : 1,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {/* four corner ticks */}
        <span className="absolute top-0 left-0 h-2 w-2 border-t border-l border-white" />
        <span className="absolute top-0 right-0 h-2 w-2 border-t border-r border-white" />
        <span className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-white" />
        <span className="absolute right-0 bottom-0 h-2 w-2 border-r border-b border-white" />
      </motion.div>
    </div>
  )
}
