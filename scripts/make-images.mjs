// Generates the site's cover art and social cards in the phosphor/ASCII style.
//
//   npm run images
//
// Covers (no title text, used on cards and post headers) -> src/assets/covers/<art>.png
// Social cards (title + meta, used for og:image)        -> public/og/...
//
// Each project/post maps to an "art" motif drawn from its own subject. New posts
// fall back to the default motif until they get one in ART_FOR_POST.

import { GlobalFonts, createCanvas, loadImage } from '@napi-rs/canvas'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const W = 1200
const H = 630

GlobalFonts.registerFromPath(join(ROOT, 'public/fonts/CaskaydiaCove[wght].ttf'), 'Cask')

// Mirrors the tokens in src/styles/global.css.
const C = {
  bg: '#0d110e',
  grid: '#1b211c',
  dim: '#2d352e',
  muted: '#8b968a',
  fg: '#e9eee3',
  ph: '#c6ff3d',
  phDark: '#182006',
  pink: '#f06ab0',
  cyan: '#43d3f0',
}

// --- helpers ------------------------------------------------------------------

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hex = (n, w = 2) => n.toString(16).padStart(w, '0')

function textGrid(ctx, { size = 15, lh = 1.25, x = 0, y = 0 } = {}) {
  ctx.font = `400 ${size}px Cask`
  const cw = ctx.measureText('M').width
  const ch = Math.round(size * lh)
  const g = {
    cw,
    ch,
    cols: Math.floor((W - x) / cw),
    rows: Math.floor((H - y) / ch),
    px: (c) => x + c * cw,
    py: (r) => y + r * ch,
    text(r, c, s, color = C.muted, weight = 400) {
      ctx.font = `${weight} ${size}px Cask`
      ctx.fillStyle = color
      ctx.textBaseline = 'top'
      ctx.fillText(s, g.px(c), g.py(r) + (ch - size) / 2)
    },
    mark(r, c, len, color = C.ph) {
      ctx.fillStyle = color
      ctx.fillRect(g.px(c) - 2, g.py(r), len * cw + 4, ch)
    },
  }
  return g
}

function glow(ctx, x, y, r, color = C.ph, alpha = 0.35) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, hexA(color, alpha))
  grad.addColorStop(1, hexA(color, 0))
  ctx.fillStyle = grad
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function hexA(color, a) {
  const n = parseInt(color.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

function base(ctx) {
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = C.grid
  for (let y = 12; y < H; y += 24) for (let x = 12; x < W; x += 24) ctx.fillRect(x, y, 2, 2)
}

function scanlines(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1)
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, W, H)
}

function star(ctx, x, y, r, color = C.ph) {
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2
    const d = i % 2 ? r * 0.28 : r
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
  }
  ctx.closePath()
  ctx.fill()
}

function finish(ctx, caption, { scan = true } = {}) {
  if (scan) scanlines(ctx)
  // corner brackets, same as the site's .bracket hover
  ctx.strokeStyle = C.ph
  ctx.lineWidth = 3
  const i = 26
  const l = 30
  ctx.beginPath()
  ctx.moveTo(i, i + l); ctx.lineTo(i, i); ctx.lineTo(i + l, i)
  ctx.moveTo(W - i, H - i - l); ctx.lineTo(W - i, H - i); ctx.lineTo(W - i - l, H - i)
  ctx.stroke()
  if (caption) {
    ctx.font = '400 14px Cask'
    ctx.textBaseline = 'alphabetic'
    const w = ctx.measureText(caption).width
    ctx.fillStyle = C.bg
    ctx.fillRect(i + 14, H - i - 22, w + 16, 26)
    ctx.fillStyle = C.muted
    ctx.fillText(caption, i + 22, H - i - 4)
  }
}

async function asciiImage(ctx, file, crop, dest, { size = 12, lift = 0.16, color, pool = 'avg' } = {}) {
  const img = await loadImage(file)
  const g = textGrid(ctx, { size, lh: 1.15, x: dest.x, y: dest.y })
  const cols = Math.floor(dest.w / g.cw)
  const rows = Math.floor(cols * (crop.h / crop.w) * (g.cw / g.ch))
  // Sample at 4x and pool, so 1px strokes survive the downscale with 'max'.
  const S = 4
  const off = createCanvas(cols * S, rows * S)
  const o = off.getContext('2d')
  o.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, cols * S, rows * S)
  const data = o.getImageData(0, 0, cols * S, rows * S).data
  const RAMP = ' .:-=+*#%@'
  const lumAt = (x, y) => {
    const k = (y * cols * S + x) * 4
    return (0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2]) / 255
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let lum = 0
      for (let dy = 0; dy < S; dy++)
        for (let dx = 0; dx < S; dx++) {
          const v = lumAt(c * S + dx, r * S + dy)
          lum = pool === 'max' ? Math.max(lum, v) : lum + v / (S * S)
        }
      const b = Math.max(0, Math.min(1, (lum - lift) / (1 - lift - 0.1)))
      const ch = RAMP[Math.min(RAMP.length - 1, Math.floor(b * RAMP.length))]
      if (ch === ' ') continue
      g.text(r, c, ch, color ? color(b, r, c) : b > 0.55 ? C.ph : b > 0.25 ? C.muted : C.dim)
    }
  }
  return { rows, cols, g }
}

