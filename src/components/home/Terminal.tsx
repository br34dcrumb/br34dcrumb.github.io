import { motion, useInView } from 'framer-motion'
import { navigate } from 'astro:transitions/client'
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'

type Item = { title: string; href: string; meta?: string }

interface Props {
  posts: Item[]
  projects: Item[]
}

const LINKS: Record<string, string> = {
  github: 'https://github.com/br34dcrumb',
  twitter: 'https://twitter.com/_br34d_',
  linkedin: 'https://linkedin.com/in/anikaitpanigrahi/',
  email: 'mailto:br34dcrumb@proton.me',
  resume: '/Anikait-Resume-website.pdf',
}

const ROUTES: Record<string, string> = {
  '~': '/',
  '/': '/',
  blog: '/blog',
  projects: '/projects',
  about: '/about',
  travel: '/travel',
  tags: '/tags',
}

const BREAD = [
  '   .-~~~~~~~~-.  ',
  '  / .  .  .  . \\ ',
  ' |  .  .  .  .  |',
  ' |   .  .  .  . |',
  ' |  .  .  .  .  |',
  " '--------------'",
]

const FILES: Record<string, ReactNode> = {
  'about.txt': (
    <>
      Hi, I'm Anikait. Cybersecurity enthusiast and systems tinkerer with a
      curious mind. I enjoy unpacking complex ideas and often find myself
      tangled in chaos. Always up for a good challenge (and a hot cup of chai).
    </>
  ),
  'stack.txt': (
    <div className="grid grid-cols-[7rem_1fr] gap-x-2">
      <span className="text-muted-foreground">os</span>
      <span>Fedora, Windows 11</span>
      <span className="text-muted-foreground">editor</span>
      <span>VSCode</span>
      <span className="text-muted-foreground">langs</span>
      <span>C/C++, Python 3, Rust, Verilog</span>
      <span className="text-muted-foreground">speaks</span>
      <span>English, Hindi</span>
      <span className="text-muted-foreground">into</span>
      <span>reverse engineering, SCA, fault injection, RISC cores</span>
    </div>
  ),
  'now.txt': <>Associate MDR Analyst at Unit 42, Palo Alto Networks. Hardware hacking on the side.</>,
}

const COMMANDS = [
  'help',
  'whoami',
  'neofetch',
  'ls',
  'cat',
  'blog',
  'projects',
  'cd',
  'open',
  'socials',
  'date',
  'echo',
  'history',
  'clear',
  'hack',
  'chai',
  'sudo',
]

let uid = 0

