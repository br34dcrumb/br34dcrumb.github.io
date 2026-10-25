import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { scrambleText } from '@/lib/ascii'

type NavLink = { href: string; label: string }

function ScrambleLink({
  link,
  index,
  active,
}: {
  link: NavLink
  index: number
  active: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <a
      href={link.href}
      onMouseEnter={() => ref.current && scrambleText(ref.current, link.label, { duration: 350 })}
      className={`group relative flex items-center gap-1.5 py-1 transition-colors ${
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <span className={active ? 'text-phosphor' : 'text-border group-hover:text-phosphor'}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <span ref={ref}>{link.label}</span>
      {active && (
        <motion.span
          layoutId="nav-active"
          className="bg-phosphor absolute right-0 -bottom-0.5 left-0 h-px"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
    </a>
  )
}

export default function SiteNav({ links }: { links: NavLink[] }) {
  const [path, setPath] = useState('/')
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const sync = () => {
      setPath(location.pathname)
      setOpen(false)
    }
    const onScroll = () => setScrolled(window.scrollY > 24)
    sync()
    onScroll()
    document.addEventListener('astro:page-load', sync)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('astro:page-load', sync)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : ''
  }, [open])

  const isActive = (href: string) =>
    href === '/' ? path === '/' : path.startsWith(href)

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
          scrolled || open
            ? 'border-border bg-background/75 border-b backdrop-blur-md'
            : 'border-b border-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="/" className="group flex items-center gap-2 text-base font-bold tracking-tight">
            <span className="text-phosphor transition-transform group-hover:rotate-90">✦</span>
            <span>br34d</span>
            <span className="bg-phosphor -ml-1 inline-block h-4 w-2 animate-blink" />
          </a>

          <nav className="hidden items-center gap-7 text-sm md:flex">
            {links.map((l, i) => (
              <ScrambleLink key={l.href} link={l} index={i} active={isActive(l.href)} />
            ))}
          </nav>

          <div className="text-muted-foreground hidden items-center gap-2 text-xs md:flex">
            <span className="bg-phosphor animate-pulse-dot size-1.5 rounded-full" />
            open to research
          </div>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="relative flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
          >
            <motion.span
              className="bg-foreground block h-px w-6"
              animate={open ? { rotate: 45, y: 3.5 } : { rotate: 0, y: 0 }}
            />
            <motion.span
              className="bg-foreground block h-px w-6"
              animate={open ? { rotate: -45, y: -3.5 } : { rotate: 0, y: 0 }}
            />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="bg-background fixed inset-0 z-40 flex flex-col justify-between px-5 pt-24 pb-10 md:hidden"
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.5, ease: [0.7, 0, 0.2, 1] }}
          >
            <nav className="flex flex-col gap-2">
              {links.map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.06, ease: [0.16, 1, 0.3, 1], duration: 0.6 }}
                  className={`flex items-baseline gap-3 text-5xl font-extrabold tracking-tighter uppercase ${
                    isActive(l.href) ? 'text-phosphor' : 'text-foreground'
                  }`}
                >
                  <span className="text-muted-foreground text-sm font-normal tracking-normal">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {l.label}
                </motion.a>
              ))}
            </nav>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-muted-foreground text-xs"
            >
              <span className="text-phosphor">$</span> try the terminal on the home page.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