function box(g, r, c, w, h, title, color = C.dim, titleColor = C.muted) {
  const label = title ? ` ${title} ` : ''
  g.text(r, c, '┌─' + ' '.repeat(label.length) + '─'.repeat(w - 3 - label.length) + '┐', color)
  for (let i = 1; i < h - 1; i++) {
    g.text(r + i, c, '│', color)
    g.text(r + i, c + w - 1, '│', color)
  }
  g.text(r + h - 1, c, '└' + '─'.repeat(w - 2) + '┘', color)
  if (title) g.text(r, c + 2, label, titleColor)
}

// --- motifs -------------------------------------------------------------------
// Each draws a full 1200x630 cover onto ctx and returns its caption.

const ART = {
  // Firmware hexdump with Firefly's findings lit up.
  async firefly(ctx) {
    base(ctx)
    const rand = rng(7)
    const g = textGrid(ctx, { size: 14, lh: 1.32, x: 44, y: 46 })
    const start = 0x1a2c0
    const plants = {
      2: 'hsqs',
      6: '/bin/busybox',
      10: 'root::0:0:root:',
      13: 'admin:5up3r',
      17: 'telnetd -l /bin/sh',
      21: '-----BEGIN RSA PRI',
      25: 'BusyBox v1.19.4',
    }
    const hits = { 10: 1, 13: 1, 17: 1, 21: 1, 25: 1 }
    const rows = 28
    const glows = []
    for (let r = 0; r < rows; r++) {
      const off = start + r * 16
      const bytes = Array.from({ length: 16 }, () => Math.floor(rand() * 256))
      const plant = plants[r]
      if (plant) for (let i = 0; i < Math.min(16, plant.length); i++) bytes[i] = plant.charCodeAt(i)
      const hexs = bytes.map((b) => hex(b)).join(' ')
      const asc = bytes.map((b) => (b > 31 && b < 127 ? String.fromCharCode(b) : '.')).join('')
      const hot = hits[r]
      g.text(r, 0, hex(off, 8), hot ? C.ph : C.dim)
      g.text(r, 10, hexs.slice(0, 23) + '  ' + hexs.slice(24), plant ? C.fg : C.dim)
      if (hot) {
        g.mark(r, 61, Math.min(16, plant.length))
        glows.push([g.px(61 + 6), g.py(r) + g.ch / 2])
      }
      g.text(r, 60, '|', C.dim)
      g.text(r, 61, asc, hot ? C.phDark : plant ? C.fg : C.dim, hot ? 700 : 400)
      g.text(r, 77, '|', C.dim)
    }
    for (const [x, y] of glows) glow(ctx, x, y, 90, C.ph, 0.18)
    // fireflies drifting off the matches
    for (let i = 0; i < 46; i++) {
      const [x, y] = glows[i % glows.length]
      const fx = x + (rand() - 0.2) * 520
      const fy = y + (rand() - 0.5) * 160
      glow(ctx, fx, fy, 6 + rand() * 10, C.ph, 0.5)
      ctx.fillStyle = C.ph
      ctx.fillRect(fx - 1, fy - 1, 2, 2)
    }
    // findings panel
    const pc = 84
    box(g, 3, pc, 38, 12, 'firefly :: findings', C.dim, C.ph)
    const f = [
      ['[!]', 'shadow, empty root pw', start + 10 * 16, C.pink],
      ['[!]', 'hardcoded creds', start + 13 * 16, C.pink],
      ['[!]', 'telnetd backdoor', start + 17 * 16, C.pink],
      ['[!]', 'embedded rsa key', start + 21 * 16, C.pink],
      ['[~]', 'busybox 1.19.4', start + 25 * 16, C.ph],
      ['[+]', 'squashfs root', start + 2 * 16, C.muted],
    ]
    f.forEach(([tag, label, off, col], i) => {
      g.text(5 + i, pc + 2, tag, col)
      g.text(5 + i, pc + 6, label.padEnd(22), C.fg)
      g.text(5 + i, pc + 28, '@' + hex(off, 6), C.muted)
    })
    g.text(12, pc + 2, 'CVE-2016-2148 (udhcpc)', C.muted)
    g.text(17, pc, 'binwalk -Me fw.bin', C.dim)
    g.text(18, pc, 'qemu-arm-static ./sbin/httpd', C.dim)
    return 'fw.bin · 0x0001a2c0'
  },

  // MODBUS/TCP frames being mutated, with exceptions coming back.
  async r0fuzz(ctx) {
    base(ctx)
    const rand = rng(31)
    const g = textGrid(ctx, { size: 15, lh: 1.35, x: 52, y: 52 })
    g.text(0, 0, 'case   txn  proto len  uid fc  addr  qty   │ reply', C.muted)
    g.text(1, 0, '─'.repeat(50) + '┼' + '─'.repeat(30), C.dim)
    const FC = [0x03, 0x06, 0x10, 0x03, 0x03, 0x06]
    const EXC = ['01 illegal function', '02 illegal data address', '03 illegal data value']
    for (let i = 0; i < 20; i++) {
      const r = i + 2
      const n = 4094 + i
      const fc = FC[i % FC.length]
      const fields = [hex(n & 0xffff, 4), '0000', '0006', '01', hex(fc), hex(Math.floor(rand() * 0x2000), 4), hex(1 + Math.floor(rand() * 120), 4)]
      // mutate one or two fields, radamsa-style
      const mut = new Set([Math.floor(rand() * 7)])
      if (rand() > 0.6) mut.add(2 + Math.floor(rand() * 5))
      for (const m of mut) fields[m] = Array.from(fields[m], () => hex(Math.floor(rand() * 16), 1)).join('')
      g.text(r, 0, String(n).padStart(5, '0'), C.dim)
      let c = 7
      fields.forEach((f, k) => {
        g.text(r, c, f, mut.has(k) ? C.pink : C.muted)
        c += [5, 6, 5, 4, 4, 6, 6][k]
      })
      g.text(r, 50, '│', C.dim)
      const crash = i === 13
      if (crash) {
        g.mark(r, 52, 28, C.ph)
        g.text(r, 52, '!! no reply · target hung', C.phDark, 700)
        glow(ctx, g.px(64), g.py(r) + 10, 160, C.ph, 0.16)
      } else if (rand() > 0.35) {
        g.text(r, 52, `${hex(fc | 0x80)} ${EXC[Math.floor(rand() * 3)]}`, C.fg)
      } else g.text(r, 52, `${hex(fc)} ok`, C.dim)
    }
    const pc = 86
    box(g, 2, pc, 32, 9, 'r0fuzz :: modbus/tcp', C.dim, C.ph)
    const stats = [
      ['target', 'plc-sim:502'],
      ['engine', 'radamsa+boofuzz'],
      ['cases', '4,113'],
      ['hangs', '1'],
      ['next', 'dnp3, opc ua'],
    ]
    stats.forEach(([k, v], i) => {
      g.text(4 + i, pc + 2, k.padEnd(8), C.muted)
      g.text(4 + i, pc + 10, v, i === 3 ? C.ph : C.fg)
    })
    // bit-flip strip
    for (let r = 0; r < 8; r++) {
      let row = ''
      for (let c = 0; c < 32; c++) row += rand() > 0.5 ? '1' : '0'
      g.text(13 + r, pc, row, C.dim)
      const flip = Math.floor(rand() * 32)
      g.text(13 + r, pc + flip, row[flip] === '1' ? '0' : '1', C.pink, 700)
    }
    return 'modbus/tcp · fc 0x03 0x06 0x10'
  },

  // The helmet line drawing, re-rendered as ASCII with a ride HUD.
  async helmet(ctx) {
    base(ctx)
    await asciiImage(
      ctx,
      join(ROOT, 'scripts/sources/smart-helmet.png'),
      { x: 700, y: 170, w: 390, h: 330 },
      { x: 520, y: 60, w: 640 },
      { size: 12, lift: 0.3, pool: 'max' },
    )
    glow(ctx, 840, 320, 260, C.ph, 0.08)
    const g = textGrid(ctx, { size: 16, lh: 1.5, x: 64, y: 96 })
    box(g, 0, 0, 34, 12, 'esp32 :: helmet', C.dim, C.ph)
    const hud = [
      ['gps', 'NEO-7M  3D fix', C.fg],
      ['sats', '09', C.fg],
      ['speed', '38 km/h  ▁▂▃▅▆▅▃', C.ph],
      ['mq2', '0.02 mg/L  clear', C.fg],
      ['depth', 'veh ahead 6.4 m', C.fg],
      ['model', 'midas-small', C.muted],
    ]
    hud.forEach(([k, v, col], i) => {
      g.text(2 + i, 2, k.padEnd(7), C.muted)
      g.text(2 + i, 9, v, col)
    })
    g.text(9, 2, '[ RIDE OK ]', C.ph, 700)
    return 'ride telemetry · 10 Hz'
  },

  // A 65% (68-key) layout drawn as ASCII keycaps, plus a live matrix scan.
  async pikeypro(ctx) {
    base(ctx)
    const g = textGrid(ctx, { size: 13, lh: 1.2, x: 52, y: 180 })
    const U = 5
    const LAYOUT = [
      [['`'], ['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8'], ['9'], ['0'], ['-'], ['='], ['bksp', 2], ['ins']],
      [['tab', 1.5], ['Q'], ['W'], ['E'], ['R'], ['T'], ['Y'], ['U'], ['I'], ['O'], ['P'], ['['], [']'], ['\\', 1.5], ['del']],
      [['caps', 1.75], ['A'], ['S'], ['D'], ['F'], ['G'], ['H'], ['J'], ['K'], ['L'], [';'], ["'"], ['enter', 2.25], ['pgu']],
      [['shift', 2.25], ['Z'], ['X'], ['C'], ['V'], ['B'], ['N'], ['M'], [','], ['.'], ['/'], ['shift', 1.75], ['↑'], ['pgd']],
      [['ctl', 1.25], ['win', 1.25], ['alt', 1.25], ['', 6.25], ['alt'], ['fn'], ['ctl'], ['←'], ['↓'], ['→']],
    ]
    const hot = new Set(['J', 'F', 'fn'])
    LAYOUT.forEach((row, r) => {
      let x = 0
      for (const [label, w = 1] of row) {
        const c0 = Math.round(x * U)
        const c1 = Math.round((x + w) * U) - 1
        const width = c1 - c0
        const on = hot.has(label)
        const col = on ? C.ph : C.muted
        const y = r * 3
        if (on) {
          ctx.fillStyle = hexA(C.ph, 0.14)
          ctx.fillRect(g.px(c0), g.py(y), width * g.cw + g.cw, g.ch * 3)
          glow(ctx, g.px(c0 + width / 2), g.py(y + 1.5), 70, C.ph, 0.2)
        }
        g.text(y, c0, '╭' + '─'.repeat(width - 1) + '╮', col)
        g.text(y + 1, c0, '│', col)
        g.text(y + 1, c1, '│', col)
        const room = width - 1
        const cap = label.length < room ? ' ' + label : label.slice(0, room)
        g.text(y + 1, c0 + 1, cap, on ? C.ph : C.fg, on ? 700 : 400)
        g.text(y + 2, c0, '╰' + '─'.repeat(width - 1) + '╯', col)
        x += w
      }
    })
    g.text(16, 0, 'cosmic byte artemis 68 · dead controller swapped for a pico', C.dim)
    const m = textGrid(ctx, { size: 15, lh: 1.45, x: 860, y: 180 })
    box(m, 0, 0, 30, 12, 'pico h :: scan', C.dim, C.ph)
    const pressed = new Set(['2-6', '2-3', '4-5'])
    for (let r = 0; r < 5; r++) {
      m.text(2 + r, 2, `r${r}`, C.muted)
      for (let c = 0; c < 11; c++) {
        const on = pressed.has(`${r}-${c}`)
        m.text(2 + r, 6 + c * 2, on ? '■' : '·', on ? C.ph : C.dim)
      }
    }
    m.text(8, 2, 'circuitpython · hid', C.muted)
    m.text(9, 2, '> keydown "F" "J" fn', C.ph)
    return 'artemis 68 · re-wired'
  },

  // A UI wireframe with a lens over the misaligned button.
  async pixelens(ctx) {
    base(ctx)
    const g = textGrid(ctx, { size: 15, lh: 1.3, x: 56, y: 60 })
    box(g, 0, 0, 62, 26, 'localhost:5173', C.muted, C.muted)
    g.text(1, 2, '● ● ●', C.dim)
    g.text(2, 2, '─'.repeat(58), C.dim)
    g.text(4, 4, '▇▇▇▇▇▇   home   docs   pricing', C.muted)
    box(g, 7, 4, 54, 12, '', C.dim)
    g.text(9, 7, '▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆', C.fg)
    g.text(11, 7, '▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂', C.dim)
    g.text(12, 7, '▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂', C.dim)
    g.text(15, 9, '┌──────────────┐', C.ph)
    g.text(16, 9, '│  get started │', C.ph)
    g.text(17, 9, '└──────────────┘', C.ph)
    for (let r = 14; r <= 18; r++) g.text(r, 8, '┊', C.pink)
    // lens: a callout magnifying the button's top-left corner
    const lx = g.px(44)
    const ly = g.py(19)
    ctx.strokeStyle = C.ph
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(g.px(9.5), g.py(15.5))
    ctx.lineTo(lx - 80, ly - 50)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.save()
    ctx.beginPath()
    ctx.arc(lx, ly, 96, 0, Math.PI * 2)
    ctx.fillStyle = C.bg
    ctx.fill()
    ctx.clip()
    const px = 16
    for (let y = -6; y < 7; y++)
      for (let x = -6; x < 7; x++) {
        // button border corner, and the pink centre guide 3px to its left
        const edge = (x === -3 && y >= -3) || (y === -3 && x >= -3)
        const inside = x > -3 && y > -3
        const guide = x === -6
        ctx.fillStyle = edge ? C.ph : guide ? C.pink : inside ? '#1f2a0b' : C.grid
        ctx.fillRect(lx + x * px - 7, ly + y * px - 7, px - 2, px - 2)
      }
    ctx.restore()
    ctx.strokeStyle = C.ph
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(lx, ly, 96, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(lx + 68, ly + 68)
    ctx.lineTo(lx + 120, ly + 120)
    ctx.stroke()
    g.text(24, 40, '3px off-axis', C.pink)
    // assistant
    const a = textGrid(ctx, { size: 15, lh: 1.45, x: 760, y: 92 })
    a.text(0, 0, '> why is my button off-center?', C.fg)
    a.text(2, 0, 'retrieved 6 answers · stackoverflow', C.muted)
    a.text(3, 0, 'context: Hero.tsx, hero.css', C.muted)
    a.text(5, 0, 'pixelens ▸', C.ph, 700)
    a.text(6, 0, '.hero uses justify-items: start', C.fg)
    a.text(7, 0, 'and .btn has margin-left: 3px.', C.fg)
    a.text(9, 0, '- margin-left: 3px;', C.pink)
    a.text(10, 0, '+ justify-self: center;', C.ph)
    a.text(12, 0, 'mistral-7b · rag · 4-bit', C.dim)
    return 'ui diff · 1 issue'
  },

  // Lab attendance from MAC sightings.
  async ams(ctx) {
    base(ctx)
    const rand = rng(5)
    const g = textGrid(ctx, { size: 15, lh: 1.4, x: 56, y: 60 })
    g.text(0, 0, 'time      mac                 member     event  dwell', C.muted)
    g.text(1, 0, '─'.repeat(64), C.dim)
    let t = 9 * 3600 + 2 * 60
    for (let i = 0; i < 18; i++) {
      t += Math.floor(rand() * 1500) + 60
      const hh = String(Math.floor(t / 3600)).padStart(2, '0')
      const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0')
      const ss = String(t % 60).padStart(2, '0')
      const mac = `${hex(Math.floor(rand() * 256))}:${hex(Math.floor(rand() * 256))}:**:**:${hex(Math.floor(rand() * 256))}:${hex(Math.floor(rand() * 256))}`
      const out = i > 3 && rand() > 0.6
      const dwell = out ? `${1 + Math.floor(rand() * 6)}h${String(Math.floor(rand() * 60)).padStart(2, '0')}m` : '-'
      g.text(2 + i, 0, `${hh}:${mm}:${ss}`, C.dim)
      g.text(2 + i, 10, mac, C.muted)
      g.text(2 + i, 30, `member_${String(1 + Math.floor(rand() * 24)).padStart(2, '0')}`, C.fg)
      g.text(2 + i, 41, out ? 'OUT' : 'IN', out ? C.pink : C.ph, 700)
      g.text(2 + i, 48, dwell, C.muted)
    }
    // occupancy by hour
    const o = textGrid(ctx, { size: 15, lh: 1.15, x: 820, y: 96 })
    o.text(0, 0, 'lab occupancy', C.ph)
    const hours = [3, 8, 14, 17, 12, 15, 19, 21, 18, 11, 6, 2]
    const top = 22
    hours.forEach((v, i) => {
      for (let k = 0; k < v; k++) o.text(top - k, 1 + i * 2, '█', k > 15 ? C.ph : C.dim)
    })
    o.text(top + 1, 1, '09    12    15    18', C.muted)
    o.text(top + 3, 0, 'pi zero 2w · scan /60s', C.dim)
    return 'arp sweep · postgres'
  },

  // Hardware lab inventory with a bot feed.
  async ims(ctx) {
    base(ctx)
    const g = textGrid(ctx, { size: 15, lh: 1.5, x: 56, y: 62 })
    g.text(0, 0, 'tag     item                      status    holder', C.muted)
    g.text(1, 0, '─'.repeat(62), C.dim)
    const items = [
      ['HW-001', 'oscilloscope 4ch 100MHz', 'IN LAB', ''],
      ['HW-004', 'chipwhisperer-lite', 'OUT', '@member_11'],
      ['HW-007', 'jtagulator', 'IN LAB', ''],
      ['HW-009', 'logic analyzer 8ch', 'OUT', '@member_03'],
      ['HW-012', 'hot air rework station', 'IN LAB', ''],
      ['HW-015', 'bus pirate', 'OVERDUE', '@member_19'],
      ['HW-018', 'sdr receiver', 'IN LAB', ''],
      ['HW-021', 'bench psu 30V 5A', 'OUT', '@member_07'],
      ['HW-022', 'rpi 4 (spare)', 'IN LAB', ''],
      ['HW-025', 'fault injection rig', 'OUT', '@member_02'],
      ['HW-027', 'soldering station', 'IN LAB', ''],
      ['HW-030', 'usb jtag adapter', 'IN LAB', ''],
    ]
    items.forEach(([tag, item, st, who], i) => {
      const col = st === 'IN LAB' ? C.ph : st === 'OUT' ? C.fg : C.pink
      g.text(2 + i, 0, tag, C.dim)
      g.text(2 + i, 8, item, C.fg)
      g.text(2 + i, 34, st, col, 700)
      g.text(2 + i, 44, who, C.muted)
    })
    const d = textGrid(ctx, { size: 15, lh: 1.5, x: 800, y: 92 })
    box(d, 0, 0, 38, 12, '#inventory', C.dim, C.ph)
    const feed = [
      ['bot', 'HW-004 checked out', C.fg],
      ['', 'by @member_11, due in 3d', C.muted],
      ['bot', 'HW-015 is overdue', C.pink],
      ['', 'pinging @member_19', C.muted],
      ['bot', 'HW-012 returned ✓', C.ph],
      ['', 'condition: ok', C.muted],
    ]
    feed.forEach(([who, msg, col], i) => {
      if (who) d.text(2 + i, 2, who, C.ph, 700)
      d.text(2 + i, 6, msg, col)
    })
    d.text(9, 2, '!checkout HW-007', C.dim)
    return 'rpi 4 · discord bot'
  },

  // Simple power analysis: square-and-multiply leaking key bits.
  async acsc(ctx) {
    base(ctx)
    const rand = rng(2024)
    const x0 = 70
    const x1 = W - 70
    const y0 = 110
    const y1 = 470
    // graticule
    ctx.fillStyle = C.dim
    for (let i = 0; i <= 10; i++) {
      const x = x0 + ((x1 - x0) * i) / 10
      for (let y = y0; y <= y1; y += 6) ctx.fillRect(x, y, 1, 1)
    }
    for (let j = 0; j <= 8; j++) {
      const y = y0 + ((y1 - y0) * j) / 8
      for (let x = x0; x <= x1; x += 6) ctx.fillRect(x, y, 1, 1)
    }
    const bits = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1]
    const pts = []
    let x = x0
    const mid = (y0 + y1) / 2 + 40
    const seg = []
    for (const b of bits) {
      const ops = b ? ['S', 'M'] : ['S']
      const sx = x
      for (const op of ops) {
        const len = op === 'S' ? 38 : 30
        const amp = op === 'S' ? 120 : 165
        for (let k = 0; k < len; k++) {
          const env = Math.sin((k / len) * Math.PI)
          pts.push([x, mid - env * amp * (0.75 + rand() * 0.3) + (rand() - 0.5) * 14])
          x += 1.9
        }
        for (let k = 0; k < 4; k++) {
          pts.push([x, mid + (rand() - 0.5) * 8])
          x += 1.9
        }
      }
      seg.push([sx, x, b])
    }
    const scale = (x1 - x0) / (x - x0)
    ctx.save()
    ctx.translate(x0, 0)
    ctx.scale(scale, 1)
    ctx.translate(-x0, 0)
    ctx.shadowColor = C.ph
    ctx.shadowBlur = 14
    ctx.strokeStyle = C.ph
    ctx.lineWidth = 2 / scale
    ctx.beginPath()
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
    ctx.stroke()
    ctx.restore()
    ctx.font = '700 22px Cask'
    ctx.textBaseline = 'top'
    seg.forEach(([a, b, bit]) => {
      const ax = x0 + (a - x0) * scale
      const bx = x0 + (b - x0) * scale
      ctx.fillStyle = bit ? C.ph : C.muted
      ctx.fillText(String(bit), (ax + bx) / 2 - 6, y0 + 12)
      ctx.fillStyle = C.dim
      ctx.fillRect(bx, y0 + 44, 1, y1 - y0 - 60)
    })
    const g = textGrid(ctx, { size: 15, lh: 1.3, x: x0, y: 62 })
    g.text(0, 0, 'CH1  50mV/div   2µs/div   trig ↑ 0.12V', C.muted)
    g.text(0, 64, 'S=square  SM=square+multiply', C.muted)
    const b = textGrid(ctx, { size: 15, lh: 1.3, x: x0, y: y1 + 18 })
    b.text(0, 0, 'key = 0b' + bits.join('') + '…', C.fg)
    b.text(0, 34, 'spa · single trace', C.dim)
    return 'acsc 2024 · PWR_Tr4ce'
  },

  // Dot-matrix map of the DEL -> BKK trip.
  async gcc(ctx) {
    base(ctx)
    const world = JSON.parse(readFileSync(join(ROOT, 'src/lib/world.json'), 'utf8'))
    const lon0 = 62
    const lon1 = 112
    const lat0 = 2
    const lat1 = 38
    const g = textGrid(ctx, { size: 12, lh: 1.25, x: 40, y: 40 })
    const cols = Math.floor((W - 80) / g.cw)
    const rows = Math.floor((H - 80) / g.ch)
    const toLon = (c) => lon0 + ((c + 0.5) / cols) * (lon1 - lon0)
    const toLat = (r) => lat1 - ((r + 0.5) / rows) * (lat1 - lat0)
    const inRing = (pt, ring) => {
      let inside = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
    }
    const polys = world.features.map((f) => ({
      name: f.properties.name,
      polys: f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates,
    }))
    const countryAt = (lon, lat) => {
      for (const f of polys)
        for (const p of f.polys) if (inRing([lon, lat], p[0]) && !p.slice(1).some((h) => inRing([lon, lat], h))) return f.name
      return null
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const name = countryAt(toLon(c), toLat(r))
        if (!name) continue
        const hot = name === 'India' || name === 'Thailand'
        g.text(r, c, hot ? '▪' : '·', hot ? C.ph : C.dim)
      }
    }
    const P = (lon, lat) => [
      40 + ((lon - lon0) / (lon1 - lon0)) * cols * g.cw,
      40 + ((lat1 - lat) / (lat1 - lat0)) * rows * g.ch,
    ]
    const [ax, ay] = P(77.1, 28.56)
    const [bx, by] = P(100.75, 13.69)
    const cx = (ax + bx) / 2 + 40
    const cy = Math.min(ay, by) - 120
    ctx.strokeStyle = C.fg
    ctx.lineWidth = 2
    ctx.setLineDash([8, 8])
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.quadraticCurveTo(cx, cy, bx, by)
    ctx.stroke()
    ctx.setLineDash([])
    for (const [x, y] of [[ax, ay], [bx, by]]) {
      glow(ctx, x, y, 40, C.ph, 0.45)
      ctx.fillStyle = C.ph
      ctx.fillRect(x - 5, y - 5, 10, 10)
    }
    const label = (x, y, a, b) => {
      ctx.font = '700 18px Cask'
      ctx.textBaseline = 'top'
      const w = Math.max(ctx.measureText(a).width, 170)
      ctx.fillStyle = C.bg
      ctx.fillRect(x, y, w + 20, 54)
      ctx.fillStyle = C.ph
      ctx.fillText(a, x + 10, y + 8)
      ctx.font = '400 14px Cask'
      ctx.fillStyle = C.muted
      ctx.fillText(b, x + 10, y + 32)
    }
    label(ax - 210, ay - 70, 'DEL', '28.56N 77.10E')
    label(bx + 18, by - 20, 'BKK', '13.69N 100.75E')
    const t = textGrid(ctx, { size: 15, lh: 1.4, x: 820, y: 70 })
    box(t, 0, 0, 36, 9, 'gcc 2024', C.dim, C.ph)
    ;['day 1  ethics + AD attacks', 'day 2  threat intel, fuzzing', 'day 3  LLM apps, velociraptor', 'day 4  car hacking', 'day 5  malware analysis'].forEach((d, i) =>
      t.text(2 + i, 2, d, i === 3 ? C.ph : C.fg),
    )
    return 'DEL → BKK · 5 days'
  },

  // Default: the BR34D logo beside a torus.
  async default(ctx) {
    base(ctx)
    const g = textGrid(ctx, { size: 11, lh: 1.08, x: 600, y: 40 })
    const cols = 62
    const rows = 50
    const lum = new Float32Array(cols * rows)
    const zb = new Float32Array(cols * rows)
    const A = 0.9
    const B = 0.55
    const cA = Math.cos(A)
    const sA = Math.sin(A)
    const cB = Math.cos(B)
    const sB = Math.sin(B)
    const K1 = (cols * g.cw * 5) / 6.6
    for (let th = 0; th < 6.283; th += 0.03)
      for (let ph = 0; ph < 6.283; ph += 0.01) {
        const ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph)
        const cx = 2 + ct, cy = st
        const x = cx * (cB * cp + sA * sB * sp) - cy * cA * sB
        const y = cx * (sB * cp - sA * cB * sp) + cy * cA * cB
        const z = 5 + cA * cx * sp + cy * sA
        const ooz = 1 / z
        const c = Math.floor((cols * g.cw) / 2 / g.cw + (K1 * ooz * x) / g.cw)
        const r = Math.floor(rows / 2 - (K1 * ooz * y) / g.ch)
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue
        const L = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp)
        const i = r * cols + c
        if (ooz > zb[i]) {
          zb[i] = ooz
          lum[i] = Math.max(0.05, L / 1.42)
        }
      }
    const RAMP = '.,-~:;=!*#$@'
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const l = lum[r * cols + c]
        if (!l) continue
        g.text(r, c, RAMP[Math.min(RAMP.length - 1, Math.floor(l * RAMP.length))], l > 0.5 ? C.ph : l > 0.2 ? C.muted : C.dim)
      }
    glow(ctx, 880, 320, 280, C.ph, 0.07)
    return null
  },
}

