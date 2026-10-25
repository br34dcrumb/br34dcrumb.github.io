import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { LOGO, randomChar } from '@/lib/ascii'

const BOOT_KEY = 'br34d:booted'

const LOG: [string, string][] = [
  ['br34d-BIOS v26.10 // (c) bi0s hardware lab', ''],
  ['cpu0: rv64gc @ 1.21GHz, 4 harts', 'OK'],
  ['probing jtag tap chain', 'OK'],
  ['glitching vcc rail (-0.42V / 12ns)', 'OK'],
  ['dumping /dev/flash0 -> fw.bin', 'OK'],
  ['bypassing secure boot', 'PWNED'],
  ['brewing chai', 'OK'],
  ['mounting /home/br34d', 'OK'],
]

type Phase = 'log' | 'logo' | 'off' | 'done'

function finishBoot() {
  window.__br34dBooted = true
  document.documentElement.style.overflow = ''
  document.documentElement.classList.add('booted')
  window.dispatchEvent(new Event('boot:done'))
}

function Logo({ progress }: { progress: number }) {
  // Re-render on a timer while decoding so the noise keeps churning.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (progress >= 1) return
    const id = setInterval(() => setTick((t) => t + 1), 45)
    return () => clearInterval(id)
  }, [progress])

  const width = LOGO[0].length
  return (
    <pre
      aria-label="br34d"
      className="text-phosphor text-glow text-[7px] leading-[1] select-none min-[400px]:text-[9px] sm:text-sm md:text-base"
    >
      {LOGO.map((row, r) => (
        <div key={r}>
          {[...row].map((ch, c) => {
            const edge = (c / width) * 0.8 + ((r * 7 + c * 13) % 10) / 50
            if (ch === ' ') {
              return progress < 1 && Math.random() < 0.04 * (1 - progress)
                ? randomChar()
                : ' '
            }
            return edge < progress ? ch : randomChar()
          })}
        </div>
      ))}
    </pre>
  )
}

export default function BootLoader() {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('log')
  const [lines, setLines] = useState(0)
  const [logoProgress, setLogoProgress] = useState(0)
  const [percent, setPercent] = useState(0)
  const timers = useRef<number[]>([])

  const skip = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setLogoProgress(1)
    setPhase((p) => (p === 'done' ? p : 'off'))
  }

  useEffect(() => {
    if (sessionStorage.getItem(BOOT_KEY)) {
      setPhase('done')
      finishBoot()
      return
    }
    sessionStorage.setItem(BOOT_KEY, '1')
    document.documentElement.style.overflow = 'hidden'

    const at = (ms: number, fn: () => void) =>
      timers.current.push(window.setTimeout(fn, reduced ? ms / 4 : ms))

    LOG.forEach((_, i) => at(120 + i * 150, () => setLines(i + 1)))
    for (let p = 0; p <= 100; p += 4) at(80 + p * 13, () => setPercent(p))
    at(1450, () => setPhase('logo'))
    for (let i = 1; i <= 20; i++) at(1450 + i * 45, () => setLogoProgress(i / 20))
    at(2750, () => setPhase('off'))

    const onKey = () => skip()
    window.addEventListener('keydown', onKey)
    return () => {
      timers.current.forEach(clearTimeout)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const SLICES = 7

  return (
    <AnimatePresence onExitComplete={finishBoot}>
      {phase !== 'done' && (
        <motion.div
          key="boot"
          className="fixed inset-0 z-[100] cursor-pointer"
          onClick={skip}
          role="status"
          aria-label="Loading br34d"
          exit={{ opacity: 1 }}
          transition={{ duration: 0.75 }}
        >
          {/* Background slices: they shear away on exit to reveal the page. */}
          {Array.from({ length: SLICES }).map((_, i) => (
            <motion.div
              key={i}
              className="bg-background absolute right-0 left-0"
              style={{
                top: `${(i / SLICES) * 100}%`,
                height: `${100 / SLICES + 0.5}%`,
              }}
              exit={{ x: i % 2 ? '105%' : '-105%' }}
              transition={{
                duration: 0.55,
                delay: 0.04 * Math.abs(i - (SLICES - 1) / 2),
                ease: [0.7, 0, 0.2, 1],
              }}
            />
          ))}

          <motion.div
            className="relative flex h-full w-full flex-col justify-between p-5 font-mono text-xs sm:p-10 sm:text-sm"
            animate={
              phase === 'off'
                ? {
                    scaleY: [1, 0.006, 0.006],
                    scaleX: [1, 1, 0],
                    filter: ['brightness(1)', 'brightness(3)', 'brightness(6)'],
                  }
                : {}
            }
            transition={{ duration: 0.45, times: [0, 0.6, 1], ease: 'easeIn' }}
            onAnimationComplete={() => phase === 'off' && setPhase('done')}
          >
            <div className="text-muted-foreground space-y-1">
              {LOG.slice(0, lines).map(([text, status], i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.12 }}
                  className="flex max-w-xl gap-2"
                >
                  <span className="text-foreground/40">
                    [{(0.0213 * (i + 1) * 37).toFixed(4).padStart(9, ' ')}]
                  </span>
                  <span className="truncate">{text}</span>
                  {status && (
                    <>
                      <span className="text-border min-w-4 flex-1 overflow-hidden whitespace-nowrap">
                        {'.'.repeat(80)}
                      </span>
                      <span
                        className={
                          status === 'OK' ? 'text-phosphor' : 'text-glitch-a'
                        }
                      >
                        [{status}]
                      </span>
                    </>
                  )}
                </motion.div>
              ))}
              <span className="bg-phosphor inline-block h-4 w-2 animate-blink align-middle" />
            </div>

            <div className="flex flex-1 items-center justify-center py-6">
              <AnimatePresence>
                {phase !== 'log' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 1.15, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                    className="flex flex-col items-center gap-4"
                  >
                    <Logo progress={logoProgress} />
                    <motion.p
                      initial={{ opacity: 0, letterSpacing: '1em' }}
                      animate={{
                        opacity: logoProgress >= 1 ? 1 : 0,
                        letterSpacing: logoProgress >= 1 ? '0.4em' : '1em',
                      }}
                      transition={{ duration: 0.5 }}
                      className="text-muted-foreground text-[10px] uppercase sm:text-xs"
                    >
                      hardware // security // chaos
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="text-muted-foreground flex items-end justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-foreground">
                  [
                  <span className="text-phosphor">
                    {'█'.repeat(Math.round(percent / 5))}
                  </span>
                  {'░'.repeat(20 - Math.round(percent / 5))}]
                </span>
                <span className="tabular-nums">
                  {String(percent).padStart(3, ' ')}%
                </span>
              </div>
              <span className="hidden text-[10px] tracking-widest uppercase sm:inline">
                press any key to skip
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
