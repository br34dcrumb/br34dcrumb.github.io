import { motion, useScroll, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import AsciiHero from '@/components/fx/AsciiHero'
import { scrambleText } from '@/lib/ascii'
import { onBooted } from '@/lib/boot'

const ROLES = [
  'glitching voltage rails',
  'reversing firmware blobs',
  'fuzzing ICS protocols',
  'building RISC cores in verilog',
  'side-channeling AES keys',
  'playing CTFs with bi0s',
  'drinking way too much chai',
]

function Typewriter({ active }: { active: boolean }) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!active) return
    let role = 0
    let i = 0
    let deleting = false
    let id = 0
    const step = () => {
      const word = ROLES[role]
      if (!deleting) {
        i++
        setText(word.slice(0, i))
        if (i === word.length) {
          deleting = true
          id = window.setTimeout(step, 1600)
          return
        }
      } else {
        i--
        setText(word.slice(0, i))
        if (i === 0) {
          deleting = false
          role = (role + 1) % ROLES.length
        }
      }
      id = window.setTimeout(step, deleting ? 28 : 55 + Math.random() * 60)
    }
    id = window.setTimeout(step, 400)
    return () => clearTimeout(id)
  }, [active])
  return (
    <span>
      <span className="text-phosphor">{text}</span>
      <span className="bg-phosphor ml-0.5 inline-block h-[1.1em] w-[0.55em] animate-blink align-[-0.15em]" />
    </span>
  )
}

function Clock() {
  const [now, setNow] = useState<string>('--:--:--')
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const tick = () => setNow(fmt.format(new Date()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="tabular-nums">{now} IST</span>
}

function NameLine({
  text,
  delay,
  active,
}: {
  text: string
  delay: number
  active: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const onEnter = () => {
    if (ref.current) scrambleText(ref.current, text, { duration: 450 })
  }
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <motion.span
        className="glitch block"
        data-text={text}
        initial={{ y: '110%' }}
        animate={active ? { y: '0%' } : {}}
        transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
        onMouseEnter={onEnter}
      >
        <span ref={ref}>{text}</span>
      </motion.span>
    </span>
  )
}

const fadeUp = (delay: number, active: boolean) => ({
  initial: { opacity: 0, y: 16 },
  animate: active ? { opacity: 1, y: 0 } : {},
  transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
})

export default function Hero() {
  const [active, setActive] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '35%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const canvasScale = useTransform(scrollYProgress, [0, 1], [1, 1.15])

  useEffect(() => onBooted(() => setActive(true)), [])

  return (
    <section
      ref={sectionRef}
      className="relative -mt-16 flex min-h-[100svh] w-full flex-col overflow-hidden"
    >
      <motion.div className="absolute inset-0" style={{ scale: canvasScale }}>
        <AsciiHero />
      </motion.div>
      {/* Keep text readable over the field on small screens. */}
      <div className="from-background via-background/70 pointer-events-none absolute inset-0 bg-gradient-to-r to-transparent md:via-background/40" />
      <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t to-transparent" />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pt-28 pb-24 sm:px-8"
      >
        <motion.p
          {...fadeUp(0.1, active)}
          className="text-muted-foreground mb-6 text-xs tracking-[0.3em] uppercase sm:text-sm"
        >
          <span className="text-phosphor">&gt;</span> ./whoami
        </motion.p>

        <h1 className="text-foreground text-[clamp(2.9rem,11vw,9.5rem)] leading-[0.86] font-extrabold tracking-[-0.06em] uppercase">
          <NameLine text="Anikait" delay={0.15} active={active} />
          <NameLine text="Panigrahi" delay={0.27} active={active} />
        </h1>

        <motion.p
          {...fadeUp(0.55, active)}
          className="text-muted-foreground mt-6 text-sm sm:text-base"
        >
          aka <span className="text-foreground">br34d</span> — associate MDR analyst @ 
          <a
            href="https://unit42.paloaltonetworks.com"
            target="_blank"
            rel="noopener"
            className="text-foreground decoration-phosphor underline underline-offset-4"
          >
            Unit 42
          </a>
          , Palo Alto Networks
        </motion.p>

        <motion.p
          {...fadeUp(0.7, active)}
          className="mt-3 min-h-[1.6em] text-base sm:text-xl"
        >
          <span className="text-muted-foreground">currently </span>
          <Typewriter active={active} />
        </motion.p>

        <motion.p
          {...fadeUp(0.85, active)}
          className="text-foreground/70 mt-6 max-w-md text-sm leading-relaxed"
        >
          Cybersecurity enthusiast and systems tinkerer. I take hardware apart to
          see how it breaks — then write it up so you can break it too.
        </motion.p>

        <motion.div
          {...fadeUp(1, active)}
          className="mt-9 flex flex-wrap gap-3 text-sm"
        >
          <a
            href="/blog"
            className="group bg-phosphor text-primary-foreground relative inline-flex items-center gap-2 px-5 py-3 font-semibold transition-transform hover:-translate-y-0.5"
          >
            read_writeups
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </a>
          <a
            href="/projects"
            className="bracket border-border hover:border-foreground/40 bg-background/60 inline-flex items-center gap-2 border px-5 py-3 backdrop-blur transition-colors"
          >
            ls ./projects
          </a>
          <a
            href="#terminal"
            className="bracket border-border hover:border-foreground/40 bg-background/60 inline-flex items-center gap-2 border px-5 py-3 backdrop-blur transition-colors"
          >
            <span className="text-phosphor">$</span> open terminal
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        {...fadeUp(1.2, active)}
        className="text-muted-foreground relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 pb-6 text-[10px] tracking-[0.2em] uppercase sm:px-8 sm:text-xs"
      >
        <span className="flex items-center gap-2">
          <span className="bg-phosphor animate-pulse-dot inline-block size-1.5 rounded-full" />
          <Clock />
        </span>
        <span className="hidden md:inline">click anywhere ✦ move your cursor</span>
        <span className="flex items-center gap-2">
          scroll
          <motion.span
            animate={{ y: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
          >
            ↓
          </motion.span>
        </span>
      </motion.div>
    </section>
  )
}