// --- social card --------------------------------------------------------------

async function socialCard({ art, kicker, title, description, meta }) {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  // art underneath, faded out toward the text column
  const artCanvas = createCanvas(W, H)
  await ART[art](artCanvas.getContext('2d'))
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 0.75
  ctx.drawImage(artCanvas, 180, 0)
  ctx.globalAlpha = 1
  const fade = ctx.createLinearGradient(0, 0, W, 0)
  fade.addColorStop(0, hexA(C.bg, 1))
  fade.addColorStop(0.5, hexA(C.bg, 0.92))
  fade.addColorStop(0.8, hexA(C.bg, 0.2))
  fade.addColorStop(1, hexA(C.bg, 0))
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, W, H)
  scanlines(ctx)

  const left = 72
  ctx.textBaseline = 'alphabetic'
  ctx.font = '700 22px Cask'
  star(ctx, left + 9, 85, 11)
  ctx.fillStyle = C.fg
  ctx.fillText('br34d', left + 28, 92)
  ctx.font = '400 20px Cask'
  ctx.fillStyle = C.muted
  ctx.fillText(kicker, left + 112, 92)

  // title: shrink until it fits in four lines
  const maxW = 700
  let size = 68
  let lines
  for (; size >= 36; size -= 4) {
    ctx.font = `800 ${size}px Cask`
    lines = wrap(ctx, title, maxW)
    if (lines.length <= 4) break
  }
  const lh = size * 1.02
  const descLines = description ? (ctx.font = '400 22px Cask', wrap(ctx, description, 620).slice(0, 2)) : []
  const blockH = lines.length * lh + (descLines.length ? 24 + descLines.length * 32 : 0)
  let y = (H - blockH) / 2 + size * 0.8
  ctx.font = `800 ${size}px Cask`
  ctx.fillStyle = C.fg
  for (const line of lines) {
    ctx.fillText(line, left, y)
    y += lh
  }
  if (descLines.length) {
    y += 14
    ctx.font = '400 22px Cask'
    ctx.fillStyle = C.muted
    for (const line of descLines) {
      ctx.fillText(line, left, y)
      y += 32
    }
  }
  ctx.font = '400 18px Cask'
  ctx.fillStyle = C.muted
  ctx.fillText(meta, left, H - 70)
  ctx.fillStyle = C.ph
  const host = 'br34dcrumb.github.io'
  ctx.fillText(host, W - 72 - ctx.measureText(host).width, H - 70)
  finish(ctx, null, { scan: false })
  return canvas
}

