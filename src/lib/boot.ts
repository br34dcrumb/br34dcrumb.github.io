declare global {
  interface Window {
    __br34dBooted?: boolean
    __br34dCursor?: boolean
  }
}

/** Runs `cb` once the boot loader has finished (immediately if it already has). */
export function onBooted(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  if (window.__br34dBooted) {
    cb()
    return () => {}
  }
  const handler = () => cb()
  window.addEventListener('boot:done', handler, { once: true })
  return () => window.removeEventListener('boot:done', handler)
}
