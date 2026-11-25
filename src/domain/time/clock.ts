/**
 * The single source of "now". Nothing else in the app calls Date.now(), so
 * time can be shifted in one place: the dev-only time-travel control and
 * tests use setOffset, and Playwright can fake Date itself.
 */
type Listener = () => void

let offsetMs = 0
const listeners = new Set<Listener>()

export const clock = {
  now(): number {
    return Date.now() + offsetMs
  },
  offset(): number {
    return offsetMs
  },
  setOffset(ms: number): void {
    offsetMs = ms
    for (const l of listeners) l()
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