export default function Terminal({ posts, projects }: Props) {
  const [lines, setLines] = useState<{ id: number; node: ReactNode }[]>([])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [hIndex, setHIndex] = useState(-1)
  const [demoDone, setDemoDone] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView = useInView(wrapRef, { once: true, amount: 0.4 })

  const print = (...nodes: ReactNode[]) =>
    setLines((l) => [...l, ...nodes.map((node) => ({ id: uid++, node }))])

  const prompt = (cmd: string) => (
    <div>
      <span className="text-phosphor">br34d@unit42</span>
      <span className="text-muted-foreground">:~$ </span>
      {cmd}
    </div>
  )

  const linkList = (items: Item[]) => (
    <ul className="space-y-0.5">
      {items.map((it) => (
        <li key={it.href} className="flex gap-3">
          {it.meta && (
            <span className="text-muted-foreground shrink-0">{it.meta}</span>
          )}
          <a
            href={it.href}
            className="hover:bg-phosphor hover:text-primary-foreground underline decoration-dotted underline-offset-4"
          >
            {it.title}
          </a>
        </li>
      ))}
    </ul>
  )

  const run = (raw: string) => {
    const cmdline = raw.trim()
    print(prompt(cmdline))
    if (!cmdline) return
    setHistory((h) => [...h, cmdline])
    const [cmd, ...args] = cmdline.split(/\s+/)
    const arg = args.join(' ')

    switch (cmd.toLowerCase()) {
      case 'help':
        print(
          <div className="grid grid-cols-[9rem_1fr] gap-x-2 sm:grid-cols-[11rem_1fr]">
            {[
              ['whoami', 'who is this guy'],
              ['neofetch', 'system info, but bread'],
              ['ls / cat <file>', 'poke around'],
              ['blog', 'list writeups'],
              ['projects', 'list projects'],
              ['cd <page>', 'go somewhere'],
              ['open <link>', 'github, twitter, resume…'],
              ['clear', 'wipe the screen'],
              ['???', 'there are secrets'],
            ].map(([c, d]) => (
              <div key={c} className="contents">
                <span className="text-phosphor">{c}</span>
                <span className="text-muted-foreground">{d}</span>
              </div>
            ))}
          </div>,
        )
        break
      case 'whoami':
        print(
          <>
            anikait panigrahi <span className="text-muted-foreground">(br34d)</span>{' '}
            — associate MDR analyst @ Unit 42, Palo Alto Networks. ECE @ Amrita University.
          </>,
        )
        break
      case 'neofetch':
        print(
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            <pre className="text-phosphor leading-tight">{BREAD.join('\n')}</pre>
            <div className="grid grid-cols-[6rem_1fr] gap-x-2">
              <span className="text-phosphor col-span-2">br34d@unit42</span>
              <span className="text-border col-span-2">------------</span>
              <span className="text-phosphor">os</span>
              <span>Fedora / Windows 11</span>
              <span className="text-phosphor">host</span>
              <span>Palo Alto Networks</span>
              <span className="text-phosphor">team</span>
              <span>Unit 42</span>
              <span className="text-phosphor">role</span>
              <span>Associate MDR Analyst</span>
              <span className="text-phosphor">edu</span>
              <span>ECE @ Amrita University</span>
              <span className="text-phosphor">langs</span>
              <span>C, Python, Rust, Verilog</span>
              <span className="text-phosphor">fuel</span>
              <span>chai, unlimited</span>
              <span className="text-phosphor">posts</span>
              <span>{posts.length}</span>
              <span className="text-phosphor">projects</span>
              <span>{projects.length}</span>
            </div>
          </div>,
        )
        break
      case 'ls':
        print(
          <div className="flex flex-wrap gap-x-6">
            <span className="text-glitch-b">blog/</span>
            <span className="text-glitch-b">projects/</span>
            {Object.keys(FILES).map((f) => (
              <span key={f}>{f}</span>
            ))}
            <span className="text-phosphor">resume.pdf*</span>
          </div>,
        )
        break
      case 'cat':
        if (FILES[arg]) print(<div className="max-w-2xl">{FILES[arg]}</div>)
        else if (arg === 'resume.pdf')
          print(<>binary file. try: <span className="text-phosphor">open resume</span></>)
        else if (!arg) print('cat: missing operand. try: cat about.txt')
        else print(`cat: ${arg}: No such file or directory`)
        break
      case 'blog':
        print(linkList(posts))
        break
      case 'projects':
        print(linkList(projects))
        break
      case 'cd': {
        const target = ROUTES[arg.replace(/\/$/, '') || '~']
        if (!target) print(`cd: no such directory: ${arg}`)
        else if (target === '/' && location.pathname === '/') print('already home.')
        else {
          print(<span className="text-muted-foreground">navigating…</span>)
          setTimeout(() => navigate(target), 300)
        }
        break
      }
      case 'open': {
        const url = LINKS[arg.toLowerCase()]
        if (!url) print(`open: unknown target. try: ${Object.keys(LINKS).join(', ')}`)
        else {
          print(<span className="text-muted-foreground">opening {arg}…</span>)
          window.open(url, '_blank', 'noopener')
        }
        break
      }
      case 'socials':
        print(
          linkList(
            Object.entries(LINKS).map(([k, v]) => ({ title: v.replace(/^mailto:/, ''), href: v, meta: k.padEnd(9, ' ') })),
          ),
        )
        break
      case 'date':
        print(new Date().toString())
        break
      case 'echo':
        print(arg)
        break
      case 'history':
        print(
          <ol className="list-inside list-decimal">
            {[...history, cmdline].map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>,
        )
        break
      case 'clear':
        setLines([])
        break
      case 'sudo':
        print(
          <span className="text-glitch-a">
            br34d is not in the sudoers file. This incident will be reported.
          </span>,
        )
        break
      case 'rm':
        print(<span className="text-glitch-a">nice try.</span>)
        document.documentElement.classList.add('shake')
        setTimeout(() => document.documentElement.classList.remove('shake'), 600)
        break
      case 'hack':
      case 'matrix':
        print(<span className="text-phosphor">initiating… press esc to escape.</span>)
        window.dispatchEvent(new Event('br34d:matrix'))
        break
      case 'chai':
        print(
          <pre className="text-phosphor leading-tight">
            {'   ( (\n    ) )\n  ........\n  |      |]\n  \\      /\n   `----\''}
          </pre>,
        )
        break
      case 'exit':
        print('there is no escape.')
        break
      default:
        print(
          <>
            command not found: <span className="text-glitch-a">{cmd}</span>. try{' '}
            <span className="text-phosphor">help</span>
          </>,
        )
    }
  }

  // Auto-type a demo command the first time the terminal scrolls into view.
  useEffect(() => {
    if (!inView || demoDone) return
    setDemoDone(true)
    const demo = 'neofetch'
    let i = 0
    const id = setInterval(() => {
      i++
      setInput(demo.slice(0, i))
      if (i === demo.length) {
        clearInterval(id)
        setTimeout(() => {
          run(demo)
          setInput('')
          print(
            <span className="text-muted-foreground">
              type <span className="text-phosphor">help</span> to see what else
              this thing does.
            </span>,
          )
        }, 250)
      }
    }, 70)
    return () => clearInterval(id)
  }, [inView])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      run(input)
      setInput('')
      setHIndex(-1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!history.length) return
      const i = hIndex < 0 ? history.length - 1 : Math.max(0, hIndex - 1)
      setHIndex(i)
      setInput(history[i])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (hIndex < 0) return
      const i = hIndex + 1
      if (i >= history.length) {
        setHIndex(-1)
        setInput('')
      } else {
        setHIndex(i)
        setInput(history[i])
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const match = COMMANDS.find((c) => c.startsWith(input) && input)
      if (match) setInput(match + ' ')
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLines([])
    }
  }

  return (
    <motion.div
      ref={wrapRef}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="border-border bg-background/80 relative overflow-hidden border shadow-[0_0_80px_-20px_oklch(0.91_0.2_128/0.25)] backdrop-blur"
      onClick={() => inputRef.current?.focus({ preventScroll: true })}
    >
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-4 py-2 text-xs">
        <div className="flex gap-1.5">
          <span className="bg-glitch-a/80 size-2.5 rounded-full" />
          <span className="bg-phosphor/80 size-2.5 rounded-full" />
          <span className="bg-glitch-b/80 size-2.5 rounded-full" />
        </div>
        <span>br34d@unit42: ~ — zsh</span>
        <span className="tabular-nums">80×24</span>
      </div>
      <div
        ref={scrollRef}
        className="h-[26rem] overflow-y-auto p-4 text-[13px] leading-relaxed sm:p-5"
      >
        <div className="text-muted-foreground mb-3" suppressHydrationWarning>
          Last login: {new Date().toDateString()} on ttyS0
        </div>
        {lines.map((l) => (
          <div key={l.id} className="mb-1 break-words">
            {l.node}
          </div>
        ))}
        <label className="flex items-center">
          <span className="text-phosphor shrink-0">br34d@unit42</span>
          <span className="text-muted-foreground shrink-0">:~$&nbsp;</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Terminal input"
            className="caret-phosphor w-full min-w-0 bg-transparent outline-none"
          />
        </label>
      </div>
    </motion.div>
  )
}