function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function frontmatter(file) {
  const src = readFileSync(file, 'utf8')
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return {}
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (!kv) continue
    let v = kv[2].trim()
    if (v.startsWith('[')) v = [...v.matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] ?? x[2])
    else v = v.replace(/^['"]|['"]$/g, '')
    data[kv[1]] = v
  }
  return data
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

function save(canvas, path) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, canvas.toBuffer('image/png'))
  console.log('  wrote', relative(ROOT, path).replaceAll('\\', '/'))
}

// --- main ---------------------------------------------------------------------

const ART_FOR_POST = {
  'acsc2024-writeup': 'acsc',
  'gcc2024-thailand': 'gcc',
  pikeypro: 'pikeypro',
}

const COVERS = ['firefly', 'r0fuzz', 'helmet', 'pikeypro', 'pixelens', 'ams', 'ims', 'acsc', 'gcc', 'default']

console.log('covers')
for (const art of COVERS) {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  const caption = await ART[art](ctx)
  finish(ctx, caption)
  save(canvas, join(ROOT, 'src/assets/covers', `${art}.png`))
}

console.log('social cards')
save(
  await socialCard({
    art: 'default',
    kicker: '~/',
    title: 'Anikait Panigrahi',
    description: 'Hardware security, reverse engineering and CTF writeups.',
    meta: 'hardware lead @ team bi0s',
  }),
  join(ROOT, 'public/og/default.png'),
)

const blogDir = join(ROOT, 'src/content/blog')
for (const file of walk(blogDir).filter((f) => /\.mdx?$/.test(f))) {
  const fm = frontmatter(file)
  if (!fm.title || fm.draft === 'true') continue
  const id = relative(blogDir, file).replaceAll('\\', '/').replace(/\.mdx?$/, '').replace(/\/index$/, '')
  const top = id.split('/')[0]
  const date = fm.date ? fm.date.slice(0, 10).replaceAll('-', '.') : ''
  const tags = Array.isArray(fm.tags) ? fm.tags.map((t) => `#${t}`).join(' ') : ''
  save(
    await socialCard({
      art: ART_FOR_POST[top] ?? 'default',
      kicker: `~/blog/${top}`,
      title: fm.title,
      description: fm.description,
      meta: [date, tags].filter(Boolean).join('   '),
    }),
    join(ROOT, 'public/og/blog', `${id}.png`),
  )
}
