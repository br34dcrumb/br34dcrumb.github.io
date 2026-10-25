// ANSI Shadow glyphs, 8 columns wide each so rows line up when concatenated.
const GLYPHS: Record<string, string[]> = {
  B: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██████╔╝', '╚═════╝ '],
  R: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
  '3': ['██████╗ ', '╚════██╗', ' █████╔╝', ' ╚═══██╗', '██████╔╝', '╚═════╝ '],
  '4': ['██╗  ██╗', '██║  ██║', '███████║', '╚════██║', '     ██║', '     ╚═╝'],
  D: ['██████╗ ', '██╔══██╗', '██║  ██║', '██║  ██║', '██████╔╝', '╚═════╝ '],
  '0': [' ██████╗ ', '██╔═████╗', '██║██╔██║', '████╔╝██║', '╚██████╔╝', ' ╚═════╝ '],
}

export function asciiWord(word: string): string[] {
  const rows = ['', '', '', '', '', '']
  for (const ch of word.toUpperCase()) {
    const glyph = GLYPHS[ch]
    if (!glyph) continue
    glyph.forEach((line, i) => (rows[i] += line))
  }
  return rows
}

export const LOGO = asciiWord('BR34D')
export const FOUR_O_FOUR = asciiWord('404')

export const NOISE_CHARS = '!<>-_\\/[]{}—=+*^?#@$%&01'

export function randomChar() {
  return NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]
}

/**
 * Animates `el.textContent` from noise into `target`, resolving left to right.
 * Returns a cancel function.
 */
export function scrambleText(
  el: HTMLElement,
  target: string,
  { duration = 600, fps = 40 }: { duration?: number; fps?: number } = {},
) {
  const start = performance.now()
  let frame = 0
  let last = 0
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    if (now - last >= 1000 / fps) {
      last = now
      const resolved = Math.floor(t * target.length)
      let out = ''
      for (let i = 0; i < target.length; i++) {
        const c = target[i]
        out += i < resolved || c === ' ' ? c : randomChar()
      }
      el.textContent = out
    }
    if (t < 1) frame = requestAnimationFrame(tick)
    else el.textContent = target
  }
  frame = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(frame)
    el.textContent = target
  }
}
